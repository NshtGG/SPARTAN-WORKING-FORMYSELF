import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Flame, MessageSquarePlus, Play, RotateCcw, ShieldCheck, Video, X } from 'lucide-react';
import SpartanMark from './SpartanMark';
import type { TaskItem } from '../types';
import PhotoProof from './PhotoProof';
import MusicPanel from './MusicPanel';
import BlockerPanel from './BlockerPanel';
import { ambientEngine } from '../utils/ambient';

type SessionPhase = 'setup' | 'running' | 'awaiting-proof' | 'complete';

export default function FocusSession({
  tasks,
  initialTask,
  onGoToChat,
  onSessionComplete,
}: {
  tasks: TaskItem[];
  initialTask: TaskItem | null;
  onGoToChat: () => void;
  onSessionComplete: (id: string) => void;
}) {
  const first = initialTask ?? tasks.find((t) => !t.completed) ?? tasks[0] ?? null;
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(first);
  const [phase, setPhase] = useState<SessionPhase>('setup');
  const [secondsLeft, setSecondsLeft] = useState((first?.sprintLength ?? 30) * 60);
  const [beforeVerified, setBeforeVerified] = useState(false);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  useEffect(() => {
    if (!initialTask || phase !== 'setup') return;
    setSelectedTask(initialTask);
    setSecondsLeft(initialTask.sprintLength * 60);
    setBeforeVerified(false);
    setAfterPhoto(null);
  }, [initialTask, phase]);

  useEffect(() => {
    if (!selectedTask && tasks.length > 0) {
      setSelectedTask(tasks[0]);
      setSecondsLeft(tasks[0].sprintLength * 60);
    }
  }, [tasks, selectedTask]);

  useEffect(() => {
    if (phase !== 'running') return;
    const interval = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(interval);
          setPhase('awaiting-proof');
          if ('vibrate' in navigator) navigator.vibrate([250, 120, 250]);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    return () => {
      ambientEngine.stop();
    };
  }, []);

  function selectTask(task: TaskItem) {
    setSelectedTask(task);
    setSecondsLeft(task.sprintLength * 60);
    setBeforeVerified(false);
    setAfterPhoto(null);
    setPhase('setup');
  }

  function confirmAbandon() {
    if (!selectedTask) return;
    ambientEngine.stop();
    setSecondsLeft(selectedTask.sprintLength * 60);
    setBeforeVerified(false);
    setAfterPhoto(null);
    setPhase('setup');
    setShowAbandonConfirm(false);
  }

  function resetSession() {
    if (!selectedTask) return;
    setSecondsLeft(selectedTask.sprintLength * 60);
    setBeforeVerified(false);
    setAfterPhoto(null);
    setPhase('setup');
  }

  if (!selectedTask) {
    return (
      <div className="h-full overflow-y-auto bg-transparent">
        <header className="sticky top-0 z-20 border-b border-blood/10 bg-void/55 px-5 pb-4 pt-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <SpartanMark size={44} />
            <div className="flex-1">
              <h1 className="text-[22px] font-black leading-none tracking-tight text-text">SPARTAN</h1>
              <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-text-muted">Focus chamber</p>
            </div>
          </div>
        </header>
        <div className="flex min-h-[75vh] flex-col items-center justify-center px-5 text-center animate-fade-up">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-blood/25 bg-surface/60 shadow-[0_0_45px_rgba(230,57,70,0.2)]">
            <Flame className="h-8 w-8 text-blood" />
          </div>
          <p className="eyebrow">NO OBJECTIVE</p>
          <h2 className="engraved mt-3 text-[30px] font-black leading-[1.05] tracking-tight text-text">
            THE CHAMBER<br />IS EMPTY.
          </h2>
          <p className="mx-auto mt-4 max-w-xs text-sm font-medium leading-6 text-text-dim">
            Build a plan first. Focus mode locks in only after you have tasks.
          </p>
          <button onClick={onGoToChat} className="red-button mt-8 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[12px]">
            <MessageSquarePlus className="h-4 w-4" /> BUILD A PLAN
          </button>
        </div>
      </div>
    );
  }

  const totalSeconds = Math.max(selectedTask.sprintLength * 60, 1);
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-transparent">
      <header className="sticky top-0 z-20 border-b border-blood/10 bg-void/55 px-5 pb-4 pt-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <SpartanMark size={44} />
          <div className="flex-1">
            <h1 className="text-[22px] font-black leading-none tracking-tight text-text">SPARTAN</h1>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-text-muted">Focus chamber</p>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${
            phase === 'running' ? 'border-blood/40 bg-blood/20 text-blood' : 'border-blood/15 bg-surface/60 text-text-muted'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${phase === 'running' ? 'animate-pulse bg-blood' : 'bg-text-muted'}`} />
            {phase === 'running' ? 'LOCKED' : 'STANDBY'}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 pb-16 pt-7">
        {phase === 'setup' && (
          <>
            <section className="animate-fade-up">
              <p className="eyebrow">CHOOSE THE OBJECTIVE</p>
              <h2 className="engraved mt-2 text-[34px] font-black leading-[1.02] tracking-tight text-text">
                ONE TASK.<br />NO RETREAT.
              </h2>
              <p className="mt-3 text-sm font-medium leading-6 text-text-dim">
                Sprint {selectedTask.sprintLength} minutes. Verified proof required before the clock starts.
              </p>
            </section>

            <div className="relative mt-7">
              <select
                value={selectedTask.id}
                onChange={(e) => {
                  const t = tasks.find((x) => x.id === e.target.value);
                  if (t) selectTask(t);
                }}
                className="glass w-full appearance-none rounded-2xl px-4 py-4 pr-12 text-[13px] font-bold text-text outline-none focus:border-blood/40"
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} — {t.sprintLength}m sprint</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blood" />
            </div>

            <div className="mt-4">
              <PhotoProof
                label="PHOTOGRAPH YOUR STARTING POINT"
                helper="Book, notes, screen, or workspace — whatever proves you're beginning this task."
                difficulty={selectedTask.difficulty}
                taskTitle={selectedTask.title}
                accentLabel="STARTING PROOF VERIFIED"
                onVerified={() => setBeforeVerified(true)}
              />
            </div>

            <div className="mt-4">
              <BlockerPanel />
            </div>

            <div className="mt-4">
              <MusicPanel />
            </div>

            <button
              onClick={() => setPhase('running')}
              disabled={!beforeVerified}
              className="red-button mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[13px] disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Play className="h-4 w-4 fill-current" /> BEGIN {selectedTask.sprintLength}-MINUTE SPRINT
            </button>
          </>
        )}

        {phase === 'running' && (
          <section className="animate-fade-up pt-2 text-center">
            <div className="mb-8">
              <p className="eyebrow">CURRENT OBJECTIVE</p>
              <h2 className="mx-auto mt-2 max-w-xs text-[24px] font-black leading-tight tracking-tight text-text">
                {selectedTask.title.toUpperCase()}
              </h2>
              {selectedTask.sprintCount > 1 && (
                <p className="mt-1 text-[11px] font-bold text-blood">Sprint in progress · {selectedTask.sprintCount} total for this task</p>
              )}
            </div>

            <div className="relative mx-auto h-[270px] w-[270px]">
              <div className="absolute inset-3 rounded-full bg-blood/12 blur-2xl" />
              <svg viewBox="0 0 120 120" className="relative h-full w-full -rotate-90 drop-shadow-[0_0_18px_rgba(230,57,70,0.35)]">
                <circle cx="60" cy="60" r="52" fill="rgba(13,7,8,0.7)" stroke="rgba(230,57,70,0.14)" strokeWidth="2" />
                <circle cx="60" cy="60" r="47" fill="none" stroke="rgba(230,57,70,0.15)" strokeWidth="4" />
                <circle
                  cx="60" cy="60" r="47" fill="none" stroke="#e63946" strokeWidth="4" strokeLinecap="round"
                  pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-text-muted">TIME REMAINS</p>
                <p className="mt-2 text-[52px] font-black tabular-nums leading-none tracking-[-0.04em] text-text">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-blood">
                  <ShieldCheck className="h-3.5 w-3.5" /> DISTRACTION SHIELD ON
                </div>
              </div>
            </div>

            <p className="mx-auto mt-6 max-w-[240px] text-[11px] font-semibold leading-5 text-text-muted">
              There is no pause. The sprint runs until it ends or you abandon it.
            </p>

            <div className="mt-6 flex items-center justify-center">
              <button
                onClick={() => setShowAbandonConfirm(true)}
                className="ghost-button flex items-center gap-2 rounded-2xl px-5 py-3 text-[11px] text-text-muted"
              >
                <X className="h-3.5 w-3.5" /> ABANDON SPRINT
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <MusicPanel />
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="mx-auto flex max-w-xs items-center gap-3 rounded-2xl border border-blood/12 bg-surface/65 p-3 text-left backdrop-blur-xl"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blood/20">
                  <Video className="h-5 w-5 text-blood" />
                </span>
                <span className="flex-1">
                  <span className="block text-xs font-bold text-text">LECTURE ACCESS</span>
                  <span className="mt-0.5 block text-[10px] font-medium text-text-muted">Search & videos allowed. Shorts blocked.</span>
                </span>
              </a>
            </div>
          </section>
        )}

        {phase === 'awaiting-proof' && (
          <section className="animate-fade-up pt-4 text-center">
            <p className="eyebrow">FINAL CHECKPOINT</p>
            <h2 className="engraved mt-2 text-[34px] font-black leading-tight tracking-tight text-text">SHOW THE WORK.</h2>
            <p className="mx-auto mt-3 max-w-xs text-sm font-medium leading-6 text-text-dim">
              One photo of the result. Completion is recorded only after verified proof.
            </p>
            <div className="mt-6">
              <PhotoProof
                label="PHOTOGRAPH THE RESULT"
                helper="Completed notes, finished screen, or the work itself."
                difficulty={selectedTask.difficulty}
                taskTitle={selectedTask.title}
                accentLabel="COMPLETION VERIFIED"
                onVerified={(dataUrl) => {
                  setAfterPhoto(dataUrl);
                  setPhase('complete');
                  onSessionComplete(selectedTask.id);
                  if ('vibrate' in navigator) navigator.vibrate(120);
                }}
              />
            </div>
          </section>
        )}

        {phase === 'complete' && (
          <section className="animate-fade-up pt-5 text-center">
            <div className="relative mx-auto h-52 max-w-sm overflow-hidden rounded-[24px] border border-blood/25 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
              <img src={afterPhoto ?? ''} alt="Completed work" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-void via-void/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-blood">
                <Check className="h-4 w-4" /> OBJECTIVE VERIFIED
              </div>
            </div>
            <p className="mt-7 eyebrow">SPRINT COMPLETE</p>
            <h2 className="mt-2 text-[38px] font-black leading-none tracking-tight text-text">VICTORY EARNED.</h2>
            <p className="mx-auto mt-3 max-w-xs text-sm font-medium leading-6 text-text-dim">
              The work is recorded. Recover, then take the next sprint or objective.
            </p>
            <button onClick={resetSession} className="ghost-button mt-7 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[13px]">
              <RotateCcw className="h-4 w-4 text-blood" /> PREPARE NEXT SESSION
            </button>
          </section>
        )}
      </div>

      {showAbandonConfirm && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass mx-4 mb-8 w-full max-w-sm rounded-[26px] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.7)] animate-fade-up">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blood/30 bg-blood/15">
              <AlertTriangle className="h-6 w-6 text-blood" />
            </div>
            <h3 className="text-center text-[16px] font-black text-text">Abandon this sprint?</h3>
            <p className="mt-2 text-center text-[11px] font-medium leading-5 text-text-dim">
              Progress on this sprint will be lost and it won't count toward completion. There's no shame in resuming later — but the clock resets now.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowAbandonConfirm(false)} className="ghost-button flex-1 rounded-2xl py-3 text-[11px]">
                KEEP GOING
              </button>
              <button onClick={confirmAbandon} className="red-button flex-1 rounded-2xl py-3 text-[11px]">
                ABANDON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
