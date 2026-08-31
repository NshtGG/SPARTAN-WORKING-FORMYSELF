/**
 * The backdrop warrior.
 *
 * Drawn as SVG rather than shipped as a bitmap: it stays sharp on every screen
 * density and adds about 4 KB to the bundle instead of a couple of megabytes,
 * which matters because the whole app is inlined into one file for the APK.
 *
 * Sits behind everything at low opacity — present, not competing with the text.
 */
export default function WarriorBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* deep red floor glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 108%, rgba(230,57,70,0.22) 0%, rgba(107,20,27,0.10) 38%, transparent 70%)',
        }}
      />
      {/* overhead cold rim so the figure reads as lit from above */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 55% at 50% -12%, rgba(255,106,85,0.14) 0%, transparent 62%)',
        }}
      />

      <svg
        viewBox="0 0 420 760"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="warriorBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4d5a" stopOpacity="0.30" />
            <stop offset="45%" stopColor="#b1252f" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#6b141b" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="warriorEdge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff6a55" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e63946" stopOpacity="0.12" />
          </linearGradient>
          <radialGradient id="crestGlow" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#ff4d5a" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#e63946" stopOpacity="0" />
          </radialGradient>
          <filter id="warriorBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        <g filter="url(#warriorBlur)" opacity="0.5">
          {/* spear, held upright behind the shoulder */}
          <rect x="316" y="150" width="4" height="470" fill="url(#warriorEdge)" opacity="0.5" />
          <path d="M318 118 L327 152 L318 164 L309 152 Z" fill="url(#warriorEdge)" opacity="0.7" />

          {/* crest plume on the helmet */}
          <ellipse cx="210" cy="196" rx="70" ry="26" fill="url(#crestGlow)" />
          <path
            d="M168 214 Q176 168 210 158 Q244 168 252 214 Q236 200 210 197 Q184 200 168 214 Z"
            fill="url(#warriorBody)"
            stroke="url(#warriorEdge)"
            strokeWidth="1.1"
          />

          {/* corinthian helmet */}
          <path
            d="M180 216 Q180 190 210 188 Q240 190 240 216 L240 258 Q240 286 210 296 Q180 286 180 258 Z"
            fill="url(#warriorBody)"
            stroke="url(#warriorEdge)"
            strokeWidth="1.3"
          />
          {/* eye slits and nose guard — the detail that makes it read as a helmet */}
          <path d="M188 232 Q198 226 205 232 Q198 240 188 236 Z" fill="#08050a" opacity="0.75" />
          <path d="M232 232 Q222 226 215 232 Q222 240 232 236 Z" fill="#08050a" opacity="0.75" />
          <rect x="207" y="228" width="6" height="46" rx="3" fill="#08050a" opacity="0.6" />

          {/* neck and shoulders */}
          <path d="M198 296 L222 296 L228 318 L192 318 Z" fill="url(#warriorBody)" />
          <path
            d="M150 330 Q210 306 270 330 L286 402 Q210 380 134 402 Z"
            fill="url(#warriorBody)"
            stroke="url(#warriorEdge)"
            strokeWidth="1.1"
          />

          {/* torso with muscle contour lines */}
          <path
            d="M146 400 Q210 378 274 400 L266 552 Q210 570 154 552 Z"
            fill="url(#warriorBody)"
            stroke="url(#warriorEdge)"
            strokeWidth="1"
          />
          <path d="M210 404 L210 548" stroke="url(#warriorEdge)" strokeWidth="0.9" opacity="0.5" />
          <path d="M170 442 Q210 430 250 442" stroke="url(#warriorEdge)" strokeWidth="0.8" opacity="0.42" fill="none" />
          <path d="M174 482 Q210 472 246 482" stroke="url(#warriorEdge)" strokeWidth="0.8" opacity="0.34" fill="none" />
          <path d="M178 518 Q210 510 242 518" stroke="url(#warriorEdge)" strokeWidth="0.8" opacity="0.26" fill="none" />

          {/* left arm holding the round hoplon shield */}
          <path d="M146 402 L120 470 L128 546 L152 540 L142 470 Z" fill="url(#warriorBody)" />
          <circle cx="112" cy="486" r="70" fill="url(#warriorBody)" stroke="url(#warriorEdge)" strokeWidth="1.4" />
          <circle cx="112" cy="486" r="52" fill="none" stroke="url(#warriorEdge)" strokeWidth="0.9" opacity="0.55" />
          <circle cx="112" cy="486" r="30" fill="none" stroke="url(#warriorEdge)" strokeWidth="0.9" opacity="0.4" />
          {/* lambda — the Spartan shield mark */}
          <path
            d="M112 456 L131 516 L122 516 L112 484 L102 516 L93 516 Z"
            fill="url(#warriorEdge)"
            opacity="0.5"
          />

          {/* right arm gripping the spear */}
          <path d="M274 402 L300 466 L296 548 L272 542 L282 470 Z" fill="url(#warriorBody)" />

          {/* pteruges skirt */}
          <g opacity="0.85">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <rect
                key={i}
                x={158 + i * 15}
                y={552}
                width="11"
                height={44 + (i % 2 === 0 ? 8 : 0)}
                rx="4"
                fill="url(#warriorBody)"
                stroke="url(#warriorEdge)"
                strokeWidth="0.6"
              />
            ))}
          </g>

          {/* legs fading into the floor */}
          <path d="M176 606 L172 720 L196 720 L200 606 Z" fill="url(#warriorBody)" opacity="0.55" />
          <path d="M220 606 L224 720 L248 720 L244 606 Z" fill="url(#warriorBody)" opacity="0.55" />
        </g>
      </svg>

      {/* vignette so the figure sinks into the background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(105% 70% at 50% 45%, transparent 20%, rgba(8,5,10,0.62) 68%, rgba(8,5,10,0.94) 100%)',
        }}
      />
    </div>
  );
}
