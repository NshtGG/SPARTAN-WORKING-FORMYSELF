import { ArrowUpRight, CalendarDays, Check, Clock3, Flame, Layers, MessageSquarePlus, Sparkles } from 'lucide-react';
import SpartanMark from './SpartanMark';
import type { TaskItem } from '../types';

export default function PlanBoard({
  tasks,
  onStartFocus,
  onGoToChat,
  onToggleComplete,
}: {
  tasks: TaskItem[];
  onStartFocus: (task: TaskItem) => void;
  onGoToChat: () => void;
  onToggleComplete: (id: string) => void;
}) {
  const completed = tasks.filter((task) => task.completed).length;
  const progress = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-transparent">
      <header className="sticky top-0 z-20 border-b border-blood/10 bg-void/55 px-5 pb-4 pt-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <SpartanMark size={44} />
          <div className="flex-1">
            <h1 className="text-[22px] font-black leading-none tracking-tight text-text">SPARTAN</h1>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-text-muted">Command board</p>
          </div>
          <CalendarDays className="h-5 w-5 text-blood" />
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 pb-16 pt-7">
        {tasks.length === 0 ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center animate-fade-up">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-blood/25 bg-surface/60 shadow-[0_0_45px_rgba(230,57,70,0.2)]">
              <Flame className="h-8 w-8 text-blood" />
            </div>
            <p className="eyebrow">NO PLAN YET</p>
            <h2 className="engraved mt-3 text-[30px] font-black leading-[1.05] tracking-tight text-text">
              THE DAY IS<br />UNCLAIMED.
            </h2>
            <p className="mx-auto mt-4 max-w-xs text-sm font-medium leading-6 text-text-dim">
              Open the command chat and account for yesterday. Your board fills automatically once the plan locks.
            </p>
            <button onClick={onGoToChat} className="red-button mt-8 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[12px]">
              <MessageSquarePlus className="h-4 w-4" /> BUILD TODAY'S PLAN
            </button>
          </div>
        ) : (
          <>
            <section className="animate-fade-up">
              <p className="eyebrow">{today.toUpperCase()}</p>
              <h2 className="engraved mt-2 text-[34px] font-black leading-[1.02] tracking-tight text-text">
                YOUR OBJECTIVES.<br />NO RETREAT.
              </h2>
              <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-text-dim">
                Start with the hardest. Momentum takes the rest.
              </p>
            </section>

            <section className="glass ornate bracketed mt-7 rounded-[24px] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-muted">Daily advance</p>
                  <p className="mt-1 text-sm font-bold text-text">{completed} of {tasks.length} complete</p>
                </div>
                <span className="text-[34px] font-black tracking-tighter text-blood">{progress}%</span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-4/50">
                <div className="h-full rounded-full bg-gradient-to-r from-blood-soft to-blood-bright transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
            </section>

            <section className="mt-9">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="eyebrow">TODAY'S OBJECTIVES</p>
                  <h3 className="mt-1 text-[22px] font-black tracking-tight text-text">TASK BOARD</h3>
                </div>
                <Sparkles className="h-4 w-4 text-blood" />
              </div>

              <div className="space-y-3">
                {tasks.map((task, index) => (
                  <article key={task.id} className={`glass relative rounded-[22px] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.99] ${task.completed ? 'opacity-55' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <button
                          onClick={() => onToggleComplete(task.id)}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black transition ${
                            task.completed
                              ? 'border-blood/55 bg-blood text-white'
                              : index === 0
                                ? 'border-blood/45 bg-blood/25 text-text shadow-[0_0_18px_rgba(230,57,70,0.35)]'
                                : 'border-blood/15 bg-surface text-text-muted hover:border-blood/35'
                          }`}
                        >
                          {task.completed ? <Check className="h-3.5 w-3.5" /> : String(index + 1).padStart(2, '0')}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blood">{task.difficulty}</p>
                          <h4 className={`mt-1.5 text-[15px] font-bold leading-5 text-text ${task.completed ? 'line-through' : ''}`}>{task.title}</h4>
                        </div>
                      </div>
                      <button onClick={() => onStartFocus(task)} className="red-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" aria-label={`Focus on ${task.title}`}>
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-blood/10 pt-3 text-[10px] font-semibold text-text-muted">
                      <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-blood" />{task.timeBlock}</span>
                      <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-blood" />{task.sprintCount} sprint{task.sprintCount > 1 ? 's' : ''}</span>
                      <span className="font-black uppercase tracking-wider text-text-dim">{task.energy} load</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <div className="divider-ornate mt-10" />
            <p className="mt-5 px-1 text-[11px] font-semibold leading-5 text-text-muted">
              Every task is broken into sprints tuned to how disciplined yesterday was. See the exact sequence in Timetable.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
