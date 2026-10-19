import * as THREE from 'three';
import { NOISE } from './glsl';

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * Horizonte de eventos: um túnel visto de frente. A profundidade é 1/r, então o ruído
 * "escoa" para o centro; lá no fundo brilha a cor do mundo de destino.
 * Blending normal (não aditivo): o escuro do túnel tapa as estrelas e vira um buraco de verdade.
 */
const HORIZON_FRAG = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform vec3 uColor;
uniform vec3 uInner;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);

  // borda irregular, como chama
  float edge = fbm(vec3(cos(a) * 2.5, sin(a) * 2.5, uTime * 0.6));
  float rr = r + (edge - 0.5) * 0.09;
  if (rr > 1.0) discard;

  float depth = 0.32 / max(r, 0.03);
  float speed = 0.55 + uEnergy * 1.6;
  float swirl = depth * 0.9 + uTime * 0.25;
  vec3 q = vec3(cos(a + swirl) * 1.6, sin(a + swirl) * 1.6, depth * 1.4 - uTime * speed);
  float n = fbm(q);
  float streak = fbm(vec3(cos(a * 1.0 + swirl * 2.0) * 4.0, sin(a + swirl * 2.0) * 4.0, depth * 3.0 - uTime * speed * 2.0));

  // paredes do túnel: escuras, com nuvens da cor do portal
  vec3 col = uColor * 0.06;
  col = mix(col, uColor * 0.7, smoothstep(0.35, 0.75, n));
  col = mix(col, uInner, smoothstep(0.6, 0.85, n) * 0.6);
  col += mix(uColor, vec3(1.0), 0.3) * pow(streak, 4.0) * 1.6;

  // névoa de profundidade: o fundo do túnel some na luz do mundo de destino
  float far = exp(-r * r * 9.0);
  col = mix(col, uInner * 1.2, far * 0.85);
  col += vec3(1.0) * exp(-r * r * 60.0) * (0.7 + uEnergy * 1.5);

  // lábio interno brilhante
  float lip = smoothstep(0.78, 1.0, rr);
  col += mix(uColor, vec3(1.0), 0.25) * lip * (0.8 + edge * 0.8);

  col *= 1.0 + uEnergy * 0.8;
  float alpha = smoothstep(1.0, 0.94, rr) * 0.97;
  gl_FragColor = vec4(col, alpha);
}`;

/** Anel de energia + brilho largo (bloom falso) + arcos elétricos. Quad maior que o portal, aditivo. */
const RING_FRAG = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uSpan;
uniform vec3 uColor;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * uSpan; // em unidades do raio do portal
  float r = length(p);
  float a = atan(p.y, p.x);
  vec2 dir = vec2(cos(a), sin(a));

  float wob = fbm(vec3(dir * 3.0, uTime * 0.9));
  float d = r - 1.0 - (wob - 0.5) * 0.04;
  float core = exp(-abs(d) * 70.0);
  float glow = exp(-abs(d) * 8.0) * 0.5;
  float outer = exp(-max(d, 0.0) * 2.6) * step(0.0, d) * 0.22;

  float arcN = fbm(vec3(dir * 7.0, uTime * 2.2));
  float arcs = pow(smoothstep(0.45, 0.85, arcN), 3.0) * exp(-abs(d - 0.03) * 16.0) * 2.2;

  // pulsos correndo pelo anel
  float pulse = pow(0.5 + 0.5 * sin(a * 3.0 - uTime * 4.0), 12.0) * exp(-abs(d) * 25.0);

  float e = 1.0 + uEnergy * 1.8;
  vec3 col = uColor * (glow + outer + arcs + pulse) * e + mix(uColor, vec3(1.0), 0.75) * core * e;
  col *= smoothstep(uSpan, uSpan * 0.75, r);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Partículas sugadas em espiral para dentro (posição calculada na GPU, sem custo de CPU). */
const SPARK_VERT = /* glsl */ `
attribute vec3 aSeed; // ângulo inicial, fase, velocidade
uniform float uTime;
uniform float uEnergy;
uniform float uRadius;
uniform float uSize;
varying float vAlpha;
varying float vHeat;
void main() {
  float life = fract(aSeed.y + uTime * aSeed.z * (1.0 + uEnergy * 2.5));
  float k = 1.0 - life;
  float rr = uRadius * (0.04 + 1.85 * k * k);
  float ang = aSeed.x + life * 4.0;
  vec3 pos = vec3(cos(ang) * rr, sin(ang) * rr, sin(aSeed.x * 7.0) * 2.0 * k - life * 3.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.35 + k) * (300.0 / -mv.z);
  vAlpha = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.75, life);
  vHeat = life;
}`;

const SPARK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uEnergy;
varying float vAlpha;
varying float vHeat;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  vec3 col = mix(uColor, vec3(1.0), 0.35 + vHeat * 0.5);
  gl_FragColor = vec4(col * (1.0 + uEnergy), a * a * vAlpha);
}`;

