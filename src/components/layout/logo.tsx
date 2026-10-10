const RECEIPT =
  "M12 5H36A5 5 0 0 1 41 10V41L37.5 38L34 41L30.5 38L27 41L23.5 38L20 41L16.5 38L13 41L10 38.5L7 41V10A5 5 0 0 1 12 5Z";

/** Animated receipt-and-bolt logo with the "Wattwise" wordmark. Doubles as the home button. */
export function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="logo" type="button" onClick={onClick} aria-label="Wattwise, back to start">
      <svg className="lg" width="44" height="44" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <clipPath id="lgclip">
            <path d={RECEIPT} />
          </clipPath>
          <linearGradient id="lgg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1F7A5A" />
            <stop offset="1" stopColor="#0B2E22" />
          </linearGradient>
        </defs>
        <path d={RECEIPT} fill="url(#lgg)" />
        <g clipPath="url(#lgclip)">
          <rect className="lg-scan" x="0" y="0" width="48" height="4" fill="#F6B93B" opacity=".6" />
        </g>
        <path className="lg-bolt" d="M26.5 10.5 16 25h6.5L21 36.5 32 21h-6.5z" fill="#F6B93B" stroke="#FFE3A0" strokeWidth=".8" strokeLinejoin="round" />
        <circle className="lg-sp" cx="38.5" cy="8" r="2" fill="#F6B93B" />
        <circle className="lg-sp b" cx="8" cy="12" r="1.5" fill="#fff" />
      </svg>
      <span className="wm">
        <b>Watt</b>
        <span>Wise</span>
      </span>
    </button>
  );
}
