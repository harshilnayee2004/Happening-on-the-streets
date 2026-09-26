import { Link, useLocation } from 'react-router-dom';
import { isOpenHousePath, products } from '../nav.js';

function productIsCurrent(to, pathname) {
  if (to === '/tools') return isOpenHousePath(pathname) || pathname === '/learn-more';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function AppNav() {
  const { pathname } = useLocation();
  const cinematic = pathname === '/' || pathname === '/tools' || pathname === '/learn-more';

  return (
    <header className={cinematic ? 'topbar topbar--glass' : 'topbar'}>
      <Link to="/" className="brand">
        Hapstr
      </Link>
      <nav className="product-nav" aria-label="Products">
        <ul>
          {products.map((item) => {
            const current = productIsCurrent(item.to, pathname);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={current ? 'page' : undefined}
                  className={current ? 'active' : undefined}
                >
                  <span className="nav-long">{item.label}</span>
                  <span className="nav-short">{item.short || item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
