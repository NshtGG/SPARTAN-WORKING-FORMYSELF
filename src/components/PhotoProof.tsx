import { useRef, useState } from 'react';
import { AlertTriangle, Camera, Check, Loader2, RotateCcw } from 'lucide-react';
import type { Difficulty } from '../types';

type Stage = 'idle' | 'verifying' | 'tagging' | 'accepted' | 'rejected';

const STUDY_TAGS = ['Textbook / Notes', 'Laptop / Video Lecture', 'Screenshot of Work', 'Something else'];
const IRON_TAGS = ['Equipment / Space', 'Workout Tracker', 'Training Area', 'Something else'];

export default function PhotoProof({
  label,
  helper,
  difficulty,
  taskTitle,
  accentLabel,
  onVerified,
}: {
  label: string;
  helper: string;
  difficulty: Difficulty;
  taskTitle: string;
  accentLabel: string;
  onVerified: (dataUrl: string) => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [photo, setPhoto] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = difficulty === 'iron' ? IRON_TAGS : STUDY_TAGS;

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setStage('verifying');
      window.setTimeout(() => setStage('tagging'), 1300);
    };
    reader.readAsDataURL(file);
  }

  function confirmTag(tag: string) {
    if (tag === 'Something else') {
      setStage('rejected');
      return;
    }
    setStage('accepted');
    if (photo) onVerified(photo);
  }

  function retake() {
    setPhoto(null);
    setStage('idle');
  }

  return (
    <section className="glass overflow-hidden rounded-[24px] shadow-[0_22px_55px_rgba(0,0,0,0.5)]">
      {stage === 'idle' && (
        <button onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center px-6 py-9 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blood/25 bg-blood/15 shadow-[0_0_28px_rgba(230,57,70,0.2)]">
            <Camera className="h-6 w-6 text-blood" />
          </span>
          <span className="text-sm font-bold text-text">{label}</span>
          <span className="mt-1.5 max-w-[260px] text-[11px] font-medium leading-5 text-text-muted">{helper}</span>
          <span className="mt-3 text-[9px] font-black uppercase tracking-[0.18em] text-blood">Verified proof required</span>
        </button>
      )}

      {stage === 'verifying' && photo && (
        <div className="relative h-56">
          <img src={photo} alt="Uploaded proof" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void/60">
            <Loader2 className="h-7 w-7 animate-spin text-blood" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blood">Verifying proof…</p>
          </div>
        </div>
      )}

      {stage === 'tagging' && photo && (
        <div>
          <div className="relative h-44">
            <img src={photo} alt="Uploaded proof" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-void/10 to-transparent" />
          </div>
          <div className="p-4">
            <p className="mb-3 text-[11px] font-bold leading-5 text-text">
              What does this photo show, for <span className="text-blood">{taskTitle}</span>?
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => confirmTag(tag)}
                  className={`rounded-full border px-3 py-2 text-[10px] font-bold transition ${
                    tag === 'Something else'
                      ? 'border-text-muted/25 text-text-muted hover:border-text-muted/45'
                      : 'border-blood/25 bg-blood/10 text-text hover:border-blood/45 hover:bg-blood/20'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === 'rejected' && (
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-text-muted/25 bg-surface-3">
            <AlertTriangle className="h-6 w-6 text-text-muted" />
          </span>
          <p className="text-sm font-bold text-text">That's not proof of work.</p>
          <p className="mt-1.5 max-w-[240px] text-[11px] font-medium leading-5 text-text-muted">
            Spartan only accepts real evidence — your notes, screen, or workspace for "{taskTitle}". Retake it honestly.
          </p>
          <button onClick={retake} className="ghost-button mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px]">
            <RotateCcw className="h-3.5 w-3.5" /> RETAKE PHOTO
          </button>
        </div>
      )}

      {stage === 'accepted' && photo && (
        <div className="relative h-56">
          <img src={photo} alt="Verified proof" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-void/85 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blood">
            <Check className="h-4 w-4" /> {accentLabel}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </section>
  );
}
