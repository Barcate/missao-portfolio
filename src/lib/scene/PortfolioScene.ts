import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';
import {
  ASTRONAUT_SCALE,
  BG_COLOR,
  CAM_HEIGHT,
  CAM_OFFSET_Z,
  CLIPS,
  DOCK_POS,
  PORTALS,
  SECTIONS,
  type SceneState,
} from './config';
import { Portal } from './Portal';
import { stories } from '../../data/portfolio';
import { removeEmbedLayer } from './ProjectFrame';
import { createWorld, type BeatPose, type World } from './worlds';
import { FireSystem } from './FireSystem';
import { createBlackHole } from './blackHole';
import { createStars } from './stars';

export interface SceneCallbacks {
  onStateChange: (state: SceneState) => void;
  onHudChange: (visible: boolean) => void;
  /** índice da seção visível, ou -1 quando nenhuma */
  onSectionChange: (index: number) => void;
  /** índice do mundo (portal) em que o astronauta está, ou -1 quando fora */
  onWorldChange: (index: number) => void;
  /** passo de texto atual dentro do mundo (0 = abertura) */
  onBeatChange: (beat: number) => void;
  /** "entrar no site" ligado/desligado (câmera de frente + clique/rolagem dentro do iframe) */
  onFocusChange: (on: boolean) => void;
  /** flash de transição ao atravessar o portal (cor css do portal) */
  onTransition: (active: boolean, color: string) => void;
}

type ActionName = keyof typeof CLIPS;
type Actions = Record<ActionName, THREE.AnimationAction>;

const ASSETS = `${import.meta.env.BASE_URL}assets`;

/** Osso raiz do astronauta: o clipe "jump" traz movimento embutido nele (desce ~5 e avança ~10). */
const ROOT_BONE = 'root_01';
/** Duração do salto/impulso até a primeira seção (s) e altura de cruzeiro. */
const JUMP_TRAVEL = 3.0;
const CRUISE_Y = 14;

export class PortfolioScene {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly clock = new THREE.Clock();
  private readonly stars = createStars();

  private astronaut: THREE.Object3D | null = null;
  private spaceDock: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Actions | null = null;
  private fire: FireSystem | null = null;
  private blackHole: THREE.Group | null = null;

  // portais e mundos
  private readonly portals: Portal[] = [];
  private world: World | null = null;
  private worldIndex = -1;
  private activeScene: THREE.Scene = this.scene;
  private elapsed = 0;
  private readonly pointer = new THREE.Vector2();

  // "entrar no site": câmera de frente para o quadro e iframe clicável
  private focusOn = false;
  /** aba clicada no menu: seção a abrir assim que o astronauta chegar nela */
  private pendingNav: number | null = null;
  private turbo = false; // trajeto de aba clicada: animações 1,5× mais rápidas
  private inputLocked = false; // em foco: rolar/teclas não navegam (são do site)

  // passos de texto dentro do mundo
  private beat = 0;
  private readonly home = new THREE.Vector3(); // posição-base do astronauta (tweenada entre passos)
  private readonly camGoal = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private beatTl: gsap.core.Timeline | null = null;

  private state: SceneState = 'loading';
  private animating = false;
  private journeyActive = false;
  private currentSection = -1;

  // Entrada do usuário (wheel / touch / teclado): navegação por PASSOS, independente da posição de scroll
  private lockUntil = 0;
  private lastWheelAt = 0;
  private lastWheelDir = 0;
  private gestureUsed = false;
  private touchStartY: number | null = null;
  private savedStyles: { html: string; body: string; htmlOv: string; bodyOv: string } | null = null;

  // layout responsivo
  private portrait = false; // tela vertical (celular em pé): enquadramento próprio
  private readonly lite: boolean; // aparelho de toque pequeno: menos partículas e resolução menor
  private viewShift = 0; // fração da altura que a cena sobe para abrir espaço ao painel de baixo

  /** 'orbit' = OrbitControls · 'follow' = câmera segue o astronauta */
  private camMode: 'orbit' | 'follow' | 'world' = 'orbit';
  private camOffsetZ = CAM_OFFSET_Z;

