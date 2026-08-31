import { CalendarClock, Coffee, MessageSquarePlus, Repeat } from 'lucide-react';
import type { DisciplineLevel, ScheduleBlock } from '../types';

export default function TimetableView({
  schedule,
  discipline,
  onGoToChat,
}: {
  schedule: ScheduleBlock[];
  discipline: DisciplineLevel;
  onGoToChat: () => void;
}) {
  const disciplineLabel = discipline === 'building' ? 'Rebuilding mode' : discipline === 'sharp' ? 'High intensity' : 'Balanced mode';

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-transparent">
      <header className="sticky top-0 z-20 border-b border-blood/10 bg-void/55 px-5 pb-4 pt-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img src="/images/spartan-emblem.png" alt="Spartan" className="h-11 w-11 rounded-2xl border border-blood/30 object-cover shadow-[0_0_18px_rgba(230,57,70,0.25)]" />
          <div className="flex-1">
            <h1 className="text-[22px] font-black leading-none tracking-tight text-text">SPARTAN</h1>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-text-muted">Timetable</p>
          </div>
          <CalendarClock className="h-5 w-5 text-blood" />
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 pb-16 pt-7">
        {schedule.length === 0 ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center animate-fade-up">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-blood/25 bg-surface/60 shadow-[0_0_45px_rgba(230,57,70,0.2)]">
              <CalendarClock className="h-8 w-8 text-blood" />
            </div>
            <p className="eyebrow">NO SCHEDULE</p>
            <h2 className="mt-3 text-[30px] font-black leading-[1.05] tracking-tight text-text">
              THE CLOCK<br />IS UNSET.
            </h2>
            <p className="mx-auto mt-4 max-w-xs text-sm font-medium leading-6 text-text-dim">
              Lock a plan in Command chat to see your minute-by-minute sequence here.
            </p>
            <button onClick={onGoToChat} className="red-button mt-8 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[12px]">
              <MessageSquarePlus className="h-4 w-4" /> BUILD TODAY'S PLAN
            </button>
          </div>
        ) : (
          <>
            <section className="animate-fade-up">
              <p className="eyebrow">{disciplineLabel.toUpperCase()}</p>
              <h2 className="mt-2 text-[32px] font-black leading-[1.02] tracking-tight text-text">
                MINUTE BY MINUTE.
              </h2>
              <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-text-dim">
                Sprints and recovery breaks, tuned to yesterday's discipline read.
              </p>
            </section>

            <section className="relative mt-8">
              <div className="absolute bottom-6 left-[23px] top-6 w-px bg-gradient-to-b from-blood/70 via-blood/25 to-transparent" />
              <div className="space-y-2.5">
                {schedule.map((block) => (
                  <div key={block.id} className="relative flex items-stretch gap-3 pl-12">
                    <div
                      className={`absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border ${
                        block.type === 'task' ? 'border-blood/45 bg-blood/25' : 'border-blood/10 bg-surface-3'
                      }`}
                    >
                      {block.type === 'task' ? <Repeat className="h-3.5 w-3.5 text-blood" /> : <Coffee className="h-3.5 w-3.5 text-text-muted" />}
                    </div>

                    <div
                      className={`glass flex-1 rounded-[18px] px-4 py-3 ${
                        block.type === 'break' ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[13px] font-bold leading-tight ${block.type === 'task' ? 'text-text' : 'text-text-dim'}`}>
                          {block.title}
                          {block.type === 'task' && block.sprintTotal && block.sprintTotal > 1 && (
                            <span className="ml-2 text-[10px] font-bold text-blood">Sprint {block.sprintIndex}/{block.sprintTotal}</span>
                          )}
                        </p>
                        <span className="shrink-0 text-[10px] font-black text-text-muted">{block.duration}m</span>
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-text-muted">
                        {formatRange(block.startMinutes, block.endMinutes)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function formatRange(start: number, end: number) {
  const fmt = (m: number) => {
    const h24 = Math.floor(m / 60) % 24;
    const min = m % 60;
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(min).padStart(2, '0')} ${period}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}
