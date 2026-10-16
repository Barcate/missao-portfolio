import * as THREE from 'three';
import { dotTexture } from './textures';
import { sampleText } from './textCanvas';

/**
 * Milhares de partículas que flutuam como nuvem e, quando recebem uma palavra,
 * giram em redemoinho e se reorganizam formando as letras.
 */
export class ParticleText {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

  private readonly pos: Float32Array;
  private readonly home: Float32Array; // posição "nuvem" (sem palavra)
  private readonly target: Float32Array;
  private readonly speed: Float32Array;
  private swirl = 1;

  constructor(
    private readonly count = 4200,
    private readonly width = 100,
  ) {
    this.pos = new Float32Array(count * 3);
    this.home = new Float32Array(count * 3);
    this.target = new Float32Array(count * 3);
    this.speed = new Float32Array(count);

    const colors = new Float32Array(count * 3);
    const a = new THREE.Color(0xff4da6);
    const b = new THREE.Color(0x4de1ff);
    const c = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      this.home[ix] = (Math.random() - 0.5) * 150;
      this.home[ix + 1] = (Math.random() - 0.5) * 55;
      this.home[ix + 2] = (Math.random() - 0.5) * 90;
      this.pos.set([this.home[ix], this.home[ix + 1], this.home[ix + 2]], ix);
      this.target.set([this.home[ix], this.home[ix + 1], this.home[ix + 2]], ix);
      this.speed[i] = 1.2 + Math.random() * 2.6;
      c.copy(a).lerp(b, Math.random());
      colors.set([c.r, c.g, c.b], ix);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 1.9,
        map: dotTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  /** Reorganiza as partículas para formar `text`. */
  setWord(text: string): void {
    const pts = sampleText(text, this.count, this.width);
    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      this.target[ix] = pts[i].x + (Math.random() - 0.5) * 0.6;
      this.target[ix + 1] = pts[i].y + (Math.random() - 0.5) * 0.6;
      this.target[ix + 2] = (Math.random() - 0.5) * 6; // um pouco de volume
    }
    this.swirl = 1;
  }

  /** Dispersa de volta para a nuvem. */
  clear(): void {
    this.target.set(this.home);
    this.swirl = 1;
  }

  update(t: number, dt: number): void {
    this.swirl = Math.max(0, this.swirl - dt * 0.9);
    const sw = this.swirl * 14;

    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;
      const k = 1 - Math.exp(-dt * this.speed[i]);
      const ox = Math.sin(t * 3 + i) * sw;
      const oy = Math.cos(t * 2.3 + i * 1.7) * sw;
      const oz = Math.sin(t * 2.7 + i * 0.6) * sw + Math.sin(t * 1.5 + i) * 0.15;
      this.pos[ix] += (this.target[ix] + ox - this.pos[ix]) * k;
      this.pos[ix + 1] += (this.target[ix + 1] + oy - this.pos[ix + 1]) * k;
      this.pos[ix + 2] += (this.target[ix + 2] + oz - this.pos[ix + 2]) * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
