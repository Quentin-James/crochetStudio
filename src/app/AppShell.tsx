import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from '../design/components'
import { BrandMark } from './BrandMark'
import { NAV_ITEMS } from './navigation'
import './AppShell.css'

/**
 * The application frame.
 *
 * One component tree serves all three layouts; which navigation shape appears is
 * decided entirely in CSS (sidebar ≥1180px, icon rail 760–1179px, bottom tab bar
 * below that). No JS breakpoint listeners, so rotating an iPad costs nothing.
 */
export function AppShell() {
  return (
    <div className="cs-shell">
      <nav className="cs-shell__nav" aria-label="Navigation principale">
        <div className="cs-shell__brand">
          <BrandMark size={38} />
          <span className="cs-shell__brand-text">
            <span className="cs-shell__brand-name">Crochet Studio</span>
            <span className="cs-shell__brand-tag">Créer &amp; crocheter</span>
          </span>
        </div>

        <ul className="cs-shell__links">
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `cs-shell__link${isActive ? ' cs-shell__link--active' : ''}`
                }
              >
                <span className="cs-shell__link-icon">
                  <Icon name={item.icon} size={22} />
                </span>
                <span className="cs-shell__link-label">{item.label}</span>
                <span className="cs-shell__link-label-short">{item.shortLabel}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <p className="cs-shell__footnote">
          Tout ce que vous créez reste sur cet appareil. Sans compte, et hors connexion.
        </p>
      </nav>

      <main className="cs-shell__main">
        <div className="cs-shell__content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
