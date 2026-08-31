import { CalendarCheck, LayoutList, MessageCircle, Timer } from 'lucide-react';

export type Tab = 'chat' | 'board' | 'focus' | 'today';

export default function BottomNav({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
}) {
  const tabs = [
    { key: 'chat' as const, label: 'COMMAND', icon: MessageCircle },
    { key: 'board' as const, label: 'BOARD', icon: LayoutList },
    { key: 'focus' as const, label: 'FOCUS', icon: Timer },
    { key: 'today' as const, label: 'TODAY', icon: CalendarCheck },
  ];

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md px-3 pb-[max(14px,env(safe-area-inset-bottom))]">
      <div className="glass pointer-events-auto mx-auto flex items-center justify-around rounded-[22px] border-blood/15 p-1.5 shadow-[0_22px_55px_rgba(0,0,0,0.75)]">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => onSelect(tab.key)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-[16px] px-2 py-2.5 transition-all duration-300 ${
                isActive ? 'bg-gradient-to-b from-blood/30 to-blood/15 text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-text-muted hover:text-text-dim'
              }`}
            >
              <Icon className={`h-[17px] w-[17px] transition ${isActive ? 'text-blood' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[9px] font-black tracking-wide transition-colors ${isActive ? 'text-text' : 'text-text-muted'}`}>
                {tab.label}
              </span>
              {isActive && <span className="absolute -bottom-0.5 h-1 w-5 rounded-full bg-blood shadow-[0_0_10px_rgba(230,57,70,0.9)]" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
