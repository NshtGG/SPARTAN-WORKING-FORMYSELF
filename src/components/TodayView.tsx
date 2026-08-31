import { CalendarCheck, Check, Circle, Flame, MessageSquarePlus, Sunrise, X } from 'lucide-react';
import SpartanMark from './SpartanMark';
import type { DisciplineLevel, TaskItem } from '../types';
import { formatDuration } from '../types';

/**
 * TODAY — the reality tab.
 *
 * This is deliberately not a timetable. The Board says what you're meant to do;
 * this says what actually happened. It closes the loop with a button back into
 * the command chat to plan the next day.
 */
export default function TodayView({
  tasks,
  discipline,
  horizonLabel,
  onPlanNext,
}: {
  tasks: TaskItem[];
  discipline: DisciplineLevel;
  horizonLabel: string;
  onPlanNext: () => void;
}) {
  const done = tasks.filter((t) => t.completed);
  const missed = tasks.filter((t) => !t.completed);
  const doneMinutes = done.reduce((s, t) => s + t.totalDuration, 0);
  const totalMinutes = tasks.reduce((s, t) => s + t.totalDuration, 0);
  const rate = tasks.length === 0 ? 0 : Math.round((done.length / tasks.length) * 100);

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date());

  const verdict =
    tasks.length === 0
      ? 'Nothing was committed, so nothing can be counted.'
      : rate === 100
        ? 'Everything you committed to got done. That is what a full day looks like.'
        : rate >= 60
          ? 'Most of it landed. The gap is the part worth looking at honestly.'
          : rate > 0
            ? 'More was left than finished. Not a disaster — but tomorrow gets calibrated off this.'
            : 'Nothing got finished. That goes into the next plan, and the next plan gets lighter.';

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-transparent">
      <header className="sticky top-0 z-20 border-b border-blood/10 bg-void/55 px-5 pb-4 pt-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <SpartanMark size={44} />
          <div className="flex-1">
            <h1 className="text-[22px] font-black leading-none tracking-tight text-text">SPARTAN</h1>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-text-muted">Today · reality</p>
          </div>
          <CalendarCheck className="h-5 w-5 text-blood" />
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 pb-16 pt-7">
        {tasks.length === 0 ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center animate-fade-up">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-blood/25 bg-surface/60 shadow-[0_0_45px_rgba(230,57,70,0.2)]">
              <Flame className="h-8 w-8 text-blood" />
            </div>
            <p className="eyebrow">NOTHING RECORDED</p>
            <h2 className="engraved mt-3 text-[30px] font-black leading-[1.05] tracking-tight text-text">
              NO DAY<br />TO ACCOUNT FOR.
            </h2>
            <p className="mx-auto mt-4 max-w-xs text-sm font-medium leading-6 text-text-dim">
              Lock a plan in Command and this page fills with what you actually did.
            </p>
            <button onClick={onPlanNext} className="red-button mt-8 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[12px]">
              <MessageSquarePlus className="h-4 w-4" /> BUILD A PLAN
            </button>
          </div>
        ) : (
          <>
            <section className="animate-fade-up">
              <p className="eyebrow">{dateLabel.toUpperCase()}</p>
              <h2 className="engraved mt-2 text-[34px] font-black leading-[1.02] tracking-tight text-text">
                WHAT ACTUALLY<br />HAPPENED.
              </h2>
            </section>

            <section className="glass ornate bracketed mt-7 rounded-[24px] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">Completion</p>
                  <p className="mt-1 text-sm font-bold text-text">{done.length} of {tasks.length} finished</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-text-muted">
                    {formatDuration(doneMinutes)} of {formatDuration(totalMinutes)} committed
                  </p>
                </div>
                <span className="text-[38px] font-black tracking-tighter text-blood">{rate}%</span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-4/50">
                <div className="h-full rounded-full bg-gradient-to-r from-blood-soft to-blood-bright transition-all duration-700" style={{ width: `${rate}%` }} />
              </div>
              <p className="mt-4 text-[11px] font-medium leading-5 text-text-dim">{verdict}</p>
            </section>

            {done.length > 0 && (
              <section className="mt-8">
                <p className="eyebrow">FINISHED</p>
                <div className="mt-3 space-y-2">
                  {done.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-blood/12 bg-surface-3/40 p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blood text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-text">{task.title}</span>
                        <span className="block text-[10px] font-semibold text-text-muted">{formatDuration(task.totalDuration)} · {task.timeBlock}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {missed.length > 0 && (
              <section className="mt-7">
                <p className="eyebrow">LEFT UNDONE</p>
                <div className="mt-3 space-y-2">
                  {missed.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-blood/8 bg-void/40 p-3 opacity-75">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blood/20 text-text-muted">
                        <Circle className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-text-dim">{task.title}</span>
                        <span className="block text-[10px] font-semibold text-text-muted">{formatDuration(task.totalDuration)} not done</span>
                      </span>
                      <X className="h-3.5 w-3.5 shrink-0 text-blood/60" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="divider-ornate mt-10" />

            <section className="mt-6">
              <p className="text-[11px] font-semibold leading-5 text-text-muted">
                This record is what sets your next capacity. Discipline read: <span className="font-black uppercase text-blood">{discipline}</span>.
              </p>
              <button
                onClick={onPlanNext}
                className="red-button mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[13px]"
              >
                <Sunrise className="h-4 w-4" /> PLAN {horizonLabel.toUpperCase()}
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
