/**
 * Intent understanding for the command chat.
 *
 * The bug this fixes: a message like "forget tomorrow, let's plan today" was
 * being fed straight into the task parser, so "let's plan out the day rather
 * than tomorrow" became a scheduled 9:00 AM task. Anything the user says is
 * now classified as an instruction OR as task content — never blindly both.
 */

export type Horizon = 'today' | 'tomorrow';

export type IntentKind =
  | 'set_horizon'      // "plan today instead", "make it tomorrow"
  | 'replace_tasks'    // "forget that, here's the real list"
  | 'add_tasks'        // plain task content
  | 'remove_task'      // "drop the gym"
  | 'lock'             // "lock it", "that's fine, go"
  | 'reset'            // "start over"
  | 'more_load'        // "give me more", "I can handle more"
  | 'less_load'        // "that's too much"
  | 'question'         // "what can you do?"
  | 'empty';

export interface Intent {
  kind: IntentKind;
  /** Task content left after instruction clauses are stripped out. */
  taskText: string;
  /** For remove_task: what they want gone. */
  removeTargets: string[];
  horizon?: Horizon;
}

/* ------------------------------------------------------------------ */
/* Clause splitting                                                    */
/* ------------------------------------------------------------------ */

/**
 * Split on sentence enders and on discourse connectives that separate an
 * instruction from content ("forget tomorrow, plan today" -> two clauses).
 */
