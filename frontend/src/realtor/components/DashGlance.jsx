import { barRatio, glanceFromFree } from '../dashGlance.js';

export default function DashGlance({ free, uid = 'dash' }) {
  const { visits, invites, minutes, pulse } = glanceFromFree(free);
  const radius = 26;
  const circ = 2 * Math.PI * radius;
  const dash = circ * (pulse / 100);
  const fillId = `${uid}-ring-fill`;
  const glowId = `${uid}-ring-glow`;
  const bars = [
    { key: 'visits', label: 'Visits', value: visits, ratio: barRatio(visits, 8) },
    { key: 'invites', label: 'Invites', value: invites, ratio: barRatio(invites, 8) },
    { key: 'time', label: 'Time', value: minutes, ratio: barRatio(minutes, 45), suffix: 'm' },
  ];

  return (
    <div
      className="dash-glance"
      aria-label={`${pulse} activity pulse. ${visits} visits, ${invites} invites, ${minutes} minutes in the home.`}
    >
      <svg className="dash-glance-ring" viewBox="0 0 72 72" aria-hidden="true">
        <defs>
          <linearGradient id={fillId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#6b7280" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle className="dash-glance-track" cx="36" cy="36" r={radius} />
        <circle
          className="dash-glance-progress"
          cx="36"
          cy="36"
          r={radius}
          stroke={`url(#${fillId})`}
          strokeDasharray={`${dash} ${circ}`}
          filter={`url(#${glowId})`}
        />
        <text className="dash-glance-score" x="36" y="34">{pulse}</text>
        <text className="dash-glance-score-label" x="36" y="46">pulse</text>
      </svg>
      <ul className="dash-glance-bars">
        {bars.map((bar) => (
          <li key={bar.key}>
            <span className="dash-glance-bar-col" aria-hidden="true">
              <span className="dash-glance-bar-fill" style={{ height: `${Math.max(8, bar.ratio * 100)}%` }} />
            </span>
            <span className="dash-glance-bar-n">{bar.value}{bar.suffix || ''}</span>
            <span className="dash-glance-bar-k">{bar.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
