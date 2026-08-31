export type Difficulty = 'easy' | 'medium' | 'hard' | 'iron';
export type EnergyLoad = 'low' | 'medium' | 'high';
export type DisciplineLevel = 'building' | 'steady' | 'sharp';

/** What the calibration engine decided about the user's proposed workload. */
export type LoadVerdict = 'trim' | 'balanced' | 'add';

export interface TaskItem {
  id: string;
  title: string;
  difficulty: Difficulty;
  energy: EnergyLoad;
  totalDuration: number;
  sprintLength: number;
  sprintCount: number;
  timeBlock: string;
  completed: boolean;
}

export interface ScheduleBlock {
  id: string;
  type: 'task' | 'break';
  taskId?: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  duration: number;
  sprintIndex?: number;
  sprintTotal?: number;
  difficulty?: Difficulty;
}

/** A task as first understood, before scheduling. */
export interface RawTask {
  title: string;
  difficulty: Difficulty;
  /** Estimated minutes of real work this needs. */
  estimate: number;
}

/** The engine's read on whether the proposed day is too heavy, too light, or right. */
export interface CapacityCall {
  verdict: LoadVerdict;
  accepted: RawTask[];
  deferred: RawTask[];
  roomForMore: number;
  proposedMinutes: number;
  capacityMinutes: number;
  reasoning: string;
}

export function formatClock(minutesFromMidnight: number): string {
  const h24 = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
