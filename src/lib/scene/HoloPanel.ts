import * as THREE from 'three';
import { DISPLAY_FONT } from './textCanvas';

export interface HoloOptions {
  width: number;
  color: string;
  header: string;
  title: string;
  meta?: string;
}

/** Painel holográfico: moldura, linhas de varredura e texto; "abre" crescendo na vertical. */
export class HoloPanel {
  readonly mesh: THREE.Mesh;

  private readonly tex: THREE.CanvasTexture;
  private readonly mat: THREE.MeshBasicMaterial;
  private level = 0;
  private goal = 0;

  constructor(o: HoloOptions) {
    const W = 768;
    const H = 480;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d')!;

    // fundo
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(0, 38, 52, 0.82)');
    bg.addColorStop(1, 'rgba(0, 12, 22, 0.88)');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // linhas de varredura
    g.fillStyle = 'rgba(255,255,255,0.045)';
    for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);

    // moldura com cantos
    g.strokeStyle = o.color;
    g.lineWidth = 3;
    g.strokeRect(14, 14, W - 28, H - 28);
    g.lineWidth = 8;
    const L = 44;
    for (const [x, y, sx, sy] of [[14, 14, 1, 1], [W - 14, 14, -1, 1], [14, H - 14, 1, -1], [W - 14, H - 14, -1, -1]]) {
      g.beginPath();
      g.moveTo(x, y + sy * L);
      g.lineTo(x, y);
      g.lineTo(x + sx * L, y);
      g.stroke();
    }

    // textos
    g.textBaseline = 'alphabetic';
    g.fillStyle = o.color;
    g.font = `700 26px ${DISPLAY_FONT}`;
    g.fillText(o.header, 48, 78);

    let size = 78;
    g.font = `800 ${size}px ${DISPLAY_FONT}`;
    while (g.measureText(o.title).width > W - 96 && size > 28) {
      size -= 4;
      g.font = `800 ${size}px ${DISPLAY_FONT}`;
    }
    g.shadowColor = o.color;
    g.shadowBlur = 24;
    g.fillStyle = '#ffffff';
    g.fillText(o.title, 48, 230);
    g.shadowBlur = 0;

    if (o.meta) {
      g.fillStyle = o.color;
      g.font = `500 34px ${DISPLAY_FONT}`;
      g.fillText(o.meta, 48, 300);
    }

    // barrinhas decorativas
    g.fillStyle = o.color;
    for (let i = 0; i < 12; i++) g.fillRect(48 + i * 24, H - 78, 14, 6 + ((i * 7) % 5) * 6);

    this.tex = new THREE.CanvasTexture(canvas);
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.width, (o.width * H) / W), this.mat);
    this.mesh.rotation.y = Math.PI;
    this.mesh.visible = false;
  }

  show(on: boolean): void {
    this.goal = on ? 1 : 0;
    if (on) this.mesh.visible = true;
  }

  update(t: number, dt: number): void {
    this.level += (this.goal - this.level) * (1 - Math.exp(-dt * 5));
    this.mesh.scale.set(1, Math.max(0.02, this.level), 1);
    this.mat.opacity = this.level * (0.94 + Math.sin(t * 31) * 0.03);
    if (this.goal === 0 && this.level < 0.01) this.mesh.visible = false;
  }

  dispose(): void {
    this.tex.dispose();
    this.mat.dispose();
    this.mesh.geometry.dispose();
  }
}
