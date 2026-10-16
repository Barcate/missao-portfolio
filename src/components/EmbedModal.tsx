import { useEffect, type CSSProperties } from 'react';
import { stories } from '../data/portfolio';
import { PORTALS } from '../lib/scene/config';

interface Props {
  world: number;
  beat: number;
  open: boolean;
  onClose: () => void;
}

/** Janela grande com o site do projeto funcionando de verdade (o quadro 3D é só a pré-visualização). */
export default function EmbedModal({ world, beat, open, onClose }: Props) {
  const data = world >= 0 ? stories[world][beat] : undefined;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !data?.embed) return null;

  return (
    <div
      className="embed-modal"
      role="dialog"
      aria-modal="true"
      aria-label={data.title}
      style={{ '--accent': PORTALS[world].css } as CSSProperties}
    >
      <div className="embed-modal__bar">
        <span className="embed-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="embed-modal__title">{data.title}</span>
        <a href={data.embed} target="_blank" rel="noreferrer" className="embed-modal__btn">
          ↗ NOVA ABA
        </a>
        <button type="button" className="embed-modal__btn" onClick={onClose}>
          ✕ FECHAR (Esc)
        </button>
      </div>
      <iframe
        src={data.embed}
        title={data.title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
