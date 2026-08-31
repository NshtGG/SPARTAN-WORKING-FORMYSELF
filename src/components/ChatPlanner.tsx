import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Download, Paperclip, Settings2, Sparkles, User, X } from 'lucide-react';
import SpartanMark from './SpartanMark';
import type { CapacityCall, DisciplineLevel, RawTask, ScheduleBlock, TaskItem } from '../types';
import { formatDuration } from '../types';
import { buildPlan, disciplineCopy } from '../utils/planner';
import { classifyIntent, horizonLabel, startMinutesFor, type Horizon } from '../utils/intent';
import { analyzePlan, type AiSettings } from '../utils/ai';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  time: string;
  attachment?: { name: string; size: number };
}

type PlannerStep = 'yesterday' | 'tasks' | 'calibrate' | 'locked';

const OPENING = "Before we plan tomorrow, account for today. What did you actually get done, and where did you lose time? Be honest \u2014 I calibrate tomorrow off this.";

function taskPrompt(horizon: Horizon): string {
  return `Now tell me: what do you want to get done ${horizonLabel(horizon)}?\n\nList everything on your mind \u2014 one thing or ten, however it comes out. Don't pre-filter it. I'll work out how much of it you can actually carry.`;
}

export default function ChatPlanner({
  onPlanCreated,
  hasPlan,
  aiSettings,
  onOpenSettings,
}: {
  onPlanCreated: (tasks: TaskItem[], schedule: ScheduleBlock[], discipline: DisciplineLevel, horizon: Horizon) => void;
  hasPlan: boolean;
  aiSettings: AiSettings;
  onOpenSettings: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'opening', role: 'ai', text: OPENING, time: 'Now' },
  ]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState<PlannerStep>(hasPlan ? 'locked' : 'yesterday');
  const [yesterdayText, setYesterdayText] = useState('');
  const [taskText, setTaskText] = useState('');
  const [discipline, setDiscipline] = useState<DisciplineLevel>('steady');
  const [horizon, setHorizon] = useState<Horizon>('tomorrow');
  const [capacity, setCapacity] = useState<CapacityCall | null>(null);
  const [draftTasks, setDraftTasks] = useState<TaskItem[]>([]);
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; size: number } | null>(null);
  const [typing, setTyping] = useState(false);
  const [thinking, setThinking] = useState(false);
  const horizonRef = useRef<Horizon>('tomorrow');
  const forcedLevel = useRef<DisciplineLevel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, step, typing, capacity]);

  function stamp() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function addAi(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-ai-${Math.random()}`, role: 'ai', text, time: stamp() },
    ]);
  }

  function pushAi(text: string, delay = 600) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      addAi(text);
    }, delay);
  }

  /** Run the calibration engine over the full task text collected so far. */
  async function runCalibration(
    fullTaskText: string,
    yesterday: string,
    forHorizon: Horizon = horizonRef.current,
    overrideLevel: DisciplineLevel | null = forcedLevel.current,
  ) {
    if (!fullTaskText.trim()) {
      pushAi('Give me the tasks first and I\'ll size the day.', 450);
      setStep('tasks');
      return;
    }
    horizonRef.current = forHorizon;
    setThinking(true);
    setTyping(true);
    try {
      const analysis = await analyzePlan(yesterday, fullTaskText, aiSettings, overrideLevel);
      setDiscipline(analysis.discipline);
      setCapacity(analysis.capacity);

      const { tasks } = buildPlan(analysis.capacity.accepted, analysis.discipline, startMinutesFor(forHorizon));
      setDraftTasks(tasks);

      setTyping(false);
      addAi(analysis.capacity.reasoning);
      if (analysis.fallbackReason) {
        addAi(`(Remote model didn't answer \u2014 ${analysis.fallbackReason}. Used the on-device engine instead, so nothing is lost.)`);
      }
      setStep('calibrate');
    } catch {
      setTyping(false);
      addAi("Something went wrong reading that. Write the tasks again, one per line.");
      setStep('tasks');
    } finally {
      setThinking(false);
    }
  }

  function submitMessage(rawValue?: string) {
    const value = (rawValue ?? input).trim();
    if (!value && !pendingAttachment) return;
    if (thinking) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-user`,
        role: 'user',
        text: value || '(attachment)',
        time: stamp(),
        attachment: pendingAttachment ?? undefined,
      },
    ]);
    setInput('');
    setPendingAttachment(null);

    const intent = classifyIntent(value);

    // Instructions are handled as instructions at every step — this is what
    // stopped "forget tomorrow, plan today" from becoming a 9 AM task.
    if (intent.kind === 'reset') {
      resetPlanner(false);
      pushAi('Wiped. Start again: how did today actually go?', 500);
      return;
    }

    if (intent.kind === 'set_horizon' && intent.horizon) {
      const next = intent.horizon;
      horizonRef.current = next;
      setHorizon(next);

      const extra = intent.taskText.trim();
      if (step === 'yesterday') {
        pushAi(`Understood \u2014 planning ${horizonLabel(next)}, not ${horizonLabel(next === 'today' ? 'tomorrow' : 'today')}.\n\nI still need the debrief first. How has ${next === 'today' ? 'yesterday' : 'today'} gone so far?`, 600);
        return;
      }

      if (extra) {
        const merged = taskText ? `${taskText}\n${extra}` : extra;
        setTaskText(merged);
        pushAi(`Switching to ${horizonLabel(next)}. Re-running the numbers${next === 'today' ? ' from right now' : ''}.`, 450);
        void runCalibration(merged, yesterdayText, next);
        return;
      }

      if (taskText) {
        pushAi(`Switching to ${horizonLabel(next)}. ${next === 'today' ? 'Scheduling from the next quarter hour, not 9 AM.' : 'Back to a 9 AM start.'}`, 450);
        void runCalibration(taskText, yesterdayText, next);
        return;
      }

      pushAi(`Fine \u2014 ${horizonLabel(next)} it is. ${taskPrompt(next)}`, 600);
      setStep('tasks');
      return;
    }

    if (intent.kind === 'question') {
      pushAi("I read your debrief, work out how much you can realistically carry, cut or add tasks to match, then build the sprint schedule. Say \"plan today\" or \"plan tomorrow\" to switch the day, name tasks to add them, \"drop the gym\" to remove one, or \"lock it\" when you're done.", 600);
      return;
    }

    if (step === 'yesterday') {
      setYesterdayText(value);
      pushAi(`${disciplineCopy(analyzeLevelPreview(value))}\n\n${taskPrompt(horizonRef.current)}`, 700);
      setStep('tasks');
      return;
    }

    if (intent.kind === 'remove_task') {
      const targets = intent.removeTargets.map((t) => t.toLowerCase());
      const kept = taskText
        .split('\n')
        .filter((line) => !targets.some((t) => line.toLowerCase().includes(t)));
      const merged = kept.join('\n');
      if (merged.trim() === taskText.trim()) {
        pushAi(`Couldn't find "${intent.removeTargets.join(', ')}" in the list. Name it the way you wrote it.`, 500);
        return;
      }
      setTaskText(merged);
      if (!merged.trim()) {
        pushAi("That empties the list. Give me what you actually want to get done.", 500);
        setStep('tasks');
        return;
      }
      pushAi(`Dropped ${intent.removeTargets.join(', ')}. Re-running the numbers.`, 450);
      void runCalibration(merged, yesterdayText, horizonRef.current);
      return;
    }

    if (intent.kind === 'replace_tasks') {
      const fresh = intent.taskText.trim();
      if (!fresh) {
        setTaskText('');
        pushAi('Cleared. Give me the real list.', 450);
        setStep('tasks');
        return;
      }
      setTaskText(fresh);
      void runCalibration(fresh, yesterdayText, horizonRef.current);
      return;
    }

    if (intent.kind === 'lock') {
      if (step === 'calibrate' && capacity) {
        lockPlan();
      } else {
        pushAi("Nothing to lock yet \u2014 give me the tasks first.", 450);
      }
      return;
    }

    if (intent.kind === 'more_load' || intent.kind === 'less_load') {
      const harder = intent.kind === 'more_load';
      const next: DisciplineLevel = harder
        ? discipline === 'building' ? 'steady' : 'sharp'
        : discipline === 'sharp' ? 'steady' : 'building';
      setDiscipline(next);
      forcedLevel.current = next;
      pushAi(harder
        ? "Raising your ceiling. Re-running with a heavier budget."
        : "Cutting your ceiling. Re-running with a lighter budget.", 450);
      void runCalibration(taskText, yesterdayText, horizonRef.current, next);
      return;
    }

    // Everything left is task content.
    const content = intent.taskText.trim() || value;
    const merged = step === 'calibrate' && taskText ? `${taskText}\n${content}` : content;
    setTaskText(merged);
    void runCalibration(merged, yesterdayText, horizonRef.current);
  }

  // Local preview of the discipline read so the reply feels immediate.
  function analyzeLevelPreview(text: string): DisciplineLevel {
    const lowered = text.toLowerCase();
    const bad = ['nothing', 'scrolled', 'wasted', 'procrastinat', 'lazy', 'skipped', 'missed', 'netflix', 'overslept'];
    const good = ['finished', 'completed', 'worked', 'studied', 'trained', 'gym', 'built', 'focused', 'shipped', 'read'];
    let score = 0;
    bad.forEach((w) => { if (lowered.includes(w)) score -= 1; });
    good.forEach((w) => { if (lowered.includes(w)) score += 1; });
    if (lowered.trim().length < 12) score -= 1;
    if (score <= -1) return 'building';
    if (score >= 2) return 'sharp';
    return 'steady';
  }

  function lockPlan() {
    if (!capacity) return;
    const { tasks, schedule } = buildPlan(capacity.accepted, discipline, startMinutesFor(horizon));
    setStep('locked');
    onPlanCreated(tasks, schedule, discipline, horizon);
    pushAi(`Plan committed for ${horizonLabel(horizon)}. Board is live. Show up when the first sprint starts.`, 400);
  }

  function resetPlanner(withOpening = true) {
    if (withOpening) {
      setMessages([{ id: `opening-${Date.now()}`, role: 'ai', text: OPENING, time: stamp() }]);
    }
    horizonRef.current = 'tomorrow';
    forcedLevel.current = null;
    setHorizon('tomorrow');
    setStep('yesterday');
    setYesterdayText('');
    setTaskText('');
    setCapacity(null);
    setDraftTasks([]);
    setInput('');
    setPendingAttachment(null);
  }

  function exportChat() {
    const lines = messages.map((m) => {
      const who = m.role === 'ai' ? 'Spartan' : 'You';
      const attach = m.attachment ? ` [attached: ${m.attachment.name}]` : '';
      return `[${m.time}] ${who}: ${m.text}${attach}`;
    });
    const header = `Spartan \u2014 Command Chat\nExported ${new Date().toLocaleString()}\n\n`;
    const blob = new Blob([header + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spartan-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleFile(file?: File) {
    if (!file) return;
    setPendingAttachment({ name: file.name, size: file.size });
  }

  const placeholder =
    step === 'yesterday'
      ? 'Tell me about today, honestly\u2026'
      : step === 'tasks'
        ? `Everything you want to do ${horizonLabel(horizon)}\u2026`
        : step === 'calibrate'
          ? capacity?.verdict === 'add'
            ? 'Add more tasks, or hit LOCK below\u2026'
            : 'Add anything else, or hit LOCK below\u2026'
          : 'Plan locked \u2014 hit NEW to replan';

  return (
    <div className="flex h-full flex-col bg-transparent">
      <header className="border-b border-blood/10 bg-void/55 px-5 pb-4 pt-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <SpartanMark size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-black leading-none tracking-tight text-text">SPARTAN</h1>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.28em] text-text-muted">Command chat</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onOpenSettings} className="ghost-button flex h-9 w-9 items-center justify-center rounded-full" title="AI engine settings">
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={exportChat} className="ghost-button flex h-9 items-center gap-1.5 rounded-full px-3 text-[10px]" title="Export chat">
              <Download className="h-3.5 w-3.5" /> EXPORT
            </button>
            {step === 'locked' && (
              <button onClick={() => resetPlanner()} className="ghost-button flex h-9 items-center rounded-full px-3 text-[10px]" title="Start a new plan">
                NEW
              </button>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-md space-y-4">
          <div className="mb-5 px-1">
            <p className="eyebrow">DAILY DEBRIEF</p>
            <h2 className="engraved mt-2 text-[28px] font-black leading-[1.05] tracking-tight text-text">
              ACCOUNT FOR TODAY.<br />PLAN TOMORROW.
            </h2>
          </div>

          {messages.map((message) => (
            <div key={message.id} className={`flex items-end gap-2.5 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'ai' && (
                <SpartanMark size={32} glow={false} className="shrink-0" />
              )}
              <div
                className={`max-w-[82%] whitespace-pre-line px-4 py-3 text-[13px] font-medium leading-[1.5] shadow-[0_10px_28px_rgba(0,0,0,0.35)] ${
                  message.role === 'ai' ? 'glass rounded-[20px] rounded-bl-md text-text' : 'rounded-[20px] rounded-br-md bg-blood/95 text-white shadow-[0_10px_30px_rgba(230,57,70,0.4)]'
                }`}
              >
                <p className={message.role === 'user' ? 'font-semibold' : ''}>{message.text}</p>
                {message.attachment && (
                  <div className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${message.role === 'user' ? 'bg-black/25' : 'bg-blood/10'}`}>
                    <Paperclip className="h-3 w-3" /> {message.attachment.name}
                  </div>
                )}
                <p className={`mt-1.5 text-[9px] font-bold ${message.role === 'user' ? 'text-white/70' : 'text-text-muted'}`}>{message.time}</p>
              </div>
              {message.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blood/15 bg-surface-3/80">
                  <User className="h-3.5 w-3.5 text-text-dim" />
                </div>
              )}
            </div>
          ))}

          {typing && (
            <div className="flex items-end gap-2.5">
              <SpartanMark size={32} glow={false} className="shrink-0" />
              <div className="glass flex gap-1 rounded-[18px] rounded-bl-md px-4 py-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blood" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blood" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blood" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {step === 'calibrate' && capacity && (
            <div className="glass ornate bracketed ml-10 animate-fade-up rounded-[24px] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.5)]">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blood" />
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blood">
                  {capacity.verdict === 'trim' ? 'Load reduced' : capacity.verdict === 'add' ? 'Room for more' : 'Load balanced'}
                </p>
              </div>

              <div className="mb-3 flex items-center justify-between rounded-xl border border-blood/12 bg-surface-3/50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Focused load</span>
                <span className="text-[11px] font-black text-text">
                  {formatDuration(capacity.accepted.reduce((s, t) => s + t.estimate, 0))}
                  <span className="text-text-muted"> / {formatDuration(capacity.capacityMinutes)}</span>
                </span>
              </div>

              <div className="space-y-3">
                {draftTasks.map((task, index) => (
                  <div key={task.id} className="flex items-center gap-3 border-t border-blood/10 pt-3 first:border-0 first:pt-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blood/25 text-[10px] font-black text-blood">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-text">{task.title}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-text-muted">
                        {task.timeBlock} · {task.sprintCount} sprint{task.sprintCount > 1 ? 's' : ''} of {task.sprintLength}m
                      </p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-text-dim">{task.difficulty}</span>
                  </div>
                ))}
              </div>

              {capacity.deferred.length > 0 && (
                <div className="mt-4 rounded-xl border border-blood/12 bg-void/40 p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Pushed to another day</p>
                  <ul className="mt-2 space-y-1.5">
                    {capacity.deferred.map((t: RawTask) => (
                      <li key={t.title} className="flex items-center justify-between gap-2 text-[11px] font-semibold text-text-dim">
                        <span className="truncate line-through">{t.title}</span>
                        <span className="shrink-0 text-[10px] text-text-muted">{formatDuration(t.estimate)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {capacity.verdict === 'add' && capacity.roomForMore > 0 && (
                <p className="mt-3 text-[11px] font-semibold leading-5 text-text-dim">
                  Type {capacity.roomForMore} more task{capacity.roomForMore > 1 ? 's' : ''} below and I'll re-run the numbers, or lock it as is.
                </p>
              )}

              <button onClick={lockPlan} className="red-button mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[12px]">
                <Check className="h-4 w-4" /> LOCK COMMAND PLAN
              </button>
            </div>
          )}

          {step === 'locked' && (
            <div className="ml-10 flex items-center gap-2 px-1 text-[11px] font-bold text-blood">
              <Check className="h-4 w-4" /> Plan synchronized with Board &amp; Timetable
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-blood/10 bg-void/70 px-4 pb-3 pt-3 backdrop-blur-xl">
        {pendingAttachment && (
          <div className="mx-auto mb-2 flex max-w-md items-center gap-2 rounded-xl border border-blood/15 bg-surface-3/60 px-3 py-2">
            <Paperclip className="h-3.5 w-3.5 text-blood" />
            <span className="flex-1 truncate text-[11px] font-semibold text-text">{pendingAttachment.name}</span>
            <button onClick={() => setPendingAttachment(null)} className="text-text-muted hover:text-text">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="relative mx-auto flex max-w-md items-end gap-2">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={step === 'locked'}
            className="ghost-button flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl disabled:opacity-30"
            title="Upload file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input ref={fileInput} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitMessage();
                }
              }}
              disabled={step === 'locked' || thinking}
              placeholder={placeholder}
              rows={1}
              className="min-h-12 w-full resize-none rounded-2xl border border-blood/15 bg-surface/90 py-3.5 pl-4 pr-14 text-[13px] font-semibold text-text outline-none placeholder:text-text-muted focus:border-blood/40 disabled:opacity-55"
            />
            <button
              onClick={() => submitMessage()}
              disabled={(!input.trim() && !pendingAttachment) || step === 'locked' || thinking}
              className="red-button absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl disabled:opacity-30"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
