export default function NiuMark({ className = '' }) {
  return (
    <span className={`niu-mark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 512 512" focusable="false">
        <path
          className="niu-mark-drop"
          d="M256 96c-44 58-78 104-78 148a78 78 0 0 0 156 0c0-44-34-90-78-148Z"
        />
        <path
          className="niu-mark-contour"
          d="M196 286c14-20 34-34 60-40M214 320c12-16 28-27 48-31M236 348c10-12 22-20 36-24"
        />
        <circle className="niu-mark-sun" cx="332" cy="176" r="26" />
      </svg>
    </span>
  )
}
