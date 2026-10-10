export type MascotState = "idle" | "load" | "slow" | "err";

/** The receipt mascot. Which parts show for each state is controlled by the design CSS via data-s. */
export function Mascot({ state }: { state: MascotState }) {
  return (
    <svg className="mascot" data-s={state} viewBox="0 0 200 220" aria-hidden="true">
      <ellipse className="m-shadow" cx="100" cy="207" rx="44" ry="7" fill="#000" opacity=".22" />
      <g className="st st-fun">
        <path className="m-sp" d="M28 78l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#F6B93B" />
        <path className="m-sp b" d="M170 70l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#F6B93B" />
        <circle className="m-sp c" cx="38" cy="150" r="3.5" fill="#fff" opacity=".8" />
      </g>
      <g className="m-body">
        <g className="m-bolt">
          <path d="M107 4 85 36h14l-6 20 26-32h-15z" fill="#F6B93B" stroke="#C98A12" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
        <path
          d="M64 60H136A14 14 0 0 1 150 74V176L140 167L130 176L120 167L110 176L100 167L90 176L80 167L70 176L60 167L50 176V74A14 14 0 0 1 64 60Z"
          fill="#FFF6E0"
          stroke="#0F3D2E"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <path d="M70 146H130M70 158H112" stroke="#E2D6B8" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="68" cy="116" r="7" fill="#FF9F8A" opacity=".55" />
        <circle cx="132" cy="116" r="7" fill="#FF9F8A" opacity=".55" />
        <g className="st st-ok">
          <g className="m-look">
            <ellipse className="m-eye" cx="82" cy="96" rx="8" ry="10" fill="#14171A" />
            <ellipse className="m-eye r" cx="118" cy="96" rx="8" ry="10" fill="#14171A" />
            <circle cx="85" cy="92" r="2.6" fill="#fff" />
            <circle cx="121" cy="92" r="2.6" fill="#fff" />
          </g>
          <path d="M90 118Q100 128 110 118" stroke="#14171A" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </g>
        <g className="st st-slow">
          <path d="M72 99Q82 107 92 99M108 99Q118 107 128 99" stroke="#14171A" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M89 122q5.5-5 11 0t11 0" stroke="#14171A" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path className="m-sweat" d="M138 84q-6 9-6 13a6 6 0 0 0 12 0q0-4-6-13z" fill="#7CC4FF" />
        </g>
        <g className="st st-err">
          <path d="M74 88l16 16M90 88l-16 16M110 88l16 16M126 88l-16 16" stroke="#14171A" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="100" cy="123" rx="7" ry="5.5" fill="#14171A" />
        </g>
      </g>
      <g className="st st-load">
        <g className="m-lens">
          <circle cx="146" cy="134" r="17" fill="rgba(246,185,59,.2)" stroke="#0F3D2E" strokeWidth="5" />
          <path d="M158 146l15 15" stroke="#0F3D2E" strokeWidth="7" strokeLinecap="round" />
          <path d="M137 128a10 10 0 0 1 8-6" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
        </g>
      </g>
      <g className="st st-slow">
        <text className="m-zz" x="146" y="66">z</text>
        <text className="m-zz b" x="158" y="50">z</text>
        <text className="m-zz c" x="168" y="36">z</text>
      </g>
      <g className="st st-err">
        <g className="m-orbit">
          <circle cx="134" cy="50" r="4.5" fill="#F6B93B" />
          <circle cx="83" cy="79" r="4.5" fill="#fff" />
          <circle cx="83" cy="21" r="4.5" fill="#FF9F8A" />
        </g>
        <path d="M150 150C172 150 168 178 186 174" stroke="#14171A" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <rect x="183" y="164" width="14" height="20" rx="4" fill="#8C938F" transform="rotate(-12 190 174)" />
        <path className="m-spark" d="M176 160l4-9 3 7 7-4" stroke="#F6B93B" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
