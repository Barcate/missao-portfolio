import type { CSSProperties } from 'react';
import { navLinks } from '../data/portfolio';
import { PORTALS } from '../lib/scene/config';

interface Props {
  visible: boolean;
  /** aba da seção em que o astronauta está (portal ao lado ou mundo aberto), ou -1 */
  active: number;
  onNavigate: (section: number) => void;
}

/** Menu sempre à mão depois da decolagem (na dock quem mostra o menu é o HUD). */
export default function NavTabs({ visible, active, onNavigate }: Props) {
  return (
    <nav className={`nav-tabs${visible ? ' is-visible' : ''}`} aria-label="Seções">
      {navLinks.map((link, i) => (
        <button
          key={link.label}
          type="button"
          className={`nav-btn${active === i ? ' is-active' : ''}`}
          style={{ '--accent': PORTALS[i].css } as CSSProperties}
          aria-current={active === i ? 'page' : undefined}
          onClick={() => onNavigate(i)}
          disabled={!visible}
        >
          {link.label}
        </button>
      ))}
    </nav>
  );
}
