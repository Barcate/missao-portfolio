import * as THREE from 'three';
import { NOISE } from './glsl';

/**
 * Peças de ambientação dos mundos: céu procedural, partículas perto da câmera,
 * estrelas cadentes, brilho de atmosfera e a antena de sinal do Planeta Vermelho.
 */

// ─── céu ────────────────────────────────────────────────────────────────

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** estrelas em células 3D da direção (piscando) — usado pelos dois céus */
const STARS = /* glsl */ `
float stars(vec3 d, float t) {
  vec3 sp = d * 380.0;
  float h = hash3(floor(sp));
  float s = pow(max(0.0, 1.0 - length(fract(sp) - 0.5) * 2.4), 6.0);
  return s * step(0.972, h) * (0.55 + 0.45 * sin(t * 1.7 + h * 90.0));
}`;

/** Nebulosa: gás em camadas (violeta / rosa / ciano), faixa galáctica e faixas escuras de poeira. */
const NEBULA_SKY = /* glsl */ `
uniform float uTime;
varying vec3 vDir;
${NOISE}
${STARS}
void main() {
  vec3 d = normalize(vDir);
  float n1 = fbm(d * 2.2 + vec3(0.0, uTime * 0.01, 0.0));
  float n2 = fbm(d * 5.0 + vec3(7.3, 1.1, uTime * 0.015));
  float dust = fbm(d * 3.5 + 19.0);
  float band = exp(-pow(d.y * 2.2 - 0.3 + (n1 - 0.5) * 1.2, 2.0));

  vec3 col = vec3(0.07, 0.016, 0.12);
  col += vec3(0.6, 0.36, 1.0) * smoothstep(0.35, 0.8, n1) * 0.55 * (0.4 + band);
  col += vec3(1.0, 0.3, 0.65) * pow(smoothstep(0.45, 0.9, n2), 2.0) * 0.75 * band;
  col += vec3(0.3, 0.88, 1.0) * pow(smoothstep(0.5, 0.95, n1 * n2 * 1.8), 3.0) * 0.6;
  col *= mix(1.0, 0.25, smoothstep(0.5, 0.75, dust) * band);
  col += vec3(1.0, 0.92, 1.0) * stars(d, uTime) * (1.0 - band * 0.5);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Entardecer marciano: gradiente, dispersão em volta do sol, nuvens finas, estrelas no alto e cordilheiras. */
const DUSK_SKY = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uFog;
varying vec3 vDir;
${NOISE}
${STARS}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 horizon = vec3(1.0, 0.55, 0.32);
  vec3 col = mix(horizon, vec3(0.55, 0.17, 0.12), smoothstep(0.0, 0.18, h));
  col = mix(col, vec3(0.07, 0.03, 0.1), smoothstep(0.15, 0.65, h));

  float s = max(dot(d, uSunDir), 0.0);
  col += vec3(1.0, 0.6, 0.3) * pow(s, 6.0) * 0.5 + vec3(1.0, 0.8, 0.55) * pow(s, 60.0) * 0.8;

  float cl = fbm(vec3(d.xz / (h + 0.15) * 1.5, uTime * 0.02));
  float clMask = smoothstep(0.55, 0.8, cl) * smoothstep(0.02, 0.12, h) * smoothstep(0.5, 0.2, h);
  col = mix(col, col * 1.25 + vec3(0.12, 0.04, 0.02) + vec3(1.0, 0.5, 0.2) * pow(s, 4.0) * 0.4, clMask * 0.6);

  col += vec3(1.0, 0.9, 0.85) * stars(d, uTime) * smoothstep(0.25, 0.6, h);

  // duas camadas de montanhas: a de trás clara de névoa, a da frente quase da cor da neblina
  float a = atan(d.z, d.x);
  vec2 ring = vec2(cos(a), sin(a));
  float m1 = 0.025 + 0.07 * fbm(vec3(ring * 3.0, 1.0));
  float m2 = 0.01 + 0.045 * fbm(vec3(ring * 6.0, 5.0));
  col = mix(col, mix(horizon * 0.55, uFog, 0.4), smoothstep(m1 + 0.003, m1, h));
  col = mix(col, uFog * 1.1, smoothstep(m2 + 0.003, m2, h));
  col = mix(col, uFog, smoothstep(0.0, -0.02, h));
  gl_FragColor = vec4(col, 1.0);
}`;

