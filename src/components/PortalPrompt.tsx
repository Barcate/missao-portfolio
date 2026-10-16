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
        <div key={portal.name} className={`secao-ui${active === i ? ' is-visible' : ''}`}>
          <div className="secao-card portal-card" style={{ '--accent': PORTALS[i].css } as CSSProperties}>
            <span className="secao-tag">{portal.tag}</span>
            <h2>
              Portal
              <br />
              {portal.name}
            </h2>
            <p className="portal-hint">{portal.hint}</p>
            <button type="button" className="portal-btn" onClick={onEnter} disabled={active !== i}>
              ENTRAR NO PORTAL →
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
