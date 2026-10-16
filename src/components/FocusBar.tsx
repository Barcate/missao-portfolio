import { useEffect } from 'react';
import { stories } from '../data/portfolio';

interface Props {
  world: number;
  beat: number;
  open: boolean;
  onClose: () => void;
}

/** Barra flutuante enquanto você está "dentro" do site (o card some e a câmera fica de frente para ele). */
export default function FocusBar({ world, beat, open, onClose }: Props) {
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
    <div className="focus-bar" role="toolbar" aria-label={`Navegando em ${data.title}`}>
      <button type="button" className="embed-modal__btn" onClick={onClose}>
        ✕ SAIR DO SITE (Esc)
      </button>
      <a href={data.embed} target="_blank" rel="noreferrer" className="embed-modal__btn">
        ↗ NOVA ABA
      </a>
    </div>
  );
}