export function splitClauses(text: string): string[] {
  return text
    .split(/(?:[.!?\n;:]+)|(?:\s+-\s+)|(?:,\s*(?=(?:first of all|firstly|second|secondly|also|and then|then|but|instead|rather|actually|just|i want|i need|lets|let's)\b))/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/* ------------------------------------------------------------------ */
/* Instruction patterns                                                */
/* ------------------------------------------------------------------ */

const TODAY_PATTERNS = [
  /\bplan\s+(?:out\s+)?(?:the\s+|my\s+|this\s+)?day\s+(?:for\s+)?today\b/i,
  /\b(?:for|about|do)\s+today\s+(?:instead|rather)\b/i,
  /\btoday\s+(?:instead|rather)\s+(?:of|than)\s+tomorrow\b/i,
  /\brather\s+than\s+tomorrow\b/i,
  /\binstead\s+of\s+tomorrow\b/i,
  /\bnot\s+tomorrow\b/i,
  /\bforget\s+tomorrow\b/i,
  /\bskip\s+tomorrow\b/i,
  /\bplan\s+(?:for\s+)?today\b/i,
  /\btoday\s*,?\s*not\s+tomorrow\b/i,
  /\bi\s+want\s+to\s+plan\s+today\b/i,
  /\bcan\s+we\s+do\s+today\b/i,
  /\bmake\s+it\s+today\b/i,
  /\bchange\s+it\s+to\s+today\b/i,
  /\bthis\s+day\b/i,
  /\bright\s+now\b/i,
];

const TOMORROW_PATTERNS = [
  /\bplan\s+(?:for\s+)?tomorrow\b/i,
  /\bmake\s+it\s+tomorrow\b/i,
  /\bchange\s+it\s+to\s+tomorrow\b/i,
  /\btomorrow\s+(?:instead|rather)\b/i,
  /\binstead\s+of\s+today\b/i,
  /\bnot\s+today\b/i,
  /\bforget\s+today\b/i,
  /\bnext\s+day\b/i,
];

const RESET_PATTERNS = [
  /\bstart\s+over\b/i,
  /\bstart\s+again\b/i,
  /\breset\b/i,
  /\bfrom\s+scratch\b/i,
  /\bscrap\s+(?:it|everything|the\s+whole\s+thing)\b/i,
  /\bnew\s+plan\b/i,
  /\bclear\s+everything\b/i,
];

const REPLACE_PATTERNS = [
  /\bforget\s+(?:what\s+i\s+said|that|those|it|everything|the\s+(?:last|previous)\s+\w+)\b/i,
  /\bignore\s+(?:what\s+i\s+said|that|those|it|everything)\b/i,
  /\bscratch\s+that\b/i,
  /\bnever\s*mind\b/i,
  /\bdisregard\s+that\b/i,
  /\breplace\s+(?:that|those|the\s+list)\b/i,
  /\bactually\s*,?\s*(?:here|these|the\s+real)\b/i,
];

const LOCK_PATTERNS = [
  /^(?:lock(?:\s+it)?(?:\s+in)?|go|do\s+it|confirm|commit|yes|yeah|yep|ok(?:ay)?|sure|fine|that'?s\s+(?:fine|good|it)|sounds?\s+good|perfect|looks?\s+good|proceed|continue)$/i,
  /\block\s+(?:it|the\s+plan|this)\b/i,
  /\bthat'?s\s+(?:all|everything|it)\b/i,
  /\bnothing\s+else\b/i,
  /\bi'?m\s+done\b/i,
];

const MORE_PATTERNS = [
  /\b(?:give|add)\s+me\s+more\b/i,
  /\bi\s+can\s+(?:do|handle|take)\s+more\b/i,
  /\bmore\s+tasks?\b/i,
  /\bpush\s+me\s+harder\b/i,
  /\btoo\s+(?:easy|light|little)\b/i,
  /\bnot\s+enough\b/i,
];

const LESS_PATTERNS = [
  /\btoo\s+(?:much|many|heavy|hard)\b/i,
  /\bcut\s+(?:it\s+)?down\b/i,
  /\bless\s+tasks?\b/i,
  /\breduce\s+(?:the\s+)?load\b/i,
  /\bcan'?t\s+do\s+(?:all\s+)?(?:that|this)\b/i,
];

const REMOVE_PATTERNS = [
  /\b(?:remove|delete|drop|take\s+out|get\s+rid\s+of|cancel)\s+(?:the\s+|my\s+)?(.+)/i,
  /\bno\s+(?:more\s+)?(.+?)\s+(?:today|tomorrow)\b/i,
];

const QUESTION_PATTERNS = [
  /^(?:what|how|why|who|when|where|can\s+you|could\s+you|do\s+you)\b.*\?$/i,
  /^\s*\?+\s*$/,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Talk *about* planning is not a task. "let's plan out the day" describes the
 * conversation, not work to schedule. Note this only strips "plan" when it
 * refers to the day itself — "plan the reunion" is a real task and survives.
 */
const META_PATTERNS = [
  /\bfirst\s+of\s+all\b/i,
  /\b(?:let'?s|lets)\b/i,
  /\bi\s+(?:just\s+)?(?:want|need|would\s+like|wanna)\s+(?:to|you\s+to)\b/i,
  /\bplan(?:ning)?\s+(?:out\s+)?(?:the|my|this)\s+(?:day|schedule|plan)\b/i,
  /\bplan\s+(?:out\s+)?(?:the\s+)?day\b/i,
  /\bmake\s+(?:me\s+)?(?:a|the)\s+(?:plan|schedule|timetable)\b/i,
  /\bset\s+(?:up\s+)?(?:the|my)\s+(?:day|schedule)\b/i,
];

const ALL_INSTRUCTION_PATTERNS = [
  ...TODAY_PATTERNS, ...TOMORROW_PATTERNS, ...RESET_PATTERNS,
  ...REPLACE_PATTERNS, ...LOCK_PATTERNS, ...MORE_PATTERNS, ...LESS_PATTERNS,
  ...META_PATTERNS,
];

/** A clause that is purely an instruction carries no task content. */
export function isInstructionClause(clause: string): boolean {
  return (
    matchesAny(clause, ALL_INSTRUCTION_PATTERNS) ||
    matchesAny(clause, QUESTION_PATTERNS)
  );
}

/**
 * Remove instruction phrases from a clause and return whatever real content
 * is left. "plan for today instead: study 2 hours" keeps "study 2 hours".
 */
export function stripInstructions(clause: string): string {
  let out = clause;
  for (const pattern of ALL_INSTRUCTION_PATTERNS) {
    out = out.replace(new RegExp(pattern.source, 'gi'), ' ');
  }
  return out
    // Only trim connectives at the edges — stripping them mid-clause would
    // merge "plan the reunion and gym" into a single bogus task.
    .replace(/^\s*(?:instead|rather|actually|please|just|also|and|but|so|then|ok(?:ay)?)\b/gi, ' ')
    .replace(/\b(?:instead|rather|actually|please|just|also|and|but|so|then)\s*$/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '')
    .trim();
}

/** Does this clause still say something worth scheduling? */
function hasContent(clause: string): boolean {
  const stripped = stripInstructions(clause);
  return stripped.length > 2 && /[a-z]{3}/i.test(stripped) && !isFiller(stripped);
}

/** Conversational filler that should never become a task on its own. */
const FILLER = [
  /^(?:first\s+of\s+all|firstly|secondly|also|and|but|so|well|ok(?:ay)?|hmm+|uh+|yeah|yes|no|hey|hi|hello)$/i,
  /^(?:i\s+(?:just\s+)?(?:want|need|would\s+like)\s*(?:to)?)$/i,
  /^(?:let'?s|lets)$/i,
  /^(?:the\s+)?day$/i,
  /^(?:plan|do|go|make|start|schedule|it|this|that)$/i,
  /^(?:out\s+)?(?:the\s+)?(?:day|plan|schedule)$/i,
  /^(?:thanks?|thank\s+you|please)$/i,
];

export function isFiller(clause: string): boolean {
  const t = clause.trim();
  if (t.length < 2) return true;
  return FILLER.some((p) => p.test(t));
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

export function classifyIntent(raw: string): Intent {
  const text = raw.trim();
  if (!text) {
    return { kind: 'empty', taskText: '', removeTargets: [] };
  }

  const clauses = splitClauses(text);

  // Keep any clause that still says something after instructions are removed.
  const contentClauses = clauses
    .filter((c) => !isFiller(c) && hasContent(c))
    .map((c) => stripInstructions(c))
    .filter((c) => c.length > 0);
  const taskText = contentClauses.join('\n');

  const wantsToday = matchesAny(text, TODAY_PATTERNS);
  const wantsTomorrow = matchesAny(text, TOMORROW_PATTERNS);

  // Reset beats everything — it throws the whole conversation away.
  if (matchesAny(text, RESET_PATTERNS)) {
    return { kind: 'reset', taskText, removeTargets: [] };
  }

  // Horizon changes are the headline fix: never treat these as tasks.
  if (wantsToday || wantsTomorrow) {
    return {
      kind: 'set_horizon',
      horizon: wantsToday ? 'today' : 'tomorrow',
      taskText,
      removeTargets: [],
    };
  }

  // A genuine question, asked as a question.
  if (text.trim().endsWith('?') && matchesAny(text, QUESTION_PATTERNS)) {
    return { kind: 'question', taskText: '', removeTargets: [] };
  }

  if (matchesAny(text, REPLACE_PATTERNS)) {
    return { kind: 'replace_tasks', taskText, removeTargets: [] };
  }

  // Removal only counts when it names something, and isn't a whole task list.
  for (const pattern of REMOVE_PATTERNS) {
    const m = text.match(pattern);
    if (m && m[1]) {
      const targets = m[1]
        .split(/,|\band\b/i)
        .map((s) => s.trim().replace(/[.!?]+$/, ''))
        .filter((s) => s.length > 1);
      if (targets.length > 0) {
        return { kind: 'remove_task', taskText: '', removeTargets: targets };
      }
    }
  }

  if (matchesAny(text, MORE_PATTERNS)) {
    return { kind: 'more_load', taskText, removeTargets: [] };
  }

  if (matchesAny(text, LESS_PATTERNS)) {
    return { kind: 'less_load', taskText, removeTargets: [] };
  }

  // Lock only when there's nothing else of substance in the message.
  if (matchesAny(text, LOCK_PATTERNS) && contentClauses.length === 0) {
    return { kind: 'lock', taskText: '', removeTargets: [] };
  }

  if (matchesAny(text, QUESTION_PATTERNS) && contentClauses.length === 0) {
    return { kind: 'question', taskText: '', removeTargets: [] };
  }

  return { kind: 'add_tasks', taskText: taskText || text, removeTargets: [] };
}

/* ------------------------------------------------------------------ */
/* Scheduling helpers                                                  */
/* ------------------------------------------------------------------ */

/** Where the day's schedule should start, given the horizon. */
export function startMinutesFor(horizon: Horizon, now: Date = new Date()): number {
  if (horizon === 'tomorrow') return 9 * 60;

  // Planning "today" means starting from the next quarter hour, not 9 AM.
  const minutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil((minutes + 5) / 15) * 15;
  // If it's already very late, fall back to a short evening block.
  return Math.min(rounded, 22 * 60);
}

export function horizonLabel(horizon: Horizon): string {
  return horizon === 'today' ? 'today' : 'tomorrow';
}

/** Minutes of usable time left, so a "today" plan can't overrun midnight. */
export function remainingMinutesToday(now: Date = new Date()): number {
  const end = 23 * 60; // wind down by 11pm
  const start = startMinutesFor('today', now);
  return Math.max(0, end - start);
}
