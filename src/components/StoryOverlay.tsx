import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { stories, type Beat } from '../data/portfolio';
import { PORTALS } from '../lib/scene/config';
import { useCoarsePointer } from '../lib/useCoarsePointer';
import '../styles/story.css';

type Mode = 'blur' | 'terminal' | 'radio';
const MODES: Mode[] = ['blur', 'terminal', 'radio'];
const GLYPHS: Record<Mode, string> = {
  blur: '·•○◌+',
  terminal: '01<>/\\{}[]#$%&*',
  radio: '▒░▓#%@*+=~',
};

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Texto que se "decodifica": cada letra aparece no lugar de glifos embaralhados. */
function Scrambled({ text, mode, delay = 0, onTick }: { text: string; mode: Mode; delay?: number; onTick?: () => void }) {
  const [out, setOut] = useState(reducedMotion() ? text : '');

  useEffect(() => {
    if (reducedMotion()) {
      setOut(text);
      return;
    }
    const glyphs = GLYPHS[mode];
    const charMs = mode === 'terminal' ? 22 : 30;
    const start = performance.now() + delay;
    let raf = 0;
    let lastRevealed = -1;

    const loop = (now: number) => {
      const t = now - start;
      if (t < 0) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const revealed = Math.min(text.length, Math.floor(t / charMs));
      let s = text.slice(0, revealed);
      for (let i = 0; i < Math.min(3, text.length - revealed); i++) {
        const ch = text[revealed + i];
        s += ch === ' ' ? ' ' : glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      setOut(s);
      if (revealed !== lastRevealed && revealed % 2 === 0 && revealed < text.length) onTick?.();
      lastRevealed = revealed;
      if (revealed < text.length) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [text, mode, delay, onTick]);

  const done = out === text;
  return (
    <span className={`sx${done ? ' is-done' : ''}`} aria-label={text}>
      <span className="sx-ghost" aria-hidden="true">
        {text}
      </span>
      <span className="sx-live" aria-hidden="true">
        {out}
      </span>
    </span>
  );
}

/** Palavras que surgem uma a uma saindo do desfoque. */
function BlurWords({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="bw" style={{ animationDelay: `${delay + i * 70}ms` }}>
            {word}
          </span>{' '}
        </Fragment>
      ))}
    </>
  );
}

function Typed({ text, mode, delay, onTick }: { text: string; mode: Mode; delay?: number; onTick?: () => void }) {
  return mode === 'blur' ? <BlurWords text={text} delay={delay} /> : <Scrambled text={text} mode={mode} delay={delay} onTick={onTick} />;
}

interface Props {
  /** mundo atual (-1 = fora de qualquer mundo) */
  world: number;
  beat: number;
  /** modo "Interagir" com o site embutido ligado */
  interactive: boolean;
  onInteract: (on: boolean) => void;
  onExit: () => void;
  onGo: (beat: number) => void;
  onTick: () => void;
}

/** Texto do passo atual de cada mundo, com animação própria e navegação por pontinhos. */
export default function StoryOverlay({ world, beat, interactive, onInteract, onExit, onGo, onTick }: Props) {
  const touch = useCoarsePointer();
  const visible = world >= 0;
  const last = useRef({ world: 0, beat: 0 });
  if (visible) last.current = { world, beat };
  const w = last.current.world;
  const list: Beat[] = stories[w];
  const b = list[Math.min(last.current.beat, list.length - 1)];
  const mode = MODES[w];
  const isLast = last.current.beat >= list.length - 1;

  return (
    <div className={`secao-ui story${visible ? ' is-visible' : ''}`}>
      <div
        className={`secao-card story-card mode-${mode}`}
        style={{ '--accent': PORTALS[w].css } as CSSProperties}
        aria-live="polite"
      >
        {/* key: remonta o conteúdo a cada passo para reiniciar as animações */}
        <div key={`${w}-${last.current.beat}`} className="story-body">
          <span className="secao-tag">
            <Typed text={b.kicker} mode={mode === 'blur' ? 'terminal' : mode} onTick={onTick} />
          </span>
          <h2>
            <Typed text={b.title} mode={mode} delay={250} onTick={onTick} />
          </h2>
          {b.meta && <span className="meta-chip">{b.meta}</span>}
          {b.lines.map((line, i) => (
            <p key={line}>
              <Typed text={line} mode={mode} delay={700 + i * 400} onTick={onTick} />
            </p>
          ))}
          {b.embed && (
            <button
              type="button"
              className={`portal-btn portal-btn--sm${interactive ? ' is-on' : ''}`}
              onClick={() => onInteract(true)}
              disabled={!visible}
            >
              {interactive ? '✕ SAIR DO SITE' : '◈ ENTRAR NO SITE'}
            </button>
          )}
          {b.links && (
            <div className="contato-links">
              {b.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="contato-link"
                  {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="story-dots" role="tablist" aria-label="Passos">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === last.current.beat}
              aria-label={`Passo ${i + 1} de ${list.length}`}
              className={`story-dot${i === last.current.beat ? ' is-on' : ''}`}
              onClick={() => onGo(i)}
              disabled={!visible}
            />
          ))}
        </div>
        <p className="story-hint">
          {touch
            ? isLast
              ? '↓ deslize para baixo para voltar'
              : '↑ deslize para cima para continuar'
            : isLast
              ? '↑ role para voltar · Esc sai do portal'
              : '↓ role para continuar'}
        </p>

        <button type="button" className="portal-btn portal-btn--ghost" onClick={onExit} disabled={!visible}>
          ← VOLTAR AO ESPAÇO
        </button>
      </div>
    </div>
  );
}