  private rafId = 0;
  private timeline: gsap.core.Timeline | null = null;
  private hoverTl: gsap.core.Timeline | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cb: SceneCallbacks,
  ) {
    this.lite = window.matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 820;
    this.portrait = this.isPortrait();

    this.scene.background = new THREE.Color(BG_COLOR);
    this.scene.fog = new THREE.FogExp2(BG_COLOR, 0.0025);

    this.camera = new THREE.PerspectiveCamera(this.portrait ? 68 : 60, innerWidth / innerHeight, 0.1, 2000);
    this.camera.position.set(0, 20, 80);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); // alpha: o "buraco" que mostra o iframe
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.lite ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enableZoom = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.target.set(0, 15, 0);

    this.setupLights();
    this.scene.add(this.stars);
    this.setupPortals();
    this.loadModels();

    this.lockPageScroll();
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('resize', this.onResize);
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════
  // API pública
  // ═══════════════════════════════════════════════════════════════

  /** Botão "INICIAR MISSÃO": giro cinematográfico até a dock. */
  start(): void {
    if (this.state !== 'start') return;
    this.setState('transitioning');

    this.controls.autoRotate = false;
    this.controls.enabled = false;

    const lookAtDock = () => this.camera.lookAt(0, 15, 0);

    this.timeline = gsap
      .timeline()
      // giro lateral
      .to(this.camera.position, { x: 100, y: 10, z: -100, duration: 1.5, ease: 'power2.out', onUpdate: lookAtDock }, 0)
      // fecha nas costas
      .to(this.camera.position, { x: 0, y: 20, z: -10, duration: 2, ease: 'power2.out', onUpdate: lookAtDock }, 1)
      .add(() => this.cb.onHudChange(true), 1.5)
      .add(() => {
        this.setState('dock');
        this.journeyActive = true;
        this.lockUntil = performance.now() + 400; // ignora a inércia do scroll feito durante a intro
      }, 3);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    this.beatTl?.kill();
    this.world?.dispose();
    this.unlockPageScroll();
    window.removeEventListener('resize', this.onResize);

    this.timeline?.kill();
    this.hoverTl?.kill();
    gsap.killTweensOf([this.camera.position, this.canvas]);
    if (this.astronaut) {
      gsap.killTweensOf([this.astronaut.position, this.astronaut.rotation, this.astronaut.scale]);
    }

    this.controls.dispose();
    this.fire?.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const materials: THREE.Material[] = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((m) => m.dispose());
      }
    });
    removeEmbedLayer();
    this.renderer.dispose();
  }

  // ═══════════════════════════════════════════════════════════════
  // Setup
  // ═══════════════════════════════════════════════════════════════

  private setState(state: SceneState): void {
    this.state = state;
    this.cb.onStateChange(state);
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(5, 10, 7);
    this.scene.add(sun);

    const space = new THREE.PointLight(0x0044ff, 1.0, 400);
    space.position.set(-30, 40, 100);
    this.scene.add(space);
  }

  private loadModels(): void {
    const manager = new THREE.LoadingManager();
    manager.onLoad = () => {
      if (this.state === 'loading') this.setState('start');
    };
    const loader = new GLTFLoader(manager);

    loader.load(`${ASSETS}/spacedock.glb`, (gltf) => {
      const dock = gltf.scene;
      dock.position.set(0, 19, 0);
      dock.scale.set(5, 5, 5);
      dock.rotation.x = Math.PI;
      dock.rotation.y = Math.PI;
      this.spaceDock = dock;
      this.scene.add(dock);
    });

    loader.load(`${ASSETS}/astronauta.glb`, (gltf) => {
      const astronaut = gltf.scene;
      astronaut.position.copy(DOCK_POS);
      astronaut.scale.setScalar(ASTRONAUT_SCALE);
      this.astronaut = astronaut;
      this.scene.add(astronaut);

      const mixer = new THREE.AnimationMixer(astronaut);
      // O deslocamento é feito pelo GSAP; o clipe só deve mexer o corpo (sem root motion)
      const clip = gltf.animations[0].clone();
      const before = clip.tracks.length;
      clip.tracks = clip.tracks.filter((t) => t.name !== `${ROOT_BONE}.position`);
      if (clip.tracks.length === before) {
        console.warn(`[PortfolioScene] track ${ROOT_BONE}.position não encontrada — root motion mantido`);
      }
      const action = (name: ActionName) => {
        const [from, to, fps] = CLIPS[name];
        return mixer.clipAction(THREE.AnimationUtils.subclip(clip, name, from, to, fps));
      };

      this.mixer = mixer;
      this.actions = { idle: action('idle'), run: action('run'), jump: action('jump') };
      this.actions.idle.play();

      // O FireSystem se prende ao astronauta sozinho — NÃO adicionar fire.object à cena,
      // senão ele é "roubado" do astronauta e fica parado na origem.
      this.fire = new FireSystem(astronaut);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Loop, resize e câmera
  // ═══════════════════════════════════════════════════════════════

  private animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();

    this.elapsed += dt;

    this.mixer?.update(dt);
    this.fire?.update(dt);
    this.portals.forEach((p) => p.update(this.elapsed));
    this.world?.update(this.elapsed, dt);

    if (this.camMode === 'orbit') this.controls.update();
    else if (this.camMode === 'follow') this.followCamera(dt);
    else this.updateWorldCamera(dt);

    // dentro do mundo: astronauta flutua parado
    if (this.state === 'world' && this.astronaut && this.world) {
      this.astronaut.position.set(this.home.x, this.home.y + Math.sin(this.elapsed * 1.3) * 0.8, this.home.z);
      this.astronaut.rotation.z = Math.sin(this.elapsed * 0.9) * 0.05;
    }

    this.stars.rotation.y += 0.00008;
    if (this.blackHole) this.blackHole.rotation.z += 0.008;

    this.updateViewShift(dt);
    // tela vertical: um portal por vez (o da seção atual; o próximo só durante o voo) e nenhum na dock,
    // senão eles se empilham na pouca largura e cobrem o menu
    if (this.portrait) {
      const cur = this.currentSection;
      const idle = !this.journeyActive || this.state === 'dock';
      this.portals.forEach((p, i) => {
        const dest = cur === -1 ? 0 : cur;
        p.group.visible = !idle && (i === dest || (this.animating && i === dest + 1));
      });
    } else {
      this.portals.forEach((p) => (p.group.visible = true));
    }
    // iframes: projetados com a MESMA câmera/projeção deste quadro (alinham com o "buraco" do canvas)
    this.camera.updateMatrixWorld();
    this.world?.layoutEmbeds?.(this.camera, innerWidth, innerHeight);
    this.renderer.render(this.activeScene, this.camera);
  };

  private onResize = (): void => this.applyLayout();

  private isPortrait(): boolean {
    return innerWidth / innerHeight < 0.85;
  }

  /** Ajusta tudo que depende do formato da tela (celular em pé × paisagem). */
  private applyLayout(): void {
    const portrait = this.isPortrait();
    const changed = portrait !== this.portrait;
    this.portrait = portrait;

    this.camera.aspect = innerWidth / innerHeight;
    this.camera.fov = portrait ? 68 : 60;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.updateViewShift(0, true);

    if (changed) {
      this.layoutPortals();
      this.world?.setLayout(portrait);
      this.snapWorldPose();
    }
  }

  /** Em tela vertical a cena sobe um pouco para o painel de texto ocupar a parte de baixo. */
  private updateViewShift(dt: number, force = false): void {
    const goal = this.portrait && this.journeyActive && this.state !== 'dock' && !this.focusOn ? 0.2 : 0;
    let next = this.viewShift;
    if (!force) {
      next += (goal - next) * (1 - Math.exp(-dt * 4));
      if (Math.abs(goal - next) < 1e-3) next = goal;
      if (next === this.viewShift) return;
    }
    this.viewShift = next;
    if (next === 0) this.camera.clearViewOffset();
    else this.camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * next, innerWidth, innerHeight);
  }

  /** Em tela vertical: centraliza astronauta/alvo e afasta a câmera para caber a largura. */
  private adapt(pose: BeatPose): BeatPose {
    if (!this.portrait) return pose;
    const k = 0.15;
    pose.astro.x = pose.cam.x + (pose.astro.x - pose.cam.x) * k;
    pose.astro.y -= 4; // um pouco mais baixo: não cobre o holograma/palavra
    pose.target.x = pose.cam.x + (pose.target.x - pose.cam.x) * k;
    pose.cam.sub(pose.target).multiplyScalar(1.45).add(pose.target);
    return pose;
  }

  /** Ao girar o aparelho dentro de um mundo: reenquadra o passo atual sem animar. */
  private snapWorldPose(): void {
    const { world, astronaut } = this;
    if (!world || !astronaut) return;
    this.beatTl?.kill();
    const pose = this.adapt(world.pose(this.beat));
    this.camGoal.pos.copy(pose.cam);
    this.camGoal.target.copy(pose.target);
    this.home.copy(pose.astro);
    astronaut.rotation.y = pose.facing;
  }

  /** Suavização exponencial (independente de fps) em direção ao ponto atrás do astronauta. */
  private followCamera(dt: number): void {
    if (!this.astronaut) return;
    const { x, y, z } = this.astronaut.position;
    const k = 1 - Math.exp(-dt * 9); // ≈ 0.14 a 60fps

    this.camera.position.x += (x - this.camera.position.x) * k;
    this.camera.position.y += (y + CAM_HEIGHT - this.camera.position.y) * k;
    this.camera.position.z += (z + this.camOffsetZ - this.camera.position.z) * k;

    const lookAheadZ = this.camOffsetZ < 0 ? z + 15 : z - 15;
    this.camera.lookAt(x, y + 2, lookAheadZ);
  }

  // ═══════════════════════════════════════════════════════════════
  // Navegação por passos: rolou p/ baixo = avança · rolou p/ cima = volta
  // (não depende da posição de scroll da página, então nunca "dessincroniza")
  // ═══════════════════════════════════════════════════════════════

  private lockPageScroll(): void {
    const { documentElement: html, body } = document;
    this.savedStyles = {
      html: html.style.overflow,
      body: body.style.overflow,
      htmlOv: html.style.overscrollBehavior,
      bodyOv: body.style.overscrollBehavior,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none'; // sem puxar-para-atualizar nem "elástico" no celular
    body.style.overscrollBehavior = 'none';
    window.scrollTo(0, 0);
  }

  private unlockPageScroll(): void {
    if (!this.savedStyles) return;
    document.documentElement.style.overflow = this.savedStyles.html;
    document.body.style.overflow = this.savedStyles.body;
    document.documentElement.style.overscrollBehavior = this.savedStyles.htmlOv;
    document.body.style.overscrollBehavior = this.savedStyles.bodyOv;
    this.savedStyles = null;
  }

  /** Fim de qualquer animação: libera, mas com uma trava curta para absorver a inércia do scroll. */
  private endAnimation(): void {
    this.animating = false;
    this.lockUntil = performance.now() + 350;
  }

  private get busy(): boolean {
    return this.animating || performance.now() < this.lockUntil;
  }

  /** dir: +1 = avançar · -1 = voltar */
  private navigate(dir: 1 | -1): void {
    if (!this.journeyActive || this.busy) return;
    this.pendingNav = null; // navegar na mão cancela uma aba clicada que ainda estava a caminho
    this.turbo = false;

    // dentro de um mundo: rolar avança/volta os passos do texto; no 1º passo, rolar para cima sai do portal
    if (this.state === 'world') {
      const w = this.world;
      if (!w || this.inputLocked) return; // janela do site aberta: rolar é dela

      if (dir > 0) {
        if (this.beat < w.beats - 1) this.goBeat(this.beat + 1);
      } else if (this.beat > 0) {
        this.goBeat(this.beat - 1);
      } else {
        this.exitPortal();
      }
      return;
    }

    if (this.state === 'dock') {
      if (dir > 0) this.takeOff();
      return;
    }
    if (this.state !== 'floating') return;

    const last = SECTIONS.length - 1;
    if (dir > 0) {
      if (this.currentSection < last) this.flyToSection(this.currentSection + 1);
      else this.enterBlackHole();
    } else if (this.currentSection > 0) {
      this.flyToSection(this.currentSection - 1);
    } else {
      this.returnToDock();
    }
  }

  /**
   * Um GESTO = um passo. Eventos seguidos (< 80 ms, mesma direção) fazem parte do mesmo gesto,
   * o que absorve a inércia do trackpad; inverter o sentido já conta como gesto novo.
   */
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const dir = Math.sign(e.deltaY);
    if (dir === 0) return;

    const now = performance.now();
    if (now - this.lastWheelAt > 80 || dir !== this.lastWheelDir) this.gestureUsed = false;
    this.lastWheelAt = now;
    this.lastWheelDir = dir;

    if (Math.abs(e.deltaY) < 4 || this.gestureUsed || this.busy) return;

    this.gestureUsed = true;
    this.navigate(dir > 0 ? 1 : -1);
  };

  private onTouchStart = (e: TouchEvent): void => {
    // deslizar dentro de um card com texto rolável é para rolar o card, não para navegar
    const card = (e.target as Element | null)?.closest?.('.secao-card') as HTMLElement | null;
    if (card && card.scrollHeight > card.clientHeight + 1) {
      this.touchStartY = null;
      return;
    }
    this.touchStartY = e.touches[0]?.clientY ?? null;
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (this.touchStartY === null) return;
    const dy = this.touchStartY - (e.changedTouches[0]?.clientY ?? this.touchStartY);
    this.touchStartY = null;
    if (Math.abs(dy) < 40) return; // arrastar para cima (dy > 0) = avançar
    this.navigate(dy > 0 ? 1 : -1);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat || this.inputLocked) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
      e.preventDefault();
      this.navigate(1);
    } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
      e.preventDefault();
      this.navigate(-1);
    } else if (e.key === 'Enter') {
      if (!this.busy) this.enterPortal();
    } else if (e.key === 'Escape') {
      if (!this.busy) this.exitPortal();
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      this.pointer.set(0, 0); // sem paralaxe no toque (a última posição do dedo deslocaria a cena)
      return;
    }
    this.pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
  };

  // ═══════════════════════════════════════════════════════════════
  // Sequências de animação
  // ═══════════════════════════════════════════════════════════════

  private resetActions(): void {
    if (!this.actions) return;
    Object.values(this.actions).forEach((a) => {
      a.stop();
      a.reset();
      a.setEffectiveTimeScale(1);
    });
  }

  /** Crossfade explícito (sem warp): `to` começa do zero e `from` some em `duration`. */
  private blend(from: THREE.AnimationAction, to: THREE.AnimationAction, duration: number, timeScale = 1): void {
    to.reset().setEffectiveTimeScale(timeScale).play();
    from.crossFadeTo(to, duration, false);
  }

  private hover(): void {
    if (!this.astronaut) return;
    this.stopHover(false);
    gsap.killTweensOf(this.astronaut.position);
    gsap.killTweensOf(this.astronaut.rotation);
    if (this.fire) this.fire.active = false; // flutuando parado: jato desligado

    this.astronaut.position.x = 0;
    this.astronaut.position.z = Number(this.astronaut.position.z.toFixed(2));

    this.hoverTl = gsap
      .timeline({ repeat: -1, yoyo: true })
      .to(this.astronaut.position, { y: '+=1.8', duration: 2.6, ease: 'sine.inOut' }, 0)
      .to(this.astronaut.rotation, { z: 0.12, duration: 2.6, ease: 'sine.inOut' }, 0);
  }

  /** Para o balanço de flutuação (inclusive a inclinação em Z) e volta suave para a vertical. */
  private stopHover(smooth = true): void {
    this.hoverTl?.kill();
    this.hoverTl = null;
    if (!this.astronaut) return;
    if (smooth) gsap.to(this.astronaut.rotation, { z: 0, duration: 0.4, ease: 'power1.out' });
    else this.astronaut.rotation.z = 0;
  }

  /** Dock → corrida → salto contínuo → flutuando na primeira seção. */
  private takeOff(): void {
    const { astronaut, actions } = this;
    if (this.animating || !astronaut || !actions) return;
    this.animating = true;
    this.setState('transitioning');

    const RUN_END_Z = 24;
    const runTime = (actions.run.getClip().duration || 1.8) * 0.85;
    const jumpClipTime = actions.jump.getClip().duration || 1.4;
    const dz = SECTIONS[0].zPos - RUN_END_Z;

    // O impulso começa na velocidade da corrida (sem tranco) e desacelera suave até a seção.
    const s0 = Math.min(1, RUN_END_Z / runTime / (dz / JUMP_TRAVEL));
    const flightEase = (p: number) => s0 * (p * p * p - 2 * p * p + p) + (3 * p * p - 2 * p * p * p);

    // câmera follow liga agora — parte da posição atual, sem salto
    this.camMode = 'follow';
    this.camOffsetZ = CAM_OFFSET_Z;

    actions.jump.setLoop(THREE.LoopOnce, 1);
    actions.jump.clampWhenFinished = true;

    this.timeline = gsap
      .timeline({
        onComplete: () => {
          this.endAnimation();
          this.currentSection = 0;
          if (this.fire) this.fire.active = false;
          if (this.spaceDock) this.spaceDock.visible = false;
          this.setState('floating');
          this.hover();
          this.cb.onSectionChange(0);
          this.processPending();
        },
      })
      .add(() => this.cb.onHudChange(false))
      .to({}, { duration: 0.4 })
      // corrida
      .add(() => this.blend(actions.idle, actions.run, 0.2))
      .to(astronaut.position, { z: RUN_END_Z, duration: runTime, ease: 'none' }, '<0.15')
      // salto: a pose dura o trajeto todo; quem desloca é só o GSAP (sobe e avança, nunca desce)
      .add(() => {
        this.blend(actions.run, actions.jump, 0.18, jumpClipTime / (JUMP_TRAVEL * 0.9));
        if (this.fire) this.fire.active = true;
      })
      .to(astronaut.position, { z: SECTIONS[0].zPos, duration: JUMP_TRAVEL, ease: flightEase }, '<')
      .to(astronaut.position, { y: CRUISE_Y, duration: 1.4, ease: 'power2.out' }, '<')
      // idle flutuando
      .add(() => this.blend(actions.jump, actions.idle, 0.6));
  }

  /** Voo bidirecional entre seções. */
  private flyToSection(index: number): void {
    const { astronaut } = this;
    if (this.animating || !astronaut) return;
    this.animating = true;

    const dest = SECTIONS[index];
    const direction = index > this.currentSection ? 1 : -1;

    this.cb.onSectionChange(-1);
    this.stopHover();
    gsap.killTweensOf(astronaut.position);

    const tl = gsap
      .timeline({
        onComplete: () => {
          this.endAnimation();
          this.currentSection = index;
          this.hover();
          this.cb.onSectionChange(index);
          this.processPending();
        },
      })
      .to(astronaut.rotation, { y: direction > 0 ? 0 : Math.PI, duration: 0.5, ease: 'power1.out' })
      .add(() => {
        if (this.fire) this.fire.active = true; // jato liga quando começa a se deslocar
      }, '-=0.2')
      .to(astronaut.position, { z: dest.zPos, y: 14, duration: 2.0, ease: 'power2.inOut' }, '-=0.2');

    if (direction < 0) {
      tl.add(() => {
        if (this.fire) this.fire.active = false; // chegou: só falta girar de volta
      }).to(astronaut.rotation, { y: 0, duration: 0.5, ease: 'power1.out' });
    }
    this.timeline = tl;
  }

  /** Voo de retorno à nave com corrida só no final. */
  private returnToDock(): void {
    const { astronaut, actions } = this;
    if (this.animating || !astronaut || !actions) return;
    this.animating = true;
    this.setState('transitioning');

    this.cb.onSectionChange(-1);
    this.stopHover();
    gsap.killTweensOf(astronaut.position);
    if (this.spaceDock) this.spaceDock.visible = true;

    this.timeline = gsap
      .timeline({
        onComplete: () => {
          this.endAnimation();
          this.currentSection = -1;
          if (this.fire) this.fire.active = false;
          this.camMode = 'orbit';
          this.camOffsetZ = CAM_OFFSET_Z;
          this.controls.enabled = true;
          this.controls.autoRotate = false;
          this.resetActions();
          actions.idle.play();
          gsap.to(this.camera.position, { x: 0, y: 20, z: -10, duration: 1.5, ease: 'power2.out' });
          this.setState('dock');
          this.cb.onHudChange(true);
          this.processPending();
        },
      })
      // vira para trás e entra em voo
      .to(astronaut.rotation, { y: Math.PI, duration: 0.6 })
      .add(() => {
        astronaut.position.x = 0;
        this.camOffsetZ = +28;
        if (this.fire) this.fire.active = true; // começa o voo de volta
        this.resetActions();
        actions.idle.reset().play();
      })
      // voo principal: ainda no espaço, sem corrida
      .to(astronaut.position, { x: 0, z: 40, y: 16, duration: 1.8, ease: 'power2.inOut' }, '-=0.1')
      .to(astronaut.position, { z: DOCK_POS.z + 8, y: DOCK_POS.y + 4, duration: 1.5, ease: 'power2.inOut' }, '-=0.1')
      // só no final ele corre para pousar na plataforma
      .add(() => {
        if (this.fire) this.fire.active = false; // correndo no chão: jato desligado
        this.resetActions();
        actions.run.reset().play();
      })
      .to(astronaut.position, { z: DOCK_POS.z, y: DOCK_POS.y, duration: 1.0, ease: 'power1.out' })
      .to(astronaut.rotation, { y: 0, duration: 0.5 })
      .add(() => {
        if (this.fire) this.fire.active = false;
        this.camOffsetZ = CAM_OFFSET_Z;
        this.resetActions();
        actions.idle.reset().play();
      });
  }

  /** Última seção → buraco negro → recomeça na dock. */
  private enterBlackHole(): void {
    const { astronaut, actions } = this;
    if (this.animating || !astronaut || !actions) return;
    this.animating = true;
    this.setState('transitioning');

    this.cb.onSectionChange(-1);
    this.stopHover();
    gsap.killTweensOf(astronaut.position);

    if (this.fire) this.fire.active = true; // voa em direção ao buraco negro
    const posZ = SECTIONS[SECTIONS.length - 1].zPos + 80;
    this.removeBlackHole();
    this.blackHole = createBlackHole(posZ);
    this.scene.add(this.blackHole);

    this.timeline = gsap
      .timeline({
        onComplete: () => {
          astronaut.position.copy(DOCK_POS);
          astronaut.rotation.set(0, 0, 0);
          astronaut.scale.setScalar(ASTRONAUT_SCALE);
          if (this.spaceDock) this.spaceDock.visible = true;
          this.removeBlackHole();

          if (this.fire) this.fire.active = false;
          this.currentSection = -1;
          this.endAnimation();
          this.camMode = 'orbit';
          this.camOffsetZ = CAM_OFFSET_Z;
          this.controls.enabled = true;
          this.controls.autoRotate = false;
          this.resetActions();
          actions.idle.play();
          this.camera.position.set(0, 20, -10);
          this.camera.lookAt(0, 15, 0);

          this.setState('dock');
          this.cb.onHudChange(true);
          gsap.fromTo(this.renderer.domElement, { opacity: 0 }, { opacity: 1, duration: 1.5 });
          this.processPending();
        },
      })
      .to(astronaut.position, { z: posZ, y: 14, duration: 3, ease: 'power2.in', onUpdate: () => {
        if (this.blackHole) this.blackHole.rotation.z += 0.04;
      } })
      .to(astronaut.scale, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'power4.in' }, '-=0.5')
      .to(this.renderer.domElement, { opacity: 0, duration: 0.5 }, '-=0.3')
      .to({}, { duration: 0.8 });
  }

  // ═══════════════════════════════════════════════════════════════
  // Portais e mundos
  // ═══════════════════════════════════════════════════════════════

  private portalPosition(i: number): THREE.Vector3 {
    const [ox, oy, oz] = this.portrait ? PORTALS[i].offsetTall : PORTALS[i].offset;
    return new THREE.Vector3(ox, CRUISE_Y + oy, SECTIONS[i].zPos + oz);
  }

  private setupPortals(): void {
    PORTALS.forEach((cfg, i) => {
      const portal = new Portal(cfg.color);
      this.scene.add(portal.group);
      this.portals.push(portal);
    });
    this.layoutPortals();
  }

  /** Posiciona os portais conforme o formato da tela (ao lado em paisagem, acima em retrato). */
  private layoutPortals(): void {
    this.portals.forEach((portal, i) => {
      portal.group.position.copy(this.portalPosition(i));
      portal.group.scale.setScalar(this.portrait ? 0.75 : 1);
      portal.group.lookAt(0, CRUISE_Y + 2, SECTIONS[i].zPos - 24); // anel de frente para a câmera de follow
    });
  }

  /** Botão "ENTRAR NO PORTAL": vira para o portal, voa até ele, flash e troca de ambiente. */
  enterPortal(): void {
    const { astronaut } = this;
    if (this.state !== 'floating' || this.animating || !astronaut || this.currentSection < 0) return;

    const index = this.currentSection;
    const target = this.portalPosition(index);
    const color = PORTALS[index].css;
    const heading = Math.atan2(target.x - astronaut.position.x, target.z - astronaut.position.z);

    this.animating = true;
    this.setState('transitioning');
    this.cb.onSectionChange(-1);
    this.stopHover();
    gsap.killTweensOf(astronaut.position);

    this.timeline = gsap
      .timeline()
      .to(astronaut.rotation, { y: heading, duration: 0.6, ease: 'power2.out' }, 0)
      .add(() => {
        if (this.fire) this.fire.active = true;
      }, 0.5)
      .to(astronaut.position, { x: target.x, y: target.y, z: target.z, duration: 1.7, ease: 'power2.in' }, 0.5)
      .to(astronaut.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 1.7, ease: 'power2.in' }, 0.5)
      .add(() => this.cb.onTransition(true, color), 1.5)
      .add(() => this.swapToWorld(index), 2.2);
  }

  private swapToWorld(index: number): void {
    const { astronaut } = this;
    if (!astronaut) return;

    this.world?.dispose();
    const world = createWorld(index, stories[index], this.lite);
    world.setLayout(this.portrait);
    this.world = world;
    this.worldIndex = index;
    this.activeScene = world.scene;

    world.scene.add(astronaut); // reparenta: o astronauta passa a viver no novo ambiente
    if (this.fire) this.fire.active = false;
    const pose = this.adapt(world.pose(0));
    this.beat = 0;
    this.home.copy(pose.astro);
    this.camGoal.pos.copy(pose.cam);
    this.camGoal.target.copy(pose.target);
    astronaut.position.copy(pose.astro);
    astronaut.rotation.set(0, pose.facing, 0); // de frente para a câmera, olhando para o texto
    astronaut.scale.setScalar(0.01);

    this.resetActions();
    this.actions?.idle.play();

    this.camMode = 'world';
    this.camera.position.copy(pose.cam);
    this.camera.lookAt(pose.target);

    this.cb.onWorldChange(index);
    this.cb.onBeatChange(0);
    world.show(0);
    this.cb.onTransition(false, PORTALS[index].css);

    gsap.to(astronaut.scale, {
      x: ASTRONAUT_SCALE,
      y: ASTRONAUT_SCALE,
      z: ASTRONAUT_SCALE,
      duration: 1.1,
      ease: 'back.out(1.5)',
      onComplete: () => {
        this.turbo = false; // chegou: o mundo abriu
        this.endAnimation();
        this.setState('world');
      },
    });
  }

  /** Botão "VOLTAR AO ESPAÇO" (ou rolar para cima / Esc dentro do mundo). */
  exitPortal(): void {
    if (this.state !== 'world' || this.animating || !this.astronaut || this.worldIndex < 0) return;

    const index = this.worldIndex;
    if (this.focusOn) this.endFocus();
    this.animating = true;
    this.setState('transitioning');
    this.cb.onWorldChange(-1);
    this.beatTl?.kill();
    if (this.fire) this.fire.active = false;
    this.cb.onTransition(true, PORTALS[index].css);

    this.timeline = gsap.timeline().add(() => this.swapToSpace(index), 0.55);
  }

  private swapToSpace(index: number): void {
    const { astronaut } = this;
    if (!astronaut) return;

    const portalPos = this.portalPosition(index);
    const stop = new THREE.Vector3(0, CRUISE_Y, SECTIONS[index].zPos);

    this.scene.add(astronaut); // volta para o espaço aberto
    this.world?.dispose();
    this.world = null;
    this.worldIndex = -1;
    this.activeScene = this.scene;

    astronaut.position.copy(portalPos);
    astronaut.rotation.set(0, Math.atan2(stop.x - portalPos.x, stop.z - portalPos.z), 0);
    astronaut.scale.setScalar(1.5);

    this.resetActions();
    this.actions?.idle.play();

    this.camMode = 'follow';
    this.camOffsetZ = CAM_OFFSET_Z;
    this.camera.position.set(portalPos.x, portalPos.y + CAM_HEIGHT, portalPos.z + CAM_OFFSET_Z);
    this.cb.onTransition(false, PORTALS[index].css);

    this.timeline = gsap
      .timeline({
        onComplete: () => {
          this.endAnimation();
          if (this.fire) this.fire.active = false;
          this.setState('floating');
          this.hover();
          this.cb.onSectionChange(index);
          this.processPending();
        },
      })
      .add(() => {
        if (this.fire) this.fire.active = true;
      }, 0)
      .to(astronaut.position, { x: stop.x, y: stop.y, z: stop.z, duration: 1.6, ease: 'power2.out' }, 0.2)
      .to(astronaut.rotation, { y: 0, duration: 1.2, ease: 'power2.inOut' }, 0.3)
      .to(astronaut.scale, { x: ASTRONAUT_SCALE, y: ASTRONAUT_SCALE, z: ASTRONAUT_SCALE, duration: 1.0, ease: 'back.out(1.4)' }, 0);
    this.speedUp();
  }

  /** Câmera do mundo: segue o enquadramento do passo + leve paralaxe com o mouse. */
  private updateWorldCamera(dt: number): void {
    if (!this.world) return;
    const k = 1 - Math.exp(-dt * 3);
    const { pos, target } = this.camGoal;
    const par = this.focusOn ? 0 : 1; // em foco a câmera fica exatamente de frente (sem paralaxe)
    this.camera.position.x += (pos.x - this.pointer.x * 5 * par - this.camera.position.x) * k;
    this.camera.position.y += (pos.y + this.pointer.y * 3 * par - this.camera.position.y) * k;
    this.camera.position.z += (pos.z - this.camera.position.z) * k;
    this.camera.lookAt(target);
  }

  /**
   * "ENTRAR NO SITE": a câmera vai para a frente do quadro e o iframe passa a receber clique e rolagem.
   * Sair: botão do React / Esc (o Esc só chega aqui se o foco do teclado não estiver dentro do site).
   */
  setFocus(on: boolean): void {
    const { world } = this;
    if (on === this.focusOn || this.state !== 'world' || !world) return;

    if (on) {
      if (this.busy) return;
      const fp = world.framePose?.(this.beat, this.camera.aspect, this.camera.fov);
      if (!fp) return;
      this.focusOn = true;
      this.inputLocked = true;
      this.cb.onFocusChange(true);
      this.beatTl?.kill();
      this.beatTl = gsap
        .timeline()
        .to(this.camGoal.pos, { x: fp.cam.x, y: fp.cam.y, z: fp.cam.z, duration: 1.4, ease: 'power2.inOut' }, 0)
        .to(this.camGoal.target, { x: fp.target.x, y: fp.target.y, z: fp.target.z, duration: 1.4, ease: 'power2.inOut' }, 0)
        // o astronauta sai da frente do site
        .to(this.home, { x: fp.target.x + 26, y: 15, z: fp.target.z - 16, duration: 1.2, ease: 'power2.inOut' }, 0)
        .add(() => {
          if (!this.focusOn) return;
          world.setInteractive?.(true);
          this.canvas.style.pointerEvents = 'none'; // o clique atravessa o canvas até o iframe
        }, 1.2);
      return;
    }

    this.endFocus();
    const pose = this.adapt(world.pose(this.beat));
    this.beatTl?.kill();
    this.beatTl = gsap
      .timeline()
      .to(this.camGoal.pos, { x: pose.cam.x, y: pose.cam.y, z: pose.cam.z, duration: 1.2, ease: 'power2.inOut' }, 0)
      .to(this.camGoal.target, { x: pose.target.x, y: pose.target.y, z: pose.target.z, duration: 1.2, ease: 'power2.inOut' }, 0)
      .to(this.home, { x: pose.astro.x, y: pose.astro.y, z: pose.astro.z, duration: 1.2, ease: 'power2.inOut' }, 0);
  }

  private endFocus(): void {
    this.focusOn = false;
    this.inputLocked = false;
    this.world?.setInteractive?.(false);
    this.canvas.style.pointerEvents = '';
    this.cb.onFocusChange(false);
  }

  /**
   * Aba do menu (Sobre / Projetos / Contato): leva o astronauta até aquela seção e ABRE o portal.
   * Funciona de qualquer ponto: da dock, voando, parado numa seção ou dentro de outro mundo.
   */
  goToSection(index: number): void {
    if (!this.journeyActive || index < 0 || index >= SECTIONS.length) return;
    if (this.state === 'world' && this.worldIndex === index) return; // já está lá
    this.pendingNav = index;
    this.turbo = true;
    if (this.state === 'world') {
      this.exitPortal(); // sai do mundo atual; o resto continua quando ele chegar ao espaço
      this.speedUp();
    } else {
      this.processPending(); // dock/parado: já começa; se estiver em voo, continua ao terminar
    }
  }

  private speedUp(): void {
    if (this.turbo) this.timeline?.timeScale(1.5);
  }

  /** Dá o próximo passo rumo à aba clicada: decolar → voar até a seção → entrar no portal. */
  private processPending(): void {
    const target = this.pendingNav;
    if (target === null || this.animating) return; // se estiver animando, a conclusão chama de novo
    if (this.state === 'dock') {
      this.takeOff();
      this.speedUp();
      return;
    }
    if (this.state !== 'floating') return;
    if (this.currentSection === target) {
      this.pendingNav = null;
      this.enterPortal();
      this.speedUp();
      return;
    }
    this.flyToSection(target);
    this.speedUp();
  }

  /** Pontinhos de progresso: pula direto para um passo do texto. */
  goToBeat(next: number): void {
    if (this.state !== 'world' || this.busy || !this.world) return;
    if (next < 0 || next >= this.world.beats || next === this.beat) return;
    this.goBeat(next);
  }

  /** Muda de passo: dispara os efeitos de texto, move a câmera e leva o astronauta junto. */
  private goBeat(next: number): void {
    const { world, astronaut } = this;
    if (!world || !astronaut) return;

    if (this.focusOn) this.endFocus();
    const pose = this.adapt(world.pose(next));
    const travel = pose.astro.distanceTo(this.home);
    this.beat = next;
    this.lockUntil = performance.now() + 1100; // evita pular passos com a inércia do scroll

    world.show(next);
    this.cb.onBeatChange(next);

    if (this.fire) this.fire.active = travel > 6; // jato só quando ele realmente viaja
    this.beatTl?.kill();
    this.beatTl = gsap
      .timeline({
        onComplete: () => {
          if (this.fire) this.fire.active = false;
        },
      })
      .to(this.camGoal.pos, { x: pose.cam.x, y: pose.cam.y, z: pose.cam.z, duration: 1.6, ease: 'power2.inOut' }, 0)
      .to(this.camGoal.target, { x: pose.target.x, y: pose.target.y, z: pose.target.z, duration: 1.6, ease: 'power2.inOut' }, 0)
      .to(this.home, { x: pose.astro.x, y: pose.astro.y, z: pose.astro.z, duration: 1.6, ease: 'power2.inOut' }, 0)
      .to(astronaut.rotation, { y: pose.facing, duration: 1.0, ease: 'power2.inOut' }, 0.1);
  }

  private removeBlackHole(): void {
    if (!this.blackHole) return;
    this.scene.remove(this.blackHole);
    this.blackHole.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    this.blackHole = null;
  }
}
