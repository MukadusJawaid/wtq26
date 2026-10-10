const BOLT = "M13 2 4 14h6l-1 8 9-12h-6z";

/** Soft drifting colour blobs, dot grid and floating bolts behind the app. Purely decorative. */
export function Backdrop() {
  return (
    <div className="bg" aria-hidden="true">
      <i className="a" />
      <i className="b" />
      <i className="c" />
      {[
        ["f1", 46],
        ["f2", 64],
        ["f3", 34],
        ["f4", 52],
      ].map(([cls, size]) => (
        <svg key={cls} className={`fl ${cls}`} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d={BOLT} />
        </svg>
      ))}
    </div>
  );
}
