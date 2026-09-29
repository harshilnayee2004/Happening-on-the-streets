export default function WorkspaceReadinessPanel({
  readiness,
  overrideScore,
  overrideReason,
  onScoreChange,
  onReasonChange,
  onSubmit,
}) {
  if (!readiness) return null;
  const openCount = readiness.unresolved.length + readiness.blocking.length;
  const dash = 2 * Math.PI * 18;
  const progress = dash * (readiness.score / 100);

  return (
    <details className="workspace-drawer">
      <summary className="workspace-drawer-summary">
        <span className="workspace-drawer-title">Buyer readiness</span>
        <span className="workspace-readiness-ring" aria-hidden="true">
          <svg viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" className="workspace-readiness-track" />
            <circle
              cx="22"
              cy="22"
              r="18"
              className="workspace-readiness-progress"
              strokeDasharray={`${progress} ${dash}`}
            />
            <text x="22" y="24" className="workspace-readiness-num">{readiness.score}</text>
          </svg>
        </span>
        <span className="workspace-drawer-meta">
          {openCount === 0 ? 'All signals resolved' : `${openCount} open signal${openCount === 1 ? '' : 's'}`}
        </span>
      </summary>
      <div className="workspace-drawer-body">
        {readiness.override ? (
          <p className="muted">Override: {readiness.override.reason}</p>
        ) : (
          <p className="muted">Computed score {readiness.computed}. Expand only when you need the audit trail.</p>
        )}
        <ul className="readiness-chips">
          {readiness.resolved.map((item) => (
            <li key={`r-${item}`} className="readiness-chip readiness-chip--ok">Resolved · {item}</li>
          ))}
          {readiness.unresolved.map((item) => (
            <li key={`u-${item}`} className="readiness-chip">Open · {item}</li>
          ))}
          {readiness.blocking.map((item) => (
            <li key={`b-${item}`} className="readiness-chip readiness-chip--block">Blocking · {item}</li>
          ))}
        </ul>
        <form className="readiness-form readiness-form--inline" onSubmit={onSubmit}>
          <label>
            Override
            <input
              type="number"
              min="0"
              max="100"
              required
              value={overrideScore}
              onChange={(event) => onScoreChange(event.target.value)}
            />
          </label>
          <label>
            Reason
            <input
              required
              maxLength={400}
              value={overrideReason}
              onChange={(event) => onReasonChange(event.target.value)}
            />
          </label>
          <button type="submit" className="button button--quiet">Save</button>
        </form>
      </div>
    </details>
  );
}
