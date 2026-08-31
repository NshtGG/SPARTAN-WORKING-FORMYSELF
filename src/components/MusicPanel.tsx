import { useEffect, useState } from 'react';
import { Music2, Pause, Play, Volume2 } from 'lucide-react';
import { AMBIENT_TRACKS, ambientEngine, type AmbientTrack } from '../utils/ambient';

export default function MusicPanel() {
  const [expanded, setExpanded] = useState(false);
  const [activeTrack, setActiveTrack] = useState<AmbientTrack | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      ambientEngine.stop();
    };
  }, []);

  function toggleTrack(track: AmbientTrack) {
    if (activeTrack?.id === track.id && playing) {
      ambientEngine.stop();
      setPlaying(false);
      return;
    }
    ambientEngine.play(track);
    setActiveTrack(track);
    setPlaying(true);
  }

  function stopAll() {
    ambientEngine.stop();
    setPlaying(false);
  }

  return (
    <section className="glass ornate rounded-[22px] p-4">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blood/15">
            <Music2 className="h-4 w-4 text-blood" />
          </span>
          <div className="text-left">
            <p className="text-[12px] font-bold text-text">Focus Sounds</p>
            <p className="text-[10px] font-semibold text-text-muted">
              {playing && activeTrack ? `Playing: ${activeTrack.emoji} ${activeTrack.name}` : `${AMBIENT_TRACKS.length} focus sounds`}
            </p>
          </div>
        </div>
        {playing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              stopAll();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blood/20 text-blood"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
        )}
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-2 gap-2 animate-fade-up">
          {AMBIENT_TRACKS.map((track) => {
            const isActive = activeTrack?.id === track.id && playing;
            return (
              <button
                key={track.id}
                onClick={() => toggleTrack(track)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left transition ${
                  isActive ? 'border-blood/45 bg-blood/15' : 'border-blood/10 bg-surface-3/50 hover:border-blood/25'
                }`}
              >
                <span className="text-base leading-none">{track.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-bold text-text">{track.name}</span>
                  <span className="block truncate text-[9px] font-medium text-text-muted">{track.description}</span>
                </span>
                {isActive ? <Volume2 className="h-3 w-3 shrink-0 text-blood" /> : <Play className="h-3 w-3 shrink-0 text-text-muted" />}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
