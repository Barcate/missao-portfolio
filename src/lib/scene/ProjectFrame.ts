import * as THREE from 'three';

export interface FrameOptions {
  /** largura do quadro em unidades de mundo */
  width: number;
  color: string;
  url: string;
  title: string;
}

export type FrameMode = 'active' | 'preload' | 'idle';

/** "viewport" do site dentro do quadro (em px CSS): o site renderiza como num desktop e é reduzido. */
const PX_W = 1280;
const PX_H = 800;

let layer: HTMLDivElement | null = null;

/** Camada fixa ATRÁS do canvas onde ficam os iframes. */
export function getEmbedLayer(): HTMLDivElement {
  if (layer?.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'embed-layer';
  document.body.appendChild(layer);
  return layer;
}

export function removeEmbedLayer(): void {
  layer?.remove();
  layer = null;
}

/**
 * Homografia (3×3, h0..h7) que leva o retângulo do site (0,0)-(PX_W,PX_H) para 4 pontos da tela
 * (u0,v0, u1,v1, u2,v2, u3,v3 = canto sup.esq, sup.dir, inf.dir, inf.esq).
 */
function solveHomography(dst: number[], pxW: number, pxH: number): number[] | null {
  const src = [[0, 0], [pxW, 0], [pxW, pxH], [0, pxH]];
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const u = dst[i * 2];
    const v = dst[i * 2 + 1];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c];
    if (Math.abs(d) < 1e-12) return null;
    for (let k = c; k <= n; k++) A[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row) => row[n]);
}

/**
 * Janela de navegador flutuante com o SITE REAL do projeto dentro (iframe).
 *
 * Como funciona: o iframe é um elemento HTML numa camada ATRÁS do canvas. A cada quadro projetamos os 4 cantos
 * do quadro 3D na tela (mesma câmera/projeção do WebGL) e aplicamos UMA matriz de perspectiva (homografia)
 * ao elemento. No canvas existe um "buraco" (plano com NoBlending e alpha 0) exatamente sobre o iframe, que deixa
 * a página aparecer — então o astronauta e os monólitos continuam passando na frente.
 * Uma única transformação por elemento (sem cadeia preserve-3d) é o que permite clicar/rolar dentro do site.
 */
export class ProjectFrame {
  readonly group = new THREE.Group();

  private readonly hole: THREE.Mesh;
  private readonly bezel: THREE.Mesh;
  private readonly bezelTex: THREE.CanvasTexture;
  private readonly root: HTMLDivElement;
  private readonly W: number;
  private readonly H: number;
  private pxW = PX_W;
  private pxH = PX_H;
  private readonly corner = new THREE.Vector3();
  private iframe: HTMLIFrameElement | null = null;
  private level = 0;
  private goal = 0;
  private mode: FrameMode = 'idle';
  private removeTimer = 0;

