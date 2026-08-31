import type { CapacityCall, Difficulty, DisciplineLevel, RawTask } from '../types';
import { analyzeDiscipline, calibrateLoad, parseTasks } from './planner';

/**
 * AI layer.
 *
 * Everything here is optional. The app ships with a local engine that runs
 * fully offline with no key and no account. If the user turns on a free remote
 * model, we try it first and fall back to the local engine on any failure —
 * bad JSON, timeout, rate limit, no network. The app never blocks on it.
 */

export type Provider = 'local' | 'pollinations' | 'openrouter';

export interface AiSettings {
  provider: Provider;
  /** Only used by openrouter. Free-tier keys work. */
  apiKey: string;
  /** Only used by openrouter. */
  model: string;
}

export const FREE_OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
];

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'local',
  apiKey: '',
  model: FREE_OPENROUTER_MODELS[0],
};

const TIMEOUT_MS = 20000;

export interface PlanAnalysis {
  discipline: DisciplineLevel;
  capacity: CapacityCall;
  /** Which engine actually produced this result. */
  source: 'local' | 'remote';
  /** Populated when a remote attempt failed and we fell back. */
  fallbackReason?: string;
}

/* ------------------------------------------------------------------ */
/* Local engine (always available)                                     */
/* ------------------------------------------------------------------ */

export function analyzeLocally(
  yesterday: string,
  taskText: string,
  overrideLevel: DisciplineLevel | null = null,
): PlanAnalysis {
  const discipline = overrideLevel ?? analyzeDiscipline(yesterday);
  const tasks = parseTasks(taskText);
  return { discipline, capacity: calibrateLoad(tasks, discipline), source: 'local' };
}

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

function buildPrompt(yesterday: string, taskText: string): string {
  return `You are Spartan, a blunt discipline coach that plans a person's next day.

YESTERDAY (their own words):
"""${yesterday}"""

WHAT THEY WANT TO DO TOMORROW (their own words, any number of items):
"""${taskText}"""

Do three things:
1. Read yesterday and pick a discipline level: "building" (yesterday was poor or broken), "steady" (ordinary), or "sharp" (genuinely disciplined).
2. Break their message into the tasks it actually contains. Do not invent tasks. Do not force a fixed number. Estimate honest focused minutes for each and rate difficulty as easy, medium, hard, or iron (iron = physical training).
3. Judge the total load against what that discipline level can realistically carry (building ~180 focused minutes and 3 tasks max, steady ~300 and 5 max, sharp ~420 and 7 max). If it is too much, move the least important tasks to "deferred" and explain the cut. If it is far too little, say so and tell them how many more they could carry.

Reply with ONLY a JSON object, no markdown fence, no commentary:
{
  "discipline": "building" | "steady" | "sharp",
  "verdict": "trim" | "balanced" | "add",
  "accepted": [{"title": string, "difficulty": "easy"|"medium"|"hard"|"iron", "estimate": number}],
  "deferred": [{"title": string, "difficulty": "easy"|"medium"|"hard"|"iron", "estimate": number}],
  "roomForMore": number,
  "reasoning": string
}

"reasoning" is spoken directly to them: direct, two short paragraphs, no flattery, no emoji. Order "accepted" hardest first.`;
}

/* ------------------------------------------------------------------ */
/* Response validation — never trust the model                         */
/* ------------------------------------------------------------------ */

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'iron'];

function coerceTasks(value: unknown): RawTask[] {
  if (!Array.isArray(value)) return [];
  const out: RawTask[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) continue;
    const difficulty = DIFFICULTIES.includes(raw.difficulty as Difficulty)
      ? (raw.difficulty as Difficulty)
      : 'medium';
    const n = Number(raw.estimate);
    const estimate = Number.isFinite(n) && n >= 5 && n <= 480 ? Math.round(n / 5) * 5 : 60;
    out.push({ title: title.slice(0, 120), difficulty, estimate });
  }
  return out;
}

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('no JSON object in response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Turn a raw model reply into a trustworthy analysis, or throw. */
export function parseModelReply(text: string): PlanAnalysis {
  const data = extractJson(text) as Record<string, unknown>;

  const discipline: DisciplineLevel =
    data.discipline === 'building' || data.discipline === 'sharp' || data.discipline === 'steady'
      ? data.discipline
      : 'steady';

  const accepted = coerceTasks(data.accepted);
  const deferred = coerceTasks(data.deferred);
  if (accepted.length === 0) throw new Error('model returned no usable tasks');

  // Recompute the numbers ourselves — models are unreliable at arithmetic.
  const local = calibrateLoad([...accepted, ...deferred], discipline);

  const verdict: CapacityCall['verdict'] =
    data.verdict === 'trim' || data.verdict === 'add' || data.verdict === 'balanced'
      ? data.verdict
      : local.verdict;

  const reasoning = typeof data.reasoning === 'string' && data.reasoning.trim().length > 20
    ? data.reasoning.trim()
    : local.reasoning;

  // Trust our own capacity split, but keep the model's wording and ordering.
  return {
    discipline,
    capacity: {
      ...local,
      verdict: local.deferred.length > 0 ? 'trim' : verdict,
      reasoning,
    },
    source: 'remote',
  };
}

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

async function withTimeout(input: RequestInfo, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callPollinations(prompt: string): Promise<string> {
  const res = await withTimeout('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [{ role: 'user', content: prompt }],
temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`pollinations ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('empty pollinations reply');
  return text;
}

async function callOpenRouter(prompt: string, settings: AiSettings): Promise<string> {
  if (!settings.apiKey.trim()) throw new Error('no OpenRouter key set');
  const res = await withTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model || FREE_OPENROUTER_MODELS[0],
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('empty OpenRouter reply');
  return text;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function analyzePlan(
  yesterday: string,
  taskText: string,
  settings: AiSettings,
  overrideLevel: DisciplineLevel | null = null,
): Promise<PlanAnalysis> {
  const local = analyzeLocally(yesterday, taskText, overrideLevel);
  if (settings.provider === 'local') return local;

  try {
    const prompt = buildPrompt(yesterday, taskText);
    const reply = settings.provider === 'openrouter'
      ? await callOpenRouter(prompt, settings)
      : await callPollinations(prompt);
    const remote = parseModelReply(reply);
    // An explicit "push me harder" from the user outranks the model's read.
    return overrideLevel ? { ...local, source: 'remote' } : remote;
  } catch (err) {
    return {
      ...local,
      fallbackReason: err instanceof Error ? err.message : 'remote model unavailable',
    };
  }
}
