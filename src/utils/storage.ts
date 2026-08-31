import type { DisciplineLevel, ScheduleBlock, TaskItem } from '../types';
import { DEFAULT_AI_SETTINGS, type AiSettings } from './ai';

/**
 * Everything the app knows lives in localStorage on the device.
 * No account, no login, no server. Clearing app data clears the plan.
 */

const PLAN_KEY = 'spartan.plan.v1';
const AI_KEY = 'spartan.ai.v1';
const CHAT_KEY = 'spartan.chat.v1';

export interface PersistedPlan {
  tasks: TaskItem[];
  schedule: ScheduleBlock[];
  discipline: DisciplineLevel;
  /** ISO date the plan was built for. */
  savedAt: string;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage disabled or full — the app still works, it just won't persist */
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadPlan(): PersistedPlan | null {
  const raw = safeGet(PLAN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedPlan;
    if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.schedule)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePlan(plan: PersistedPlan): void {
  safeSet(PLAN_KEY, JSON.stringify(plan));
}

export function clearPlan(): void {
  safeRemove(PLAN_KEY);
  safeRemove(CHAT_KEY);
}

export function loadAiSettings(): AiSettings {
  const raw = safeGet(AI_KEY);
  if (!raw) return { ...DEFAULT_AI_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      provider: parsed.provider === 'openrouter' || parsed.provider === 'pollinations'
        ? parsed.provider
        : 'local',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' && parsed.model
        ? parsed.model
        : DEFAULT_AI_SETTINGS.model,
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(settings: AiSettings): void {
  safeSet(AI_KEY, JSON.stringify(settings));
}

export function loadChat<T>(): T | null {
  const raw = safeGet(CHAT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveChat(value: unknown): void {
  safeSet(CHAT_KEY, JSON.stringify(value));
}
