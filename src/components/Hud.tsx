import { navLinks, profile } from '../data/portfolio';
import { useCoarsePointer } from '../lib/useCoarsePointer';

export default function Hud({ visible, onNavigate }: { visible: boolean; onNavigate: (section: number) => void }) {
  const touch = useCoarsePointer();
  return (
    <div className={`screen hud${visible ? ' is-visible' : ''}`}>
      <header>
        <h2 className="logo">{profile.logo}</h2>
        <nav>
          <ul>
            {navLinks.map((link, i) => (
              <li key={link.label}>
                <button type="button" className="nav-btn" onClick={() => onNavigate(i)} disabled={!visible}>
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="hero-text">
        <h3>{profile.greeting}</h3>
        <h1>{profile.name}</h1>
        <p>{profile.tagline}</p>
      </div>

      <div className="scroll-indicator">
        <div className="mouse" />
        <p>{touch ? 'Deslize para cima' : 'Role para navegar'}</p>
      </div>
    </div>
  );
}
