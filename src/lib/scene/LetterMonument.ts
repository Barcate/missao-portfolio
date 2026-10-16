import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';

// A fonte vem embutida no pacote do three (sem requisição de rede). Só tem ASCII: usar MAIÚSCULAS sem acento.
const font = new FontLoader().parse(fontJson as never);

interface Letter {
  mesh: THREE.Mesh;
  delay: number;
  clock: number;
  dir: 1 | -1;
  p: number; // 0 = escondida no chão · 1 = de pé
}

/** Letras 3D extrudadas que brotam do chão uma a uma (e afundam quando a palavra troca). */
export class LetterMonument {
  readonly group = new THREE.Group();

  private letters: Letter[] = [];
  private pending: string | null = null;
  private readonly material = new THREE.MeshStandardMaterial({
    color: 0xffb27a,
    emissive: 0xff5a1f,
    emissiveIntensity: 0.9,
    roughness: 0.4,
    metalness: 0.2,
  });

  constructor(
    private readonly size = 16,
    private readonly depth = 6,
  ) {}

  setWord(text: string): void {
    if (!this.letters.length) {
      this.build(text);
      return;
    }
    this.pending = text;
    this.letters.forEach((l, i) => {
      l.dir = -1;
      l.clock = 0;
      l.delay = i * 0.05;
    });
  }

  private clearLetters(): void {
    this.letters.forEach((l) => {
      this.group.remove(l.mesh);
      l.mesh.geometry.dispose();
    });
    this.letters = [];
  }

  private build(text: string): void {
    this.clearLetters();
    const gap = this.size * 0.12;
    let cursor = 0;
    const made: { mesh: THREE.Mesh; width: number; x: number }[] = [];

    for (const ch of text) {
      if (ch === ' ') {
        cursor += this.size * 0.55;
        continue;
      }
      const geo = new TextGeometry(ch, {
        font,
        size: this.size,
        height: this.depth,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.5,
        bevelSize: 0.35,
        bevelSegments: 2,
      });
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      geo.translate(-bb.min.x, 0, 0);
      const width = bb.max.x - bb.min.x;
      const mesh = new THREE.Mesh(geo, this.material);
      made.push({ mesh, width, x: cursor });
      cursor += width + gap;
    }

    const total = cursor - gap;
    made.forEach((m, i) => {
      m.mesh.position.x = m.x - total / 2;
      m.mesh.position.y = -this.size * 1.3;
      m.mesh.scale.setScalar(0.001);
      this.group.add(m.mesh);
      this.letters.push({ mesh: m.mesh, delay: i * 0.08, clock: 0, dir: 1, p: 0 });
    });
  }

  update(dt: number): void {
    let allDown = true;
    for (const l of this.letters) {
      l.clock += dt;
      if (l.clock >= l.delay) l.p = THREE.MathUtils.clamp(l.p + (l.dir * dt) / 0.75, 0, 1);
      const e = 1 - Math.pow(1 - l.p, 3); // ease-out
      l.mesh.position.y = -this.size * 1.3 * (1 - e);
      l.mesh.scale.setScalar(Math.max(0.001, e));
      l.mesh.rotation.z = (1 - e) * 0.4;
      if (l.p > 0) allDown = false;
    }
    if (this.pending && allDown) {
      const next = this.pending;
      this.pending = null;
      this.build(next);
    }
  }

  dispose(): void {
    this.clearLetters();
    this.material.dispose();
  }
}
