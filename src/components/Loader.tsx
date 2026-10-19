import { useEffect, useRef, useState } from 'react';

/** Checklist de pré-lançamento: cada etapa "conclui" quando o progresso passa do limite dela. */
const STEPS = [
  { at: 0.06, label: 'Sistemas de suporte de vida' },
  { at: 0.55, label: 'Acoplando à doca espacial' },
  { at: 0.8, label: 'Vestindo o astronauta' },
  { at: 0.92, label: 'Alinhando os portais' },
  { at: 1, label: 'Aquecendo os motores' },
];

const TIPS = [
  'Role a página para viajar entre os portais.',
  'Dentro de um mundo, role para avançar a história.',
  'Clique nos sites dos projetos para navegar neles.',
];

interface Props {
  visible: boolean;
  /** 0..1 */
  progress: number;
}

export default function Loader({ visible, progress }: Props) {
  // número exibido corre suave atrás do progresso real e nunca volta para trás
  const [shown, setShown] = useState(0);
  const target = useRef(0);
  target.current = Math.max(target.current, progress);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setShown((s) => {
        const goal = target.current;
        const next = s + (goal - s) * (1 - Math.exp(-dt * 6));
        return goal - next < 0.002 ? goal : next;
      });
      raf = requestAnimationFrame(tick);
    };
    if (visible) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  const [tip, setTip] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3800);
    return () => window.clearInterval(id);
  }, [visible]);

  const pct = Math.floor(shown * 100);
  const current = STEPS.findIndex((s) => shown < s.at);

  return (
    <div
      className={`screen loader${visible ? ' is-visible' : ''}`}
      role="progressbar"
      aria-label="Carregando a missão"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="loader-stars" aria-hidden="true" />
      <div className="loader-content">
        <p className="loader-kicker">Preparando a decolagem</p>
        <p className="loader-pct" aria-hidden="true">
          {pct}
          <span>%</span>
        </p>
        <div className="loader-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${shown})` }} />
        </div>

        <ul className="loader-steps">
          {STEPS.map((s, i) => {
            const status = current === -1 || i < current ? 'done' : i === current ? 'now' : 'todo';
            return (
              <li key={s.label} className={`is-${status}`}>
                {s.label}
              </li>
            );
          })}
        </ul>

        <p key={tip} className="loader-tip">
          {TIPS[tip]}
        </p>
      </div>
    </div>
  );
}
