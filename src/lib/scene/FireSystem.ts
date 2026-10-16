import * as THREE from 'three';

/**
 * Partículas do jetpack presas ao astronauta (acompanham a rotação dele, inclusive
 * quando ele vira para voltar à nave).
 *
 * O astronauta tem scale=10, então o grupo recebe a escala inversa: assim as posições,
 * velocidades e o tamanho abaixo continuam em unidades de MUNDO.
 */
/** Y de "estacionamento": partícula fora de jogo (jato desligado). */
const PARKED_Y = -9999;

export class FireSystem {
  readonly object = new THREE.Group();
  /** true = jato emitindo (astronauta em movimento). false = para de emitir e o fogo apaga suave. */
  active = false;
  /** 0..1 — suaviza opacidade e luz ao ligar/desligar */
  private glow = 0;

  private readonly count = 420;
  private readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly light = new THREE.PointLight(0xff8a3d, 0, 35);
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;

  constructor(private readonly target: THREE.Object3D) {
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.maxLife = new Float32Array(this.count);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 2.8,
        color: new THREE.Color(1, 0.45, 0.1),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );

    // As partículas se movem todo frame (e ficam em y=-9999 quando inativas), então a esfera de
    // culling calculada no 1º render ficaria presa lá embaixo e o fogo nunca seria desenhado.
    this.points.frustumCulled = false;

    for (let i = 0; i < this.count; i++) this.positions[i * 3 + 1] = PARKED_Y; // começa desligado

    // O efeito precisa acompanhar o astronauta, então fica preso ao próprio boneco
    this.target.add(this.object);
    this.object.position.set(0, 0, 0);
    this.object.scale.setScalar(1 / (this.target.scale.x || 1)); // cancela o scale=10 do astronauta
    this.object.add(this.points, this.light);
  }

  private reset(i: number, randomLife: boolean): void {
    const p = this.positions;
    const v = this.velocities;

    const spreadX = (Math.random() - 0.5) * 1.8;
    const spreadY = (Math.random() - 0.5) * 1.1;

    // posições locais em relação ao astronauta, para seguir o personagem no movimento
    p[i * 3] = spreadX;
    p[i * 3 + 1] = -1.6 + spreadY;
    p[i * 3 + 2] = -7 + (Math.random() - 0.5) * 0.9;

    // dispara para trás (-Z) e cai levemente, simulando o jato do jetpack
    v[i * 3] = (Math.random() - 0.5) * 0.9;
    v[i * 3 + 1] = -(0.08 + Math.random() * 0.35);
    v[i * 3 + 2] = -(2.2 + Math.random() * 2.8);

    this.life[i] = randomLife ? Math.random() * 0.6 : 0;
    this.maxLife[i] = 0.45 + Math.random() * 0.55;
  }

  update(dt: number): void {
    const p = this.positions;
    const v = this.velocities;

    for (let i = 0; i < this.count; i++) {
      // fora de jogo: só volta quando o jato ligar (escalonado, para não nascer tudo no mesmo frame)
      if (p[i * 3 + 1] === PARKED_Y) {
        if (this.active) this.reset(i, true);
        continue;
      }

      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        // fim da vida: renasce se o jato estiver ligado; senão sai de cena (apaga sem corte brusco)
        if (this.active) this.reset(i, false);
        else p[i * 3 + 1] = PARKED_Y;
        continue;
      }

      p[i * 3] += v[i * 3] * dt * 60;
      p[i * 3 + 1] += v[i * 3 + 1] * dt * 60;
      p[i * 3 + 2] += v[i * 3 + 2] * dt * 60;
    }

    this.points.geometry.attributes.position.needsUpdate = true;

    this.glow += ((this.active ? 1 : 0) - this.glow) * (1 - Math.exp(-dt * 8));

    // cor "flickering": laranja → branco quente
    const now = Date.now();
    const flicker = 0.9 + Math.sin(now * 0.04) * 0.2;
    this.points.material.color.setRGB(1.0, 0.32 + 0.55 * flicker, 0.0);
    this.points.material.opacity = 0.9 * flicker * this.glow;

    this.light.position.set(0, -2, -6);
    this.light.intensity = (3.0 + Math.sin(now * 0.06) * 1.2) * this.glow;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}