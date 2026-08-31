import type {
  CapacityCall,
  Difficulty,
  DisciplineLevel,
  RawTask,
  ScheduleBlock,
  TaskItem,
} from '../types';
import { formatClock, formatDuration } from '../types';

/* ------------------------------------------------------------------ */
/* Yesterday's debrief -> discipline level                             */
/* ------------------------------------------------------------------ */

const NEGATIVE_WORDS = [
  'nothing', 'scrolled', 'wasted', 'procrastinat', 'slept in', 'lazy', 'skipped',
  'missed', 'gave up', 'quit', "didn't do", 'did not do', 'phone all day', 'binge',
  'netflix', 'ignored', 'distracted', 'overslept', 'hungover', 'burnt out', 'burned out',
  'exhausted', 'sick', 'couldn\u2019t focus', 'couldnt focus', 'no energy', 'gave in',
];

const POSITIVE_WORDS = [
  'finished', 'completed', 'worked', 'studied', 'trained', 'exercised', 'read', 'wrote',
  'built', 'shipped', 'practiced', 'gym', 'planned', 'organized', 'focused',
  'accomplished', 'ran', 'meditated', 'deep work', 'productive', 'crushed', 'nailed',
  'on time', 'woke up early',
];

export function analyzeDiscipline(text: string): DisciplineLevel {
  const lowered = text.toLowerCase();
  let score = 0;
  NEGATIVE_WORDS.forEach((w) => { if (lowered.includes(w)) score -= 1; });
  POSITIVE_WORDS.forEach((w) => { if (lowered.includes(w)) score += 1; });
  if (lowered.trim().length < 12) score -= 1;
  if (score <= -1) return 'building';
  if (score >= 2) return 'sharp';
  return 'steady';
}

export function disciplineCopy(level: DisciplineLevel): string {
  if (level === 'building') {
    return "Yesterday had gaps. That's data, not a verdict \u2014 today we rebuild traction with short sprints and real breaks.";
  }
  if (level === 'sharp') {
    return 'Yesterday shows real discipline. You get longer uninterrupted blocks tomorrow \u2014 you earned the trust.';
  }
  return "Yesterday was steady. We'll balance solid work blocks against enough recovery to keep the streak alive.";
}

/* ------------------------------------------------------------------ */
/* Capacity model                                                      */
/* ------------------------------------------------------------------ */

export function sprintProfile(level: DisciplineLevel) {
  if (level === 'building') return { work: 25, rest: 10 };
  if (level === 'sharp') return { work: 75, rest: 5 };
  return { work: 45, rest: 8 };
}

/** Realistic focused-work budget and task ceiling for each discipline level. */
export function capacityProfile(level: DisciplineLevel) {
  if (level === 'building') return { minutes: 180, maxTasks: 3 };
  if (level === 'sharp') return { minutes: 420, maxTasks: 7 };
  return { minutes: 300, maxTasks: 5 };
}

/* ------------------------------------------------------------------ */
/* Task understanding                                                  */
/* ------------------------------------------------------------------ */

const HARD_TERMS = ['study', 'exam', 'project', 'research', 'code', 'coding', 'deep', 'write',
  'writing', 'thesis', 'analysis', 'design', 'chemistry', 'physics', 'math', 'revise',
  'revision', 'assignment', 'portfolio', 'edit', 'build', 'debug', 'prepare', 'learn'];
const EASY_TERMS = ['email', 'call', 'bank', 'message', 'check', 'paperwork', 'buy', 'errand',
  'clean', 'organize', 'reply', 'text', 'pay', 'book', 'laundry', 'dishes', 'groceries',
  'water', 'tidy', 'sort'];
const IRON_TERMS = ['workout', 'gym', 'lift', 'run', 'training', 'sprint', 'marathon',
  'exercise', 'cardio', 'swim', 'cycle', 'yoga', 'boxing'];

export const BASE_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 25, medium: 60, hard: 105, iron: 75,
};

/** Pull an explicit duration out of the text, e.g. "gym 90 min", "study 2 hours". */
export function extractDuration(text: string): number | null {
  const lowered = text.toLowerCase();

  const hoursAndMins = lowered.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\s*(\d+)\s*(?:m|min|mins|minutes)?/);
  if (hoursAndMins) {
    return Math.round(parseFloat(hoursAndMins[1]) * 60 + parseInt(hoursAndMins[2], 10));
  }

  const hours = lowered.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hr\b|hrs\b|hour|hours)/);
  if (hours) return Math.round(parseFloat(hours[1]) * 60);

  const halfHour = lowered.match(/half\s*(?:an\s*)?hour/);
  if (halfHour) return 30;

  const mins = lowered.match(/(\d+)\s*(?:m\b|min\b|mins\b|minute|minutes)/);
  if (mins) return parseInt(mins[1], 10);

  return null;
}

