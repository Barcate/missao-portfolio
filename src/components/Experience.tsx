import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AudioEngine } from '../lib/audio/AudioEngine';
import { PortfolioScene } from '../lib/scene/PortfolioScene';
import type { SceneState } from '../lib/scene/config';
import FocusBar from './FocusBar';
import Hud from './Hud';
import Loader from './Loader';
import NavTabs from './NavTabs';
import PortalPrompt from './PortalPrompt';
import StartScreen from './StartScreen';
import StoryOverlay from './StoryOverlay';
import '../styles/portals.css';
import '../styles/mobile.css'; // por último: sobrescreve os estilos de desktop

export default function Experience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PortfolioScene | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);

  const [state, setState] = useState<SceneState>('loading');
  const [hudVisible, setHudVisible] = useState(false);
  const [prompt, setPrompt] = useState(-1); // portal ao lado do astronauta
  const [world, setWorld] = useState(-1); // mundo em que ele está
  const [beat, setBeat] = useState(0); // passo de texto dentro do mundo
  const [warp, setWarp] = useState({ on: false, color: '#ffffff' });
  const [muted, setMuted] = useState(false);
  const [journey, setJourney] = useState(false); // já passou pela dock (o menu persistente só existe depois)
  const [focus, setFocus] = useState(false); // "entrar no site": câmera de frente + iframe clicável

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new PortfolioScene(canvas, {
      onStateChange: setState,
      onHudChange: setHudVisible,
      onSectionChange: setPrompt,
      onWorldChange: setWorld,
      onBeatChange: setBeat,
      onFocusChange: setFocus,
      onTransition: (on, color) => setWarp({ on, color }),
    });
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (hudVisible) setJourney(true);
  }, [hudVisible]);

  // áudio reage ao que acontece na cena
  useEffect(() => {
    audioRef.current?.setWorld(world);
  }, [world]);
  useEffect(() => {
    if (warp.on) audioRef.current?.whoosh();
  }, [warp.on]);
  useEffect(() => {
    if (world >= 0) audioRef.current?.step();
  }, [world, beat]);

  const handleStart = useCallback(() => {
    // o clique é o gesto que libera o áudio no navegador
    audioRef.current ??= new AudioEngine();
    audioRef.current.start();
    sceneRef.current?.start();
  }, []);
  const handleEnter = useCallback(() => sceneRef.current?.enterPortal(), []);
  const handleExit = useCallback(() => sceneRef.current?.exitPortal(), []);
  const handleGo = useCallback((i: number) => sceneRef.current?.goToBeat(i), []);
  const handleNavigate = useCallback((section: number) => sceneRef.current?.goToSection(section), []);
  const handleFocus = useCallback((on: boolean) => sceneRef.current?.setFocus(on), []);
  const handleTick = useCallback(() => audioRef.current?.blip(), []);
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      audioRef.current?.setMuted(!m);
      return !m;
    });
  }, []);

  const started = state !== 'loading' && state !== 'start';

  return (
    <>
      <canvas ref={canvasRef} id="webgl" />

      <Loader visible={state === 'loading'} />
      <StartScreen visible={state === 'start'} onStart={handleStart} />
      <Hud visible={hudVisible} onNavigate={handleNavigate} />
      <NavTabs
        visible={journey && !hudVisible && !focus}
        active={world >= 0 ? world : prompt}
        onNavigate={handleNavigate}
      />
      <PortalPrompt active={prompt} onEnter={handleEnter} />
      <StoryOverlay
        world={focus ? -1 : world} /* em foco o card some e o site ocupa a tela */
        beat={beat}
        interactive={focus}
        onInteract={handleFocus}
        onExit={handleExit}
        onGo={handleGo}
        onTick={handleTick}
      />

      <FocusBar world={world} beat={beat} open={focus} onClose={() => handleFocus(false)} />

      {started && (
        <button type="button" className="sound-toggle" onClick={toggleMute} aria-pressed={!muted}>
          SOM {muted ? 'OFF' : 'ON'}
        </button>
      )}

      {/* flash ao atravessar o portal */}
      <div className={`warp${warp.on ? ' is-on' : ''}`} style={{ '--warp': warp.color } as CSSProperties} />
    </>
  );
}
