import { useState } from 'react';
import { Check, Cpu, Globe, KeyRound, ShieldCheck, Trash2, X } from 'lucide-react';
import { FREE_OPENROUTER_MODELS, type AiSettings, type Provider } from '../utils/ai';

export default function SettingsSheet({
  settings,
  onSave,
  onClose,
  onClearData,
}: {
  settings: AiSettings;
  onSave: (next: AiSettings) => void;
  onClose: () => void;
  onClearData: () => void;
}) {
  const [draft, setDraft] = useState<AiSettings>(settings);
  const [confirmClear, setConfirmClear] = useState(false);

  const options: { key: Provider; title: string; blurb: string; icon: typeof Cpu }[] = [
    {
      key: 'local',
      title: 'On-device engine',
      blurb: 'Runs entirely offline. No key, no account, no network. Always works.',
      icon: Cpu,
    },
    {
      key: 'pollinations',
      title: 'Pollinations (free, no key)',
      blurb: 'Free hosted model, no signup. Needs internet. Falls back on-device if it fails.',
      icon: Globe,
    },
    {
      key: 'openrouter',
      title: 'OpenRouter free models',
      blurb: 'Free-tier models. Needs a free key from openrouter.ai, stored only on this device.',
      icon: KeyRound,
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-blood/15 p-5 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.8)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="eyebrow">ENGINE</p>
            <h3 className="mt-1 text-[20px] font-black tracking-tight text-text">AI SETTINGS</h3>
          </div>
          <button onClick={onClose} className="ghost-button flex h-9 w-9 items-center justify-center rounded-full" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {options.map((option) => {
            const Icon = option.icon;
            const active = draft.provider === option.key;
            return (
              <button
                key={option.key}
                onClick={() => setDraft({ ...draft, provider: option.key })}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                  active ? 'border-blood/50 bg-blood/12' : 'border-blood/12 bg-surface-3/40 hover:border-blood/25'
                }`}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-blood/25 text-blood' : 'bg-surface-4/50 text-text-muted'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-text">{option.title}</span>
                    {active && <Check className="h-3.5 w-3.5 text-blood" />}
                  </span>
                  <span className="mt-1 block text-[11px] font-medium leading-4 text-text-muted">{option.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>

        {draft.provider === 'openrouter' && (
          <div className="mt-4 space-y-3 rounded-2xl border border-blood/12 bg-void/40 p-3.5">
            <div>
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">API key</label>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="sk-or-v1-…"
                className="mt-1.5 w-full rounded-xl border border-blood/15 bg-surface/90 px-3 py-2.5 text-[12px] font-semibold text-text outline-none placeholder:text-text-muted focus:border-blood/40"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Model</label>
              <select
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-blood/15 bg-surface/90 px-3 py-2.5 text-[12px] font-semibold text-text outline-none focus:border-blood/40"
              >
                {FREE_OPENROUTER_MODELS.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-blood/10 bg-surface-3/30 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blood" />
          <p className="text-[11px] font-medium leading-4 text-text-muted">
            No login, ever. Your plans, chat and key stay in this app's local storage on this device and are never sent anywhere except the model you pick above.
          </p>
        </div>

        <button
          onClick={() => { onSave(draft); onClose(); }}
          className="red-button mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[12px]"
        >
          <Check className="h-4 w-4" /> SAVE SETTINGS
        </button>

        <button
          onClick={() => {
            if (!confirmClear) { setConfirmClear(true); return; }
            onClearData();
            onClose();
          }}
          className="ghost-button mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[11px]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmClear ? 'TAP AGAIN TO WIPE ALL LOCAL DATA' : 'CLEAR LOCAL DATA'}
        </button>
      </div>
    </div>
  );
}
