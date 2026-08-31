/**
 * The Spartan mark.
 *
 * Replaces the flat PNG that was used everywhere. Built from layered bevels,
 * a specular highlight and a cast shadow so it reads as a forged metal badge
 * rather than a coloured square. Scales to any size via the `size` prop.
 */
export default function SpartanMark({
  size = 44,
  className = '',
  glow = true,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  // Unique gradient ids so multiple marks on one screen don't collide.
  const uid = `sm${size}${glow ? 'g' : ''}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Spartan"
    >
      <defs>
        <linearGradient id={`${uid}-plate`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#4a1118" />
          <stop offset="45%" stopColor="#2a0b10" />
          <stop offset="100%" stopColor="#12060a" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ff8b7a" />
          <stop offset="28%" stopColor="#ff4d5a" />
          <stop offset="62%" stopColor="#e63946" />
          <stop offset="100%" stopColor="#7d1a22" />
        </linearGradient>
        <linearGradient id={`${uid}-bevel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb4a5" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#ff6a55" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#5c1219" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={`${uid}-spec`} cx="34%" cy="24%" r="46%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-drop`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.4" floodColor="#000000" floodOpacity="0.75" />
        </filter>
        {glow && (
          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* forged outer plate with a rounded bevel */}
      <g filter={`url(#${uid}-drop)`}>
        <rect x="6" y="6" width="88" height="88" rx="26" fill={`url(#${uid}-plate)`} />
        <rect
          x="6" y="6" width="88" height="88" rx="26"
          fill="none" stroke={`url(#${uid}-bevel)`} strokeWidth="2.4"
        />
        <rect
          x="11" y="11" width="78" height="78" rx="22"
          fill="none" stroke="#ff6a55" strokeOpacity="0.16" strokeWidth="1"
        />
      </g>

      {/* the helmet, extruded: dark back layer offset down-right, bright face on top */}
      <g transform="translate(2.5,3)" opacity="0.55">
        <path
          d="M32 40 Q32 25 50 24 Q68 25 68 40 L68 60 Q68 74 50 80 Q32 74 32 60 Z"
          fill="#4a0f16"
        />
        <path d="M40 22 Q44 10 50 8 Q56 10 60 22 Q55 17 50 17 Q45 17 40 22 Z" fill="#4a0f16" />
      </g>

      <g filter={glow ? `url(#${uid}-glow)` : undefined}>
        {/* crest */}
        <path
          d="M40 22 Q44 10 50 8 Q56 10 60 22 Q55 17 50 17 Q45 17 40 22 Z"
          fill={`url(#${uid}-metal)`}
        />
        {/* helmet body */}
        <path
          d="M32 40 Q32 25 50 24 Q68 25 68 40 L68 60 Q68 74 50 80 Q32 74 32 60 Z"
          fill={`url(#${uid}-metal)`}
        />
        {/* eye slits */}
        <path d="M37 44 Q43 40 47 45 Q42 50 37 47 Z" fill="#10060a" />
        <path d="M63 44 Q57 40 53 45 Q58 50 63 47 Z" fill="#10060a" />
        {/* nose guard */}
        <rect x="47.5" y="42" width="5" height="26" rx="2.5" fill="#10060a" opacity="0.88" />
        {/* top bevel highlight along the dome */}
        <path
          d="M33 41 Q33 27 50 26 Q67 27 67 41"
          fill="none" stroke="#ffc9bd" strokeOpacity="0.5" strokeWidth="1.5"
        />
      </g>

      {/* specular sheen across the whole badge */}
      <rect x="6" y="6" width="88" height="88" rx="26" fill={`url(#${uid}-spec)`} />
    </svg>
  );
}
