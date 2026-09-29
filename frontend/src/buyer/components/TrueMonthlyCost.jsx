import { useEffect, useId, useRef, useState } from 'react';
import { LOAN_TERM_YEARS, estimateMonthlyCost } from '../trueMonthlyCost.js';
import { formatDollars, formatWholeDollars } from '../format.js';

const GROUPS = [
  {
    title: 'Loan',
    fields: [
      ['purchasePrice', 'Purchase price', '$'],
      ['downPaymentPercent', 'Down payment', '%'],
      ['annualInterestPercent', 'Interest rate', '%'],
    ],
  },
  {
    title: 'Owning',
    fields: [
      ['propertyTaxPercent', 'Property tax', '% / yr'],
      ['insurancePerYear', 'Insurance', '$ / yr'],
      ['hoaPerMonth', 'HOA', '$ / mo'],
    ],
  },
  {
    title: 'Living there',
    fields: [
      ['gasPerMonth', 'Gas', '$ / mo'],
      ['electricityPerMonth', 'Electricity', '$ / mo'],
      ['waterPerMonth', 'Water', '$ / mo'],
      ['maintenancePercentPerYear', 'Maintenance reserve', '% / yr'],
    ],
  },
];

function readAmount(value, { emptyIsZero = true } = {}) {
  if (value === '' || value == null) return emptyIsZero ? 0 : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function TrueMonthlyCost({ purchasePrice, compact = false }) {
  const baseId = useId();
  const closeRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => ({
    purchasePrice: purchasePrice === '' || purchasePrice == null ? '' : String(purchasePrice),
    downPaymentPercent: '20',
    annualInterestPercent: '6.5',
    propertyTaxPercent: '1.2',
    insurancePerYear: '1800',
    hoaPerMonth: '0',
    gasPerMonth: '50',
    electricityPerMonth: '120',
    waterPerMonth: '40',
    maintenancePercentPerYear: '1',
  }));

  const estimate = estimateMonthlyCost({
    purchasePrice: readAmount(values.purchasePrice, { emptyIsZero: false }) ?? Number.NaN,
    downPaymentPercent: readAmount(values.downPaymentPercent) ?? Number.NaN,
    annualInterestPercent: readAmount(values.annualInterestPercent) ?? Number.NaN,
    loanTermYears: LOAN_TERM_YEARS,
    propertyTaxPercent: readAmount(values.propertyTaxPercent) ?? Number.NaN,
    insurancePerYear: readAmount(values.insurancePerYear) ?? Number.NaN,
    hoaPerMonth: readAmount(values.hoaPerMonth) ?? Number.NaN,
    gasPerMonth: readAmount(values.gasPerMonth) ?? Number.NaN,
    electricityPerMonth: readAmount(values.electricityPerMonth) ?? Number.NaN,
    waterPerMonth: readAmount(values.waterPerMonth) ?? Number.NaN,
    maintenancePercentPerYear: readAmount(values.maintenancePercentPerYear) ?? Number.NaN,
  });

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function update(name, next) {
    setValues((current) => ({ ...current, [name]: next }));
  }

  const inputGroups = (
    <div className="cost-groups">
      {GROUPS.map((group) => (
        <fieldset key={group.title} className="cost-group">
          <legend>{group.title}</legend>
          {group.fields.map(([name, label, unit]) => {
            const id = `${baseId}-${name}`;
            return (
              <div className="cost-field" key={name}>
                <label htmlFor={id}>{label}</label>
                <div className="cost-input">
                  <input
                    id={id}
                    inputMode="decimal"
                    value={values[name]}
                    onChange={(event) => update(name, event.target.value)}
                  />
                  <span aria-hidden="true">{unit}</span>
                </div>
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );

  const breakdown = estimate ? (
    <aside className="cost-dialog-breakdown" aria-label="Monthly breakdown">
      <p className="cost-breakdown-k">Breakdown</p>
      <ul className="cost-lines cost-lines--panel">
        {estimate.lines.map((line) => (
          <li key={line.id}>
            <span className="cost-line-label">{line.label}</span>
            <span className="cost-line-amt">{formatDollars(line.monthly)}</span>
            <span className="cost-line-note">{line.estimate}</span>
          </li>
        ))}
      </ul>
    </aside>
  ) : null;

  function costDialog() {
    return (
      <div className="dialog-backdrop" onClick={() => setOpen(false)}>
        <div
          className="dialog dialog--cost"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${baseId}-title`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="cost-dialog-head">
            <div className="cost-dialog-title">
              <h2 id={`${baseId}-title`}>TRUE Monthly Cost</h2>
              <p className="muted">Edit any field — the total updates live.</p>
            </div>
            <div className="cost-dialog-head-end">
              {estimate ? (
                <p className="cost-headline cost-headline--dialog">
                  <strong>{formatWholeDollars(estimate.total)}</strong>
                  <span>/mo · estimate</span>
                </p>
              ) : null}
              <button
                type="button"
                className="cost-dialog-x"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </div>
          <div className="cost-dialog-body">
            <div className="cost-dialog-layout">
              <div className="cost-dialog-fields">{inputGroups}</div>
              {breakdown}
            </div>
          </div>
          <div className="dialog-actions dialog-actions--cost">
            <button
              ref={closeRef}
              type="button"
              className="button button--quiet"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <section className="monthly-cost monthly-cost--compact" aria-label="TRUE Monthly Cost">
        <button type="button" className="workspace-cost-card" onClick={() => setOpen(true)}>
          <span className="workspace-cost-top">
            <span className="workspace-cost-k">Est. monthly</span>
            <span className="workspace-cost-pill">Tap to customize</span>
          </span>
          <span className="workspace-cost-value">
            {estimate ? formatWholeDollars(estimate.total) : '—'}
            <span className="workspace-cost-suffix">/mo</span>
          </span>
          <span className="workspace-cost-note">{`${LOAN_TERM_YEARS}-year fixed · estimate`}</span>
          <span className="workspace-cost-cta">
            See payment breakdown
            <span className="workspace-cost-chevron" aria-hidden="true">›</span>
          </span>
        </button>
        {open ? costDialog() : null}
      </section>
    );
  }

  return (
    <section className="monthly-cost" aria-label="TRUE Monthly Cost">
      <div className="cost-summary">
        <div>
          <h4>TRUE Monthly Cost</h4>
          <p className="muted">{`${LOAN_TERM_YEARS}-year fixed · Estimate`}</p>
        </div>
        {estimate ? (
          <p className="cost-headline">
            <strong>{formatWholeDollars(estimate.total)}</strong>
            <span>per month</span>
          </p>
        ) : (
          <p className="cost-headline cost-headline--empty">
            <span>Add a purchase price</span>
          </p>
        )}
      </div>
      <button type="button" className="cost-open" onClick={() => setOpen(true)}>
        Adjust the numbers
      </button>

      {open ? costDialog() : null}
    </section>
  );
}