  constructor(private readonly o: FrameOptions) {
    const W = o.width;
    const H = (W * PX_H) / PX_W;
    this.W = W;
    this.H = H;
    const border = 0.6;
    const bar = 2.4;
    const Wf = W + border * 2;
    const Hf = H + border * 2 + bar;

    // ── buraco no canvas (o iframe aparece por trás dele) ──
    this.hole = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        opacity: 0,
        blending: THREE.NoBlending,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      }),
    );

    // ── moldura (barra de janela com 3 bolinhas, borda neon, cantos e linhas de varredura) ──
    const cw = 1024;
    const ch = Math.round((cw * Hf) / Wf);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const g = canvas.getContext('2d')!;
    const px = cw / Wf; // pixels por unidade de mundo
    const top = (bar + border) * px; // topo da área do site
    const x0 = border * px;
    const cwid = W * px;
    const chei = H * px;

    g.fillStyle = 'rgba(0, 24, 34, 0.94)';
    g.fillRect(0, 0, cw, top);
    g.fillRect(0, top, x0, chei);
    g.fillRect(x0 + cwid, top, x0, chei);
    g.fillRect(0, top + chei, cw, ch - top - chei);

    g.fillStyle = 'rgba(255,255,255,0.045)';
    for (let y = 0; y < ch; y += 6) g.fillRect(0, y, cw, 2);

    const r = bar * px * 0.17;
    ['#ff5f56', '#ffbd2e', '#27c93f'].forEach((c, i) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x0 + r * 1.8 + i * r * 3, (bar * px) / 2 + border * px * 0.4, r, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = 'rgba(255,255,255,0.09)'; // "barra de endereço" (só a forma, sem texto)
    const pillX = x0 + r * 11;
    const pillH = bar * px * 0.5;
    g.beginPath();
    g.roundRect(pillX, (bar * px - pillH) / 2 + border * px * 0.4, cw - pillX - x0 - r * 2, pillH, pillH / 2);
    g.fill();

    g.shadowColor = o.color;
    g.shadowBlur = 18;
    g.strokeStyle = o.color;
    g.lineWidth = 5;
    g.strokeRect(3, 3, cw - 6, ch - 6);
    g.lineWidth = 3;
    g.strokeRect(x0, top, cwid, chei);
    g.lineWidth = 9;
    const L = 46;
    for (const [x, y, sx, sy] of [
      [x0, top, 1, 1],
      [x0 + cwid, top, -1, 1],
      [x0, top + chei, 1, -1],
      [x0 + cwid, top + chei, -1, -1],
    ]) {
      g.beginPath();
      g.moveTo(x, y + sy * L);
      g.lineTo(x, y);
      g.lineTo(x + sx * L, y);
      g.stroke();
    }

    this.bezelTex = new THREE.CanvasTexture(canvas);
    this.bezel = new THREE.Mesh(
      new THREE.PlaneGeometry(Wf, Hf),
      new THREE.MeshBasicMaterial({
        map: this.bezelTex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      }),
    );
    this.bezel.position.set(0, (bar + border * 0) / 2, 0.05); // área do site fica centrada na origem
    this.hole.position.z = 0;

    // ── elemento HTML (carregando…) que recebe o iframe ──
    this.root = document.createElement('div');
    this.root.className = 'embed-frame';
    this.root.style.width = `${PX_W}px`;
    this.root.style.height = `${PX_H}px`;
    this.root.style.pointerEvents = 'none'; // pré-visualização: rolar/deslizar navega pelos passos
    this.root.style.visibility = 'hidden';
    getEmbedLayer().appendChild(this.root);

    this.group.add(this.hole, this.bezel);
    this.group.rotation.y = Math.PI; // frente voltada para a câmera (que olha para +Z)
    this.hole.visible = false;
    this.bezel.visible = false;
  }

  /** active = visível · preload = carrega escondido (para já estar pronto no próximo passo) · idle = descarrega */
  setMode(mode: FrameMode): void {
    this.mode = mode;
    window.clearTimeout(this.removeTimer);
    if (mode === 'idle') {
      this.goal = 0;
      this.removeTimer = window.setTimeout(() => this.destroyIframe(), 1800);
      return;
    }
    this.ensureIframe();
    this.goal = mode === 'active' ? 1 : 0;
  }

  /** Tela vertical: viewport virtual menor (640×400) → o site usa o layout de celular e fica legível. */
  setCompact(on: boolean): void {
    this.pxW = on ? 640 : PX_W;
    this.pxH = on ? 400 : PX_H;
    this.root.style.width = `${this.pxW}px`;
    this.root.style.height = `${this.pxH}px`;
  }

  /** Foco no site: libera clique/rolagem dentro do iframe (o canvas é que deixa de capturar o ponteiro). */
  setInteractive(on: boolean): void {
    this.root.style.pointerEvents = on && this.mode === 'active' ? 'auto' : 'none';
    if (this.iframe) this.iframe.tabIndex = on ? 0 : -1;
  }

  update(t: number, dt: number): void {
    this.level += (this.goal - this.level) * (1 - Math.exp(-dt * 5));
    const shown = this.level > 0.01;
    this.group.scale.set(1, Math.max(0.02, this.level), 1); // "abre" crescendo na vertical
    this.hole.visible = shown;
    this.bezel.visible = shown;
    (this.bezel.material as THREE.MeshBasicMaterial).opacity = this.level * (0.95 + Math.sin(t * 29) * 0.03);
  }

  /** Posiciona o iframe sobre o quadro 3D (chamar depois de a câmera estar na posição final do quadro). */
  layout(camera: THREE.Camera, w: number, h: number): void {
    if (this.level < 0.05) {
      this.root.style.visibility = 'hidden';
      return;
    }
    this.group.updateWorldMatrix(true, false);
    const hw = this.W / 2;
    const hh = this.H / 2;
    const pts: number[] = [];
    for (const [x, y] of [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]]) {
      this.corner.set(x, y, 0);
      this.group.localToWorld(this.corner);
      if (this.corner.clone().applyMatrix4(camera.matrixWorldInverse).z > -0.1) {
        this.root.style.visibility = 'hidden'; // canto atrás da câmera
        return;
      }
      this.corner.project(camera);
      pts.push(((this.corner.x + 1) / 2) * w, ((1 - this.corner.y) / 2) * h);
    }
    const m = solveHomography(pts, this.pxW, this.pxH);
    if (!m) {
      this.root.style.visibility = 'hidden';
      return;
    }
    this.root.style.transform = `matrix3d(${m[0]},${m[3]},0,${m[6]},${m[1]},${m[4]},0,${m[7]},0,0,1,0,${m[2]},${m[5]},0,1)`;
    this.root.style.opacity = String(Math.min(1, this.level * 1.2));
    this.root.style.visibility = 'visible';
  }

  private ensureIframe(): void {
    if (this.iframe) return;
    const f = document.createElement('iframe');
    f.src = this.o.url;
    f.title = this.o.title;
    f.loading = 'eager';
    f.tabIndex = -1;
    // sem allow-top-navigation: o site embutido não consegue redirecionar o portfólio
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    f.style.cssText = 'width:100%;height:100%;border:0;background:#fff;opacity:0;transition:opacity .6s ease;';
    f.addEventListener('load', () => {
      f.style.opacity = '1';
      this.root.classList.add('is-loaded');
    });
    this.root.appendChild(f);
    this.iframe = f;
  }

  private destroyIframe(): void {
    if (!this.iframe) return;
    this.iframe.src = 'about:blank';
    this.iframe.remove();
    this.iframe = null;
    this.root.classList.remove('is-loaded');
  }

  dispose(): void {
    window.clearTimeout(this.removeTimer);
    this.destroyIframe();
    this.root.remove();
    this.hole.geometry.dispose();
    (this.hole.material as THREE.Material).dispose();
    this.bezel.geometry.dispose();
    (this.bezel.material as THREE.Material).dispose();
    this.bezelTex.dispose();
  }
}