/**
 * Portal no plano XY do grupo: túnel (shader) + anel de energia + moldura mecânica
 * girando + partículas sendo sugadas.
 * `charge` (0..1) pode ser animado por fora (ex.: GSAP ao entrar); o portal da seção
 * atual também "acorda" sozinho via `update(..., focused)`.
 */
export class Portal {
  readonly group = new THREE.Group();
  /** carga externa (0..1): ao atravessar, o portal acelera e brilha */
  charge = 0;

  private focus = 0;
  /** filho do group: a escala do group é do layout (celular), a do body é da animação */
  private readonly body = new THREE.Group();
  private readonly uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uColor: { value: new THREE.Color() },
    uInner: { value: new THREE.Color() },
  };
  private readonly frameOuter: THREE.Group;
  private readonly frameInner: THREE.Group;
  private readonly beacons: THREE.MeshBasicMaterial[] = [];
  private readonly light: THREE.PointLight;

  constructor(color: number, inner: number, radius = 13, lite = false) {
    this.uniforms.uColor.value.set(color);
    this.uniforms.uInner.value.set(inner);
    const defines = { OCTAVES: lite ? 3 : 5 };

    const horizon = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 96),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        defines,
        vertexShader: QUAD_VERT,
        fragmentShader: HORIZON_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    horizon.renderOrder = 1;

    const span = 1.7;
    const ring = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * span * 2, radius * span * 2),
      new THREE.ShaderMaterial({
        uniforms: { ...this.uniforms, uSpan: { value: span } },
        defines,
        vertexShader: QUAD_VERT,
        fragmentShader: RING_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.position.z = 0.05;
    ring.renderOrder = 2;

    this.frameOuter = this.buildFrame(radius + 2.1, lite ? 18 : 28, 1.9, color, true);
    this.frameInner = this.buildFrame(radius + 0.9, lite ? 24 : 40, 0.7, color, false);
    this.frameOuter.position.z = -0.6;
    this.frameInner.position.z = -0.3;

    const count = lite ? 220 : 520;
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = Math.random() * Math.PI * 2;
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = 0.12 + Math.random() * 0.22;
    }
    const geometry = new THREE.BufferGeometry();
    // posição real vem do shader; o atributo só define a contagem e uma caixa de culling decente
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 2);
    const sparks = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: {
          ...this.uniforms,
          uRadius: { value: radius },
          uSize: { value: lite ? 1.6 : 1.3 },
        },
        vertexShader: SPARK_VERT,
        fragmentShader: SPARK_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sparks.renderOrder = 3;

    this.light = new THREE.PointLight(color, 3, 110);
    this.light.position.set(0, 0, 6);

    this.body.add(this.frameOuter, this.frameInner, horizon, ring, sparks, this.light);
    this.group.add(this.body);
  }

  /** Anel de placas metálicas; `beacons` acende uma luz em cada terceira placa. */
  private buildFrame(r: number, segments: number, depth: number, color: number, beacons: boolean): THREE.Group {
    const group = new THREE.Group();
    const arc = ((Math.PI * 2) / segments) * 0.82; // deixa uma fresta entre placas
    const plate = new THREE.BoxGeometry(2 * r * Math.sin(arc / 2), depth, depth * 0.9);
    const metal = new THREE.MeshStandardMaterial({
      color: 0x1a1f2b,
      metalness: 0.85,
      roughness: 0.35,
      emissive: color,
      emissiveIntensity: 0.08,
    });
    const plates = new THREE.InstancedMesh(plate, metal, segments);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      q.setFromAxisAngle(z, a + Math.PI / 2);
      m.compose(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0), q, s);
      plates.setMatrixAt(i, m);
    }
    group.add(plates);

    if (beacons) {
      const geo = new THREE.BoxGeometry(0.9, 0.5, 0.3);
      for (let i = 0; i < segments; i += 3) {
        const a = (i / segments) * Math.PI * 2;
        const mat = new THREE.MeshBasicMaterial({ color, fog: false, transparent: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(Math.cos(a) * r, Math.sin(a) * r, depth * 0.5);
        mesh.rotation.z = a + Math.PI / 2;
        group.add(mesh);
        this.beacons.push(mat);
      }
    }
    return group;
  }

  update(t: number, dt = 0.016, focused = false): void {
    this.focus += ((focused ? 1 : 0) - this.focus) * (1 - Math.exp(-dt * 2.5));
    const energy = Math.min(1.5, this.focus * 0.35 + this.charge);

    this.uniforms.uTime.value = t;
    this.uniforms.uEnergy.value = energy;

    const spin = 1 + energy * 4;
    this.frameOuter.rotation.z += dt * 0.12 * spin;
    this.frameInner.rotation.z -= dt * 0.25 * spin;

    this.beacons.forEach((mat, i) => {
      // sequência de "travar coordenadas": as luzes acendem em onda
      const wave = 0.5 + 0.5 * Math.sin(t * (2 + energy * 6) - i * 0.9);
      mat.opacity = 0.25 + wave * (0.6 + energy * 0.4);
    });

    this.light.intensity = 3 + energy * 9 + Math.sin(t * 3) * 0.4;
    this.body.scale.setScalar(1 + this.charge * 0.12);
  }
}
