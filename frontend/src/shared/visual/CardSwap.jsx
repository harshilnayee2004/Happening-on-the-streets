import { useEffect, useState } from 'react';

export function Card({ title, children }) {
  return (
    <div className="swap-card">
      <div className="swap-card-head">
        <span className="swap-dot" aria-hidden="true" />
        {title}
      </div>
      <div className="swap-card-body">{children}</div>
    </div>
  );
}

export default function CardSwap({ children, delay = 4000 }) {
  const cards = Array.isArray(children) ? children : [children];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % cards.length);
    }, delay);
    return () => window.clearInterval(timer);
  }, [cards.length, delay]);

  return (
    <div
      className="card-swap"
      role="button"
      tabIndex={0}
      onClick={() => setIndex((current) => (current + 1) % cards.length)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setIndex((current) => (current + 1) % cards.length);
        }
      }}
      aria-label="Flip feature cards"
    >
      {cards.map((child, i) => {
        const offset = (i - index + cards.length) % cards.length;
        return (
          <div
            key={i}
            className="card-swap-item"
            style={{
              transform: `translate3d(calc(var(--swap-x) * ${offset}), calc(var(--swap-y) * ${offset}), calc(var(--swap-z) * ${-offset})) rotateX(calc(var(--swap-tilt) * ${offset}))`,
              zIndex: cards.length - offset,
              opacity: offset > 2 ? 0 : 1,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
