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

export default function TrueMonthlyCost({ purchasePrice }) {
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

  const fields = (
    <>
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
      {estimate ? (
        <ul className="cost-lines">
          {estimate.lines.map((line) => (
            <li key={line.id}>
              <span>{line.label}</span>
              <span>{formatDollars(line.monthly)} · {line.estimate}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

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

      {open ? (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div
            className="dialog dialog--cost"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${baseId}-title`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cost-dialog-head">
              <div>
                <h2 id={`${baseId}-title`}>TRUE Monthly Cost</h2>
                <p className="muted">Change a number. The estimate updates here.</p>
              </div>
              {estimate ? (
                <p className="cost-headline">
                  <strong>{formatWholeDollars(estimate.total)}</strong>
                  <span>per month · Estimate</span>
                </p>
              ) : null}
            </div>
            <div className="cost-dialog-body">{fields}</div>
            <div className="dialog-actions">
              <button ref={closeRef} type="button" className="button" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
