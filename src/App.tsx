import { useCallback, useEffect, useState } from 'react';
import ChatPlanner from './components/ChatPlanner';
import PlanBoard from './components/PlanBoard';
import FocusSession from './components/FocusSession';
import TodayView from './components/TodayView';
import SettingsSheet from './components/SettingsSheet';
import WarriorBackdrop from './components/WarriorBackdrop';
import BottomNav, { type Tab } from './components/BottomNav';
import type { DisciplineLevel, ScheduleBlock, TaskItem } from './types';
import type { AiSettings } from './utils/ai';
import type { Horizon } from './utils/intent';
import { clearPlan, loadAiSettings, loadPlan, saveAiSettings, savePlan } from './utils/storage';

export default function App() {
  // Hydrate straight from local storage — no login, no splash, no network.
  const [booted, setBooted] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineLevel>('steady');
  const [horizon, setHorizon] = useState<Horizon>('tomorrow');
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [tab, setTab] = useState<Tab>('chat');
  const [focusTask, setFocusTask] = useState<TaskItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const saved = loadPlan();
    if (saved && saved.tasks.length > 0) {
      setTasks(saved.tasks);
      setSchedule(saved.schedule);
      setDiscipline(saved.discipline);
      setTab('board');
    }
    setBooted(true);
  }, []);

  // Persist every change so closing the app loses nothing.
  useEffect(() => {
    if (!booted) return;
    if (tasks.length === 0) return;
    savePlan({ tasks, schedule, discipline, savedAt: new Date().toISOString() });
  }, [booted, tasks, schedule, discipline]);

  const handlePlanCreated = useCallback(
    (newTasks: TaskItem[], newSchedule: ScheduleBlock[], level: DisciplineLevel, planHorizon: Horizon) => {
      setTasks(newTasks);
      setSchedule(newSchedule);
      setDiscipline(level);
      setHorizon(planHorizon);
      setTab('board');
    },
    [],
  );

  const handleStartFocus = useCallback((task: TaskItem) => {
    setFocusTask(task);
    setTab('focus');
  }, []);

  const handleGoToChat = useCallback(() => setTab('chat'), []);

  const handleToggleComplete = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  }, []);

  const handleSessionComplete = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: true } : t)));
  }, []);

  const handleSaveSettings = useCallback((next: AiSettings) => {
    setAiSettings(next);
    saveAiSettings(next);
  }, []);

  const handleClearData = useCallback(() => {
    clearPlan();
    setTasks([]);
    setSchedule([]);
    setFocusTask(null);
    setDiscipline('steady');
    setTab('chat');
  }, []);

  return (
    <div className="app-backdrop grain relative h-[100dvh] w-full overflow-hidden bg-void text-text">
      <div className="spartan-grid pointer-events-none absolute inset-0 opacity-30" />
      <WarriorBackdrop />
      <div className="relative mx-auto h-full max-w-md overflow-hidden border-x border-blood/8 bg-void/38 shadow-[0_0_90px_rgba(0,0,0,0.85)] backdrop-blur-[2px]">
        <main className="h-full overflow-hidden pb-[86px]">
          {tab === 'chat' && (
            <ChatPlanner
              key={tasks.length === 0 ? 'fresh' : 'has-plan'}
              onPlanCreated={handlePlanCreated}
              hasPlan={tasks.length > 0}
              aiSettings={aiSettings}
              onOpenSettings={() => setShowSettings(true)}
            />
          )}
          {tab === 'board' && (
            <PlanBoard
              tasks={tasks}
              onStartFocus={handleStartFocus}
              onGoToChat={handleGoToChat}
              onToggleComplete={handleToggleComplete}
            />
          )}
          {tab === 'focus' && (
            <FocusSession
              tasks={tasks}
              initialTask={focusTask}
              onGoToChat={handleGoToChat}
              onSessionComplete={handleSessionComplete}
            />
          )}
          {tab === 'today' && (
            <TodayView
              tasks={tasks}
              discipline={discipline}
              horizonLabel={horizon === 'today' ? 'tomorrow' : 'tomorrow'}
              onPlanNext={handleGoToChat}
            />
          )}
        </main>
        <BottomNav active={tab} onSelect={setTab} />
      </div>

      {showSettings && (
        <SettingsSheet
          settings={aiSettings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          onClearData={handleClearData}
        />
      )}
    </div>
  );
}
