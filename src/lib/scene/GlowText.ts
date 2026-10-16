import * as THREE from 'three';
import { DISPLAY_FONT } from './textCanvas';

/** Letreiro neon: texto com brilho num plano aditivo, com fade e tremida de lâmpada. */
export class GlowText {
  readonly mesh: THREE.Mesh;

  private readonly canvas = document.createElement('canvas');
  private readonly tex: THREE.CanvasTexture;
  private readonly mat: THREE.MeshBasicMaterial;
  private level = 0;
  private goal = 0;

  constructor(
    width: number,
    private readonly color = '#00e5ff',
    aspect = 4,
  ) {
    this.canvas.width = 1024;
    this.canvas.height = Math.round(1024 / aspect);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / aspect), this.mat);
    this.mesh.rotation.y = Math.PI; // frente voltada para a câmera (que olha para +Z)
    this.mesh.visible = false;
  }

  setText(text: string): void {
    const { width: w, height: h } = this.canvas;
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    let size = h * 0.72;
    g.font = `800 ${size}px ${DISPLAY_FONT}`;
    while (g.measureText(text).width > w * 0.92 && size > 30) {
      size -= 6;
      g.font = `800 ${size}px ${DISPLAY_FONT}`;
    }

    g.shadowColor = this.color;
    g.shadowBlur = 60;
    g.fillStyle = this.color;
    g.fillText(text, w / 2, h / 2);
    g.fillText(text, w / 2, h / 2);
    g.shadowBlur = 16;
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2);
    this.tex.needsUpdate = true;
  }

  show(on: boolean): void {
    this.goal = on ? 1 : 0;
    if (on) this.mesh.visible = true;
  }

  update(t: number, dt: number): void {
    this.level += (this.goal - this.level) * (1 - Math.exp(-dt * 4));
    const flicker = 0.92 + Math.sin(t * 37) * 0.04 + (Math.sin(t * 5.3) > 0.97 ? -0.45 : 0);
    this.mat.opacity = this.level * flicker;
    if (this.goal === 0 && this.level < 0.01) this.mesh.visible = false;
  }

  dispose(): void {
    this.tex.dispose();
    this.mat.dispose();
    this.mesh.geometry.dispose();
  }
}
