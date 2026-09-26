import { NavLink } from 'react-router-dom';
import { usePageTitle } from '../usePageTitle.js';

export default function Page({
  title,
  lede,
  eyebrow,
  links = [],
  shellNote = 'Navigation shell.',
  children,
}) {
  usePageTitle(title);

  return (
    <main className="page">
      <header className="page-head">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {shellNote ? <p className="shell-note">{shellNote}</p> : null}
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </header>
      {links.length > 0 && (
        <nav aria-label="Steps" className="steps">
          <ol>
            {links.map((link, index) => (
              <li key={link.to}>
                <NavLink to={link.to} end>
                  <span className="step-number" aria-hidden="true">{index + 1}</span>
                  <span>{link.label}</span>
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {children}
    </main>
  );
}