export interface Sky {
  mesh: THREE.Mesh;
  uniforms: { uTime: THREE.IUniform<number>; [k: string]: THREE.IUniform };
}

function sky(frag: string, extra: Record<string, THREE.IUniform>, lite: boolean): Sky {
  const uniforms = { uTime: { value: 0 }, ...extra };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 32),
    new THREE.ShaderMaterial({
      uniforms,
      defines: { OCTAVES: lite ? 3 : 5 },
      vertexShader: SKY_VERT,
      fragmentShader: frag,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = -1; // sempre atrás de tudo
  return { mesh, uniforms };
}

export const nebulaSky = (lite: boolean) => sky(NEBULA_SKY, {}, lite);

export const duskSky = (fog: number, lite: boolean) =>
  sky(DUSK_SKY, { uSunDir: { value: new THREE.Vector3(0, 0.1, 1).normalize() }, uFog: { value: new THREE.Color(fog) } }, lite);

// ─── partículas perto da câmera (paralaxe) ───────────────────────────────

const MOTE_VERT = /* glsl */ `
uniform float uTime;
uniform vec3 uBox;
uniform vec3 uCenter;
uniform vec3 uWind;
uniform float uSize;
varying float vA;
void main() {
  vec3 p = position + uWind * uTime + vec3(sin(uTime * 0.3 + position.y) * 2.0, cos(uTime * 0.25 + position.x) * 1.5, 0.0);
  p = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5 + uCenter; // dá a volta na caixa: fluxo infinito
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (300.0 / -mv.z);
  vA = smoothstep(2.0, 10.0, -mv.z) * (1.0 - smoothstep(uBox.z * 0.5, uBox.z, -mv.z));
}`;

const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor, a * a * vA * uOpacity);
}`;

export interface MoteOptions {
  count: number;
  center: [number, number, number];
  box: [number, number, number];
  wind: [number, number, number];
  color: number;
  size: number;
  opacity: number;
}

/** Poeira/brilhos flutuando em volta da câmera, movidos na GPU (sem custo de CPU por partícula). */
export function motes(o: MoteOptions): { points: THREE.Points; update(t: number): void } {
  const pos = new Float32Array(o.count * 3);
  for (let i = 0; i < o.count; i++) {
    pos[i * 3] = o.center[0] + (Math.random() - 0.5) * o.box[0];
    pos[i * 3 + 1] = o.center[1] + (Math.random() - 0.5) * o.box[1];
    pos[i * 3 + 2] = o.center[2] + (Math.random() - 0.5) * o.box[2];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...o.center), Math.hypot(...o.box));
  const uniforms = {
    uTime: { value: 0 },
    uBox: { value: new THREE.Vector3(...o.box) },
    uCenter: { value: new THREE.Vector3(...o.center) },
    uWind: { value: new THREE.Vector3(...o.wind) },
    uSize: { value: o.size },
    uColor: { value: new THREE.Color(o.color) },
    uOpacity: { value: o.opacity },
  };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  return { points, update: (t) => (uniforms.uTime.value = t) };
}

// ─── estrelas cadentes ─────────────────────────────────────────────────

const STREAK_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const STREAK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
varying vec2 vUv;
void main() {
  float a = pow(vUv.x, 3.0) * (1.0 - abs(vUv.y - 0.5) * 2.0) * uFade; // cabeça brilhante em x = 1
  gl_FragColor = vec4(mix(uColor, vec3(1.0), vUv.x * 0.6), a);
}`;

interface Streak {
  mesh: THREE.Mesh;
  fade: THREE.IUniform<number>;
  wait: number;
  life: number;
  speed: number;
}

/** Riscos de luz cruzando o céu de vez em quando, à frente da câmera (que olha para +Z). */
export class ShootingStars {
  readonly group = new THREE.Group();
  private readonly streaks: Streak[] = [];
  private static readonly DURATION = 0.9;

