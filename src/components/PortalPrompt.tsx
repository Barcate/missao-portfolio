import type { CSSProperties } from 'react';
import { portals } from '../data/portfolio';
import { PORTALS } from '../lib/scene/config';
import { useCoarsePointer } from '../lib/useCoarsePointer';

interface Props {
  /** índice do portal ao lado do astronauta, ou -1 */
  active: number;
  onEnter: () => void;
}

/** Convite que aparece quando o astronauta para ao lado de um portal. */
export default function PortalPrompt({ active, onEnter }: Props) {
  const touch = useCoarsePointer();
  return (
    <>
      {portals.map((portal, i) => (
        <div
          key={portal.name}
          className={`secao-ui${active === i ? ' is-visible' : ''}`}
          style={{ '--accent': PORTALS[i].css } as CSSProperties}
        >
          <div className="secao-card portal-card">
            <p className="hud-label">
              <span className="hud-label__where">
                Portal <b>{String(i + 1).padStart(2, '0')}</b>
              </span>
              {portal.tag}
            </p>
            <h2>{portal.name}</h2>
            <p className="portal-hint">{portal.hint}</p>
            <button type="button" className="portal-btn" onClick={onEnter} disabled={active !== i}>
              Entrar no portal
            </button>
            <p className="portal-key">
              {touch ? 'ou deslize para cima para continuar a viagem' : 'ou pressione Enter · role para continuar a viagem'}
            </p>
          </div>
        </div>
      ))}
    </>
  );
}
