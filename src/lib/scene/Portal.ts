import * as THREE from 'three';
import { dotTexture } from './textures';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x);
  float swirl = 0.5 + 0.5 * sin(a * 5.0 + r * 9.0 - uTime * 2.2);
  float rings = 0.5 + 0.5 * sin(r * 22.0 - uTime * 3.5);
  float core = pow(1.0 - clamp(r, 0.0, 1.0), 2.5);
  vec3 col = mix(uColor * 0.3, uColor, swirl * 0.65 + rings * 0.35) + vec3(core * 0.7);
  float alpha = smoothstep(1.0, 0.82, r) * (0.4 + 0.6 * core + 0.25 * swirl);
  gl_FragColor = vec4(col, alpha);
}`;

/** Anel + disco em redemoinho (shader) + faíscas orbitando. O disco fica no plano XY do grupo. */
export class Portal {
  readonly group = new THREE.Group();

  private readonly uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color() },
  };
  private readonly sparks: THREE.Points;
  private readonly halo: THREE.Mesh;

  constructor(color: number, radius = 13) {
    this.uniforms.uColor.value.set(color);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.9, 20, 120),
      new THREE.MeshBasicMaterial({ color, fog: false }),
    );

    this.halo = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 2.6, 20, 120),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );

    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(radius - 0.6, 72),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );

    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius + (Math.random() - 0.3) * 4.5;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.sin(a) * r;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.sparks = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color,
        size: 2.2,
        map: dotTexture(),
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );

    const light = new THREE.PointLight(color, 3, 90);
    light.position.set(0, 0, 4);

    this.group.add(ring, this.halo, disk, this.sparks, light);
  }

  update(t: number): void {
    this.uniforms.uTime.value = t;
    this.sparks.rotation.z = t * 0.35;
    this.halo.scale.setScalar(1 + Math.sin(t * 2) * 0.015);
  }
}