  constructor(count: number, color: number) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < count; i++) {
      const fade = { value: 0 };
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(color) }, uFade: fade },
          vertexShader: STREAK_VERT,
          fragmentShader: STREAK_FRAG,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.visible = false;
      this.group.add(mesh);
      this.streaks.push({ mesh, fade, wait: 1 + Math.random() * 6, life: -1, speed: 0 });
    }
  }

  private launch(s: Streak): void {
    const side = Math.random() < 0.5 ? -1 : 1;
    s.mesh.position.set((Math.random() - 0.5) * 520, 110 + Math.random() * 150, 320 + Math.random() * 220);
    s.mesh.lookAt(0, 20, -30); // de frente para a câmera dos mundos
    s.mesh.rotateZ(Math.PI + side * (0.35 + Math.random() * 0.6)); // cai em diagonal, para um lado ou outro
    s.mesh.scale.set(50 + Math.random() * 40, 0.7, 1);
    s.speed = 260 + Math.random() * 160;
    s.life = 0;
    s.mesh.visible = true;
  }

  update(dt: number): void {
    for (const s of this.streaks) {
      if (s.life < 0) {
        s.wait -= dt;
        if (s.wait <= 0) this.launch(s);
        continue;
      }
      s.life += dt;
      const p = s.life / ShootingStars.DURATION;
      s.mesh.translateX(s.speed * dt);
      s.fade.value = Math.sin(Math.min(p, 1) * Math.PI);
      if (p >= 1) {
        s.life = -1;
        s.wait = 2.5 + Math.random() * 6;
        s.mesh.visible = false;
      }
    }
  }
}

// ─── brilho de atmosfera (borda de planeta) ──────────────────────────────

/** Casca levemente maior que o planeta que brilha só na borda (fresnel). */
export function atmosphere(radius: number, color: number, intensity = 1.4): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float f = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
          gl_FragColor = vec4(uColor * f * uIntensity, f);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

// ─── antena de sinal (Planeta Vermelho / Contato) ────────────────────────

/** Antena parabólica num tripé, varrendo o céu devagar e emitindo ondas de sinal. */
export class SignalBeacon {
  readonly group = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly waves: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; offset: number }[] = [];
  private readonly lamp: THREE.MeshBasicMaterial;
  private readonly lampLight: THREE.PointLight;

  constructor(color: number) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a7a70, metalness: 0.7, roughness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a2a24, metalness: 0.5, roughness: 0.7 });

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 14, 10), metal);
    mast.position.y = 7;
    this.group.add(mast);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 9, 6), dark);
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 2.4, 3.6, Math.sin(a) * 2.4);
      leg.lookAt(0, 9, 0);
      leg.rotateX(Math.PI / 2);
      this.group.add(leg);
    }

    // prato: calota de esfera virada para cima, inclinada para o céu (para longe da câmera)
    const R = 5;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 12, 0, Math.PI * 2, 0, 1.0), metal.clone());
    (dish.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    dish.rotation.x = Math.PI;
    dish.position.y = R;
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), dark);
    feed.position.y = 2;
    this.pivot.add(dish, feed);
    this.pivot.position.y = 14;
    this.pivot.rotation.order = 'YXZ';
    this.pivot.rotation.x = 0.6;
    this.group.add(this.pivot);

    // ondas saindo do foco do prato, ao longo do eixo
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), mat);
      mesh.rotation.x = -Math.PI / 2;
      this.pivot.add(mesh);
      this.waves.push({ mesh, mat, offset: i / 4 });
    }

    // luz de topo piscando
    this.lamp = new THREE.MeshBasicMaterial({ color: 0xff3b2f, fog: false, transparent: true });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), this.lamp);
    lamp.position.set(0, 4.3, 0);
    this.pivot.add(lamp);
    this.lampLight = new THREE.PointLight(0xff3b2f, 0, 30);
    this.lampLight.position.copy(lamp.position);
    this.pivot.add(this.lampLight);
  }

  update(t: number): void {
    this.pivot.rotation.y = Math.sin(t * 0.18) * 0.6;
    for (const w of this.waves) {
      const p = (t * 0.32 + w.offset) % 1;
      w.mesh.position.y = 3 + p * 34;
      w.mesh.scale.setScalar(1.5 + p * 11);
      w.mat.opacity = Math.sin(p * Math.PI) * 0.75;
    }
    const blink = Math.pow(Math.max(0, Math.sin(t * 2.6)), 12);
    this.lamp.opacity = 0.25 + blink * 0.75;
    this.lampLight.intensity = blink * 6;
  }
}
