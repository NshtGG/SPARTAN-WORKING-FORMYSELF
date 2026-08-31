import { useEffect, useState } from 'react';
import { AtSign, ExternalLink, Info, ShieldCheck, Video } from 'lucide-react';

/**
 * Digital Shield.
 *
 * The previous version had toggles that set React state and nothing else —
 * flipping "block YouTube" did literally nothing to YouTube. A WebView app
 * cannot block another Android app: that needs an AccessibilityService or
 * UsageStats + overlay permission, a native component this build doesn't ship.
 *
 * So this panel no longer pretends. It hands off to Android's own Focus Mode,
 * which really can block Instagram and YouTube, and says plainly what is
 * doing the blocking.
 */

interface AndroidBridge {
  openFocusMode?: () => void;
}

function bridge(): AndroidBridge | null {
  const w = window as unknown as { SpartanNative?: AndroidBridge };
  return w.SpartanNative ?? null;
}

const WATCHED = [
  { key: 'instagram', name: 'Instagram', icon: AtSign, note: 'Reels and Stories are the usual leak' },
  { key: 'youtube', name: 'YouTube', icon: Video, note: 'Shorts and the home feed, not lectures' },
];

export default function BlockerPanel() {
  const [expanded, setExpanded] = useState(false);
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(Boolean(bridge()?.openFocusMode));
  }, []);

  function openFocusMode() {
    bridge()?.openFocusMode?.();
  }

  return (
    <section className="glass ornate overflow-hidden rounded-[22px] p-4">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-2.5 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blood/15">
          <ShieldCheck className="h-4 w-4 text-blood" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold text-text">Digital Shield</span>
          <span className="block truncate text-[10px] font-semibold text-text-muted">
            {native ? 'Hands off to Android Focus Mode' : 'Requires the Android app'}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="mt-4 animate-fade-up space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-blood/12 bg-void/40 p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blood" />
            <p className="text-[10px] font-medium leading-4 text-text-muted">
              Spartan can&apos;t block other apps by itself — Android only allows that
              through Focus Mode or an accessibility service. This opens the system
              screen where the block actually gets enforced.
            </p>
          </div>

          <div className="space-y-2">
            {WATCHED.map((app) => {
              const Icon = app.icon;
              return (
                <div key={app.key} className="flex items-center gap-2.5 rounded-xl border border-blood/10 bg-surface-3/40 p-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blood/12 text-blood">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-text">{app.name}</span>
                    <span className="block truncate text-[9px] font-medium text-text-muted">{app.note}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={openFocusMode}
            disabled={!native}
            className="red-button flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[11px] disabled:opacity-35"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {native ? 'OPEN ANDROID FOCUS MODE' : 'ANDROID APP ONLY'}
          </button>

          {!native && (
            <p className="text-center text-[9px] font-semibold text-text-muted">
              Running in a browser — the system handoff only exists in the installed app.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
