import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { portals, stories, type Beat } from '../data/portfolio';
import { PORTALS } from '../lib/scene/config';
import { useCoarsePointer } from '../lib/useCoarsePointer';
import '../styles/story.css';

/** Glifos de cada mundo para o rótulo que se "decodifica". */
const GLYPHS = ['·•○◌+', '01<>/\\{}[]#', '▒░▓#%*+=~'];

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pad = (n: number) => String(n).padStart(2, '0');

/** Texto que se "decodifica": cada letra aparece no lugar de glifos embaralhados. */
function Scrambled({ text, glyphs, delay = 0, onTick }: { text: string; glyphs: string; delay?: number; onTick?: () => void }) {
  const [out, setOut] = useState(reducedMotion() ? text : '');

  useEffect(() => {
    if (reducedMotion()) {
      setOut(text);
      return;
    }
    const charMs = 26;
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
  }, [text, glyphs, delay, onTick]);

  return (
    <span className="sx" aria-label={text}>
      <span className="sx-ghost" aria-hidden="true">
        {text}
      </span>
      <span className="sx-live" aria-hidden="true">
        {out}
      </span>
    </span>
  );
}

/** Palavras que sobem uma a uma, saindo de trás de uma máscara. */
function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="w">
            <span style={{ animationDelay: `${delay + i * 45}ms` }}>{word}</span>
          </span>{' '}
        </Fragment>
      ))}
    </>
  );
}

interface Props {
  /** mundo atual (-1 = fora de qualquer mundo) */
  world: number;
  beat: number;
  onExit: () => void;
  onGo: (beat: number) => void;
  onTick: () => void;
}

/** Texto do passo atual de cada mundo, direto sobre a cena (sem caixa), com navegação por traços. */
export default function StoryOverlay({ world, beat, onExit, onGo, onTick }: Props) {
  const touch = useCoarsePointer();
  const visible = world >= 0;
  const last = useRef({ world: 0, beat: 0 });
  if (visible) last.current = { world, beat };
  const w = last.current.world;
  const list: Beat[] = stories[w];
  const step = Math.min(last.current.beat, list.length - 1);
  const b = list[step];
  const isLast = step >= list.length - 1;

  return (
    <div className={`secao-ui story${visible ? ' is-visible' : ''}`} style={{ '--accent': PORTALS[w].css } as CSSProperties}>
      <div className="secao-card story-card" aria-live="polite">
        {/* key: remonta o conteúdo a cada passo para reiniciar as animações */}
        <div key={`${w}-${step}`} className="story-body">
          <p className="hud-label">
            <span className="hud-label__where">
              {portals[w].name} <b>{pad(step + 1)}</b>/{pad(list.length)}
            </span>
            <Scrambled text={b.kicker} glyphs={GLYPHS[w]} delay={120} onTick={onTick} />
          </p>
          <h2>
            <Words text={b.title} delay={150} />
          </h2>
          {b.meta && <span className="meta-chip">{b.meta}</span>}
          {b.lines.map((line, i) => (
            <p key={line} className="story-line">
              <Words text={line} delay={450 + i * 250} />
            </p>
          ))}
          {(b.embed || b.links) && (
            <div className="story-actions">
              {b.embed && <p className="story-cta">{touch ? 'Toque no site para navegar' : 'Clique no site para navegar'}</p>}
              {b.links && (
                <div className="contato-links">
                  {b.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className={`contato-link${link.external ? ' is-external' : ''}`}
                      {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="story-foot">
          <div className="story-dots" role="tablist" aria-label="Passos">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Passo ${i + 1} de ${list.length}`}
                className={`story-dot${i === step ? ' is-on' : ''}${i < step ? ' is-past' : ''}`}
                onClick={() => onGo(i)}
                disabled={!visible}
              />
            ))}
          </div>
          <p className="story-hint">
            {touch
              ? isLast
                ? 'deslize para baixo para voltar'
                : 'deslize para cima para continuar'
              : isLast
                ? 'role para cima para voltar · Esc sai'
                : 'role para continuar'}
          </p>
        </div>

        <button type="button" className="portal-btn portal-btn--ghost" onClick={onExit} disabled={!visible}>
          ← Voltar ao espaço
        </button>
      </div>
    </div>
  );
}