/**
 * Phrases that would otherwise be misread by single-word matching.
 * "run errands" is not a workout; "read up on X" is not light work.
 */
const PHRASE_OVERRIDES: { pattern: RegExp; difficulty: Difficulty }[] = [
  { pattern: /\brun\s+(?:some\s+)?errands?\b/, difficulty: 'easy' },
  { pattern: /\brunning\s+(?:some\s+)?errands?\b/, difficulty: 'easy' },
  { pattern: /\bread\s+(?:up\s+on|through)\b/, difficulty: 'hard' },
  { pattern: /\bcall\s+(?:with|the)\s+(?:client|team|boss)\b/, difficulty: 'medium' },
];

/** Match whole words only — 'read' must not fire on 'already'. */
function hasWord(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}`, 'i').test(haystack);
}

export function classifyDifficulty(title: string): Difficulty {
  const n = title.toLowerCase();

  for (const { pattern, difficulty } of PHRASE_OVERRIDES) {
    if (pattern.test(n)) return difficulty;
  }

  if (IRON_TERMS.some((w) => hasWord(n, w))) return 'iron';
  if (HARD_TERMS.some((w) => hasWord(n, w))) return 'hard';
  if (EASY_TERMS.some((w) => hasWord(n, w))) return 'easy';
  return 'medium';
}

function tidyTitle(raw: string): string {
  let t = raw.trim()
    .replace(/^[-*\u2022.\s]+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^(?:i\s+)?(?:want to|need to|have to|gotta|should|must|plan to|will)\s+/i, '')
    .replace(/[.\s]+$/, '')
    .trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Read an open-ended message into however many tasks it actually contains.
 * No fixed cap — the calibration step decides what survives.
 */
export function parseTasks(text: string): RawTask[] {
  const chunks = text
    .split(/\n|[,;]|\band then\b|\balso\b|\band\b|\bplus\b|\d+[.)]/i)
    .map(tidyTitle)
    .filter((item) => item.length > 1 && /[a-z]/i.test(item));

  const seen = new Set<string>();
  const tasks: RawTask[] = [];

  for (const title of chunks) {
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const difficulty = classifyDifficulty(title);
    const explicit = extractDuration(title);
    const estimate = explicit && explicit >= 5 && explicit <= 480
      ? Math.round(explicit / 5) * 5
      : BASE_BY_DIFFICULTY[difficulty];

    tasks.push({ title, difficulty, estimate });
  }

  return tasks;
}

/* ------------------------------------------------------------------ */
/* Calibration: is this day too heavy, too light, or right?            */
/* ------------------------------------------------------------------ */

/** Hardest work first — that ordering is the whole point of the app. */
const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { hard: 0, iron: 1, medium: 2, easy: 3 };

export function calibrateLoad(tasks: RawTask[], level: DisciplineLevel): CapacityCall {
  const { minutes: capacityMinutes, maxTasks } = capacityProfile(level);

  const ordered = [...tasks].sort(
    (a, b) => DIFFICULTY_WEIGHT[a.difficulty] - DIFFICULTY_WEIGHT[b.difficulty],
  );

  const proposedMinutes = ordered.reduce((sum, t) => sum + t.estimate, 0);

  const accepted: RawTask[] = [];
  const deferred: RawTask[] = [];
  let running = 0;

  for (const task of ordered) {
    const overTime = running + task.estimate > capacityMinutes;
    const overCount = accepted.length >= maxTasks;
    // Always keep at least one task, even if a single item blows the budget.
    if ((overTime || overCount) && accepted.length > 0) {
      deferred.push(task);
    } else {
      accepted.push(task);
      running += task.estimate;
    }
  }

  const remaining = capacityMinutes - running;
  const roomForMore = deferred.length > 0
    ? 0
    : Math.max(0, Math.min(maxTasks - accepted.length, Math.floor(remaining / 45)));

  let verdict: CapacityCall['verdict'] = 'balanced';
  if (deferred.length > 0) verdict = 'trim';
  else if (running < capacityMinutes * 0.55 && roomForMore > 0) verdict = 'add';

  return {
    verdict,
    accepted,
    deferred,
    roomForMore,
    proposedMinutes,
    capacityMinutes,
    reasoning: buildReasoning(verdict, {
      accepted, deferred, roomForMore, proposedMinutes, capacityMinutes, level,
    }),
  };
}

function buildReasoning(
  verdict: CapacityCall['verdict'],
  ctx: {
    accepted: RawTask[];
    deferred: RawTask[];
    roomForMore: number;
    proposedMinutes: number;
    capacityMinutes: number;
    level: DisciplineLevel;
  },
): string {
  const { accepted, deferred, roomForMore, proposedMinutes, capacityMinutes, level } = ctx;
  const modeWord = level === 'building' ? 'rebuilding' : level === 'sharp' ? 'high-intensity' : 'steady';
  const proposed = formatDuration(proposedMinutes);
  const cap = formatDuration(capacityMinutes);

  if (verdict === 'trim') {
    const names = deferred.map((t) => t.title).join(', ');
    return `You gave me ${formatDuration(proposedMinutes)} of work. In ${modeWord} mode your realistic ceiling is ${cap} of focused time, so this is an overload \u2014 and an overloaded plan is the fastest way to finish the day having done none of it.\n\nI'm cutting ${deferred.length} item${deferred.length > 1 ? 's' : ''}: ${names}. ${deferred.length > 1 ? 'They move' : 'It moves'} to the next day. What's left is the part that actually matters, hardest first.`;
  }

  if (verdict === 'add') {
    return `That's only ${proposed} against a ${cap} ceiling \u2014 you're under-loading yourself. In ${modeWord} mode you can carry about ${roomForMore} more real task${roomForMore > 1 ? 's' : ''} without breaking.\n\nAdd ${roomForMore > 1 ? 'them' : 'one'} now, or say "lock it" and I'll build the day as it stands. Your call \u2014 but an easy day is a wasted one.`;
  }

  return `${accepted.length} task${accepted.length > 1 ? 's' : ''}, ${proposed} of focused work against a ${cap} ceiling. That's a properly loaded day for ${modeWord} mode \u2014 demanding without being fantasy.\n\nHardest work goes first, while your attention is worth something.`;
}

/* ------------------------------------------------------------------ */
/* Schedule building                                                   */
/* ------------------------------------------------------------------ */

const DAY_START = 9 * 60; // 9:00 AM

export function buildPlan(
  rawTasks: RawTask[],
  discipline: DisciplineLevel,
  startMinutes: number = DAY_START,
): { tasks: TaskItem[]; schedule: ScheduleBlock[] } {
  const { work, rest } = sprintProfile(discipline);

  let cursor = startMinutes;
  const tasks: TaskItem[] = [];
  const schedule: ScheduleBlock[] = [];
  const stamp = Date.now();

  rawTasks.forEach((raw, taskIndex) => {
    const totalDuration = raw.estimate;
    const sprintCount = Math.max(1, Math.round(totalDuration / work));
    const perSprint = Math.max(5, Math.round(totalDuration / sprintCount / 5) * 5);
    const taskId = `${stamp}-${taskIndex}`;

    for (let s = 0; s < sprintCount; s++) {
      const sprintStart = cursor;
      const sprintEnd = sprintStart + perSprint;
      schedule.push({
        id: `${taskId}-sprint-${s}`,
        type: 'task',
        taskId,
        title: raw.title,
        startMinutes: sprintStart,
        endMinutes: sprintEnd,
        duration: perSprint,
        sprintIndex: s + 1,
        sprintTotal: sprintCount,
        difficulty: raw.difficulty,
      });
      cursor = sprintEnd;

      const isLast = taskIndex === rawTasks.length - 1 && s === sprintCount - 1;
      if (!isLast) {
        schedule.push({
          id: `${taskId}-break-${s}`,
          type: 'break',
          title: 'Recovery break',
          startMinutes: cursor,
          endMinutes: cursor + rest,
          duration: rest,
        });
        cursor += rest;
      }
    }

    tasks.push({
      id: taskId,
      title: raw.title,
      difficulty: raw.difficulty,
      energy: raw.difficulty === 'hard' || raw.difficulty === 'iron'
        ? 'high'
        : raw.difficulty === 'easy' ? 'low' : 'medium',
      totalDuration,
      sprintLength: perSprint,
      sprintCount,
      timeBlock: '',
      completed: false,
    });
  });

  tasks.forEach((task) => {
    const blocks = schedule.filter((b) => b.taskId === task.id);
    const start = blocks[0]?.startMinutes ?? 0;
    const end = blocks[blocks.length - 1]?.endMinutes ?? 0;
    task.timeBlock = `${formatClock(start)} \u2013 ${formatClock(end)}`;
  });

  return { tasks, schedule };
}
