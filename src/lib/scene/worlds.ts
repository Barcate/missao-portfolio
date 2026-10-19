import * as THREE from 'three';
import type { Beat } from '../../data/portfolio';
import { GlowText } from './GlowText';
import { ProjectFrame } from './ProjectFrame';
import { LetterMonument } from './LetterMonument';
import { ParticleText } from './ParticleText';
import { dotTexture } from './textures';
import { ShootingStars, SignalBeacon, atmosphere, duskSky, motes, nebulaSky } from './atmosphere';

/** Enquadramento de um "passo" do texto: câmera, astronauta e para onde ele olha. */
export interface BeatPose {
  cam: THREE.Vector3;
  target: THREE.Vector3;
  astro: THREE.Vector3;
  facing: number; // rotação Y do astronauta
}

/** Um ambiente completo (cena própria) que aparece ao atravessar um portal. */
export interface World {
  readonly scene: THREE.Scene;
  /** quantos passos de texto o mundo tem */
  readonly beats: number;
  pose(beat: number): BeatPose;
  /** tela vertical (celular em pé): reposiciona/encolhe os elementos de texto 3D */
  setLayout(compact: boolean): void;
  /** posiciona os iframes sobre os quadros 3D (chamado a cada quadro, com a câmera já na posição final) */
  layoutEmbeds?(camera: THREE.Camera, width: number, height: number): void;
  /** câmera de frente para o quadro do passo (para "entrar no site"); null se o passo não tem site */
  framePose?(beat: number, aspect: number, fov: number): { cam: THREE.Vector3; target: THREE.Vector3 } | null;
  /** liga/desliga o clique dentro do iframe do passo atual */
  setInteractive?(on: boolean): void;
  /** o raio (clique/hover na tela) acerta o site do passo atual? */
  hitFrame?(ray: THREE.Raycaster): boolean;
  /** dispara os efeitos de texto do passo (partículas, letreiro, holograma, letras 3D) */
  show(beat: number): void;
  update(t: number, dt: number): void;
  dispose(): void;
}

export function disposeTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.LineSegments) {
      obj.geometry.dispose();
      const materials: THREE.Material[] = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => m.dispose());
    }
  });
}

// ─── helpers ────────────────────────────────────────────────────

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const vec = (t: readonly [number, number, number]) => new THREE.Vector3(t[0], t[1], t[2]);
const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length];

function baseScene(bg: number, fogColor: number, fogDensity: number): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.FogExp2(fogColor, fogDensity);
  return scene;
}

function starfield(count: number, radius: number): THREE.Points {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = radius * rand(0.6, 1);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    g,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }),
  );
}

function softPoints(positions: Float32Array, size: number, opts: THREE.PointsMaterialParameters): THREE.Points {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    g,
    new THREE.PointsMaterial({
      size,
      map: dotTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      ...opts,
    }),
  );
}

// ─── 1 · NEBULOSA (Sobre) — a palavra se forma com milhares de partículas ──────────

function createNebula(story: Beat[], lite: boolean): World {
  const scene = baseScene(0x12041f, 0x1c0734, 0.004);
  scene.add(new THREE.AmbientLight(0xb48cff, 0.9));

  const key = new THREE.DirectionalLight(0xff9ad5, 2.4);
  key.position.set(-20, 30, -30);
  const rim = new THREE.PointLight(0x4de1ff, 3, 160);
  rim.position.set(30, 16, 40);
  scene.add(key, rim, starfield(1500, 500));

  // céu de gás em volta de tudo + brilhos flutuando perto da câmera + estrelas cadentes
  const sky = nebulaSky(lite);
  const glimmer = motes({
    count: lite ? 160 : 320,
    center: [5, 20, 20],
    box: [110, 60, 110],
    wind: [0.6, 0.4, -1.2],
    color: 0xd9b8ff,
    size: 0.9,
    opacity: 0.8,
  });
  const meteors = new ShootingStars(3, 0xffc8f0);
  scene.add(sky.mesh, glimmer.points, meteors.group);

  // nuvens de gás coloridas, achatadas como um disco galáctico
  const N = lite ? 1800 : 3200;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const palette = [0xff4da6, 0x9b5cff, 0x4de1ff].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const r = rand(40, 280);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.45 + 20;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    const c = palette[Math.floor(Math.random() * 3)].clone().lerp(palette[Math.floor(Math.random() * 3)], Math.random());
    col.set([c.r, c.g, c.b], i * 3);
  }
  const cloud = softPoints(pos, 9, { vertexColors: true, opacity: 0.4 });
  cloud.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(cloud);

  // planeta com anel
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(40, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x6a2cff, emissive: 0x1a0640, roughness: 0.8 }),
  );
  planet.position.set(95, 48, 190);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(55, 82, 96),
    new THREE.MeshBasicMaterial({ color: 0xff7ad9, transparent: true, opacity: 0.45, side: THREE.DoubleSide, fog: false }),
  );
  ring.position.copy(planet.position);
  ring.rotation.x = Math.PI / 2.3;
  ring.rotation.y = 0.3;
  const planetGlow = atmosphere(46, 0xb06bff);
  planetGlow.position.copy(planet.position);
  scene.add(planet, ring, planetGlow);

  // cristais flutuando em volta
  const crystals: { mesh: THREE.Mesh; base: number; speed: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(rand(1.5, 3.5)),
      new THREE.MeshStandardMaterial({
        color: 0xff9ad5,
        emissive: i % 2 ? 0x7a1f5a : 0x1f5a7a,
        roughness: 0.25,
        metalness: 0.3,
      }),
    );
    mesh.position.set(rand(-45, 35), rand(2, 40), rand(20, 70)); // longe da câmera, para não tapar a palavra
    scene.add(mesh);
    crystals.push({ mesh, base: mesh.position.y, speed: rand(0.4, 1.2) });
  }

  // palavra gigante feita de partículas, ao fundo
  const word = new ParticleText(lite ? 2800 : 5200, 135);
  word.points.position.set(16, 30, 85);
  scene.add(word.points);

  const CAM = [[0, 19, -27], [-12, 22, -25], [11, 15, -26], [-4, 24, -30]] as const;
  const TGT = [[0, 16, 0], [3, 17, 2], [-2, 17, 0], [0, 18, 3]] as const;
  const AST = [[12, 16, 0], [14, 18, 5], [9, 15, -2], [13, 17, 3]] as const;
  const FACE = [Math.PI + 0.5, Math.PI + 0.2, Math.PI + 0.7, Math.PI + 0.4] as const;

  return {
    scene,
    beats: story.length,
    pose: (b) => ({
      cam: vec(pick(CAM, b)),
      target: vec(pick(TGT, b)),
      astro: vec(pick(AST, b)),
      facing: pick(FACE, b),
    }),
    setLayout(c) {
      word.points.scale.setScalar(c ? 0.55 : 1);
      word.points.position.x = c ? 0 : 16;
    },
    show: (b) => word.setWord(story[b].keyword),
    update(t, dt) {
      sky.uniforms.uTime.value = t;
      glimmer.update(t);
      meteors.update(dt);
      cloud.rotation.y = t * 0.02;
      planet.rotation.y = t * 0.05;
      crystals.forEach((c, i) => {
        c.mesh.position.y = c.base + Math.sin(t * c.speed + i) * 2;
        c.mesh.rotation.x = t * 0.4 * c.speed;
        c.mesh.rotation.y = t * 0.6 * c.speed;
      });
      word.update(t, dt);
    },
    dispose() {
      word.dispose();
      disposeTree(scene);
    },
  };
}

// ─── 2 · DISTRITO NEON (Projetos) — letreiro neon + hologramas nos monólitos ───────

function createNeon(story: Beat[], lite: boolean): World {
  const scene = baseScene(0x03060f, 0x03101f, 0.007);
  scene.add(new THREE.AmbientLight(0x3399aa, 0.8));

  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(10, 30, -40);
  const glow = new THREE.PointLight(0x00e5ff, 4, 120);
  glow.position.set(-10, 12, 20);
  scene.add(key, glow, starfield(800, 500));

  scene.add(new THREE.GridHelper(800, 80, 0x00e5ff, 0x0a4a5a));

  // monólitos = um por projeto
  // um por projeto, em zigue-zague e cada vez mais fundo: a visita vira um passeio
  const count = Math.max(1, story.length - 1);
  const spots: [number, number, number][] = Array.from({ length: count }, (_, i) => [
    (i % 2 === 0 ? -1 : 1) * (30 + (i % 3) * 6),
    20 + (i % 3) * 5,
    95 + i * 36,
  ]);
  const monoMats: THREE.MeshStandardMaterial[] = [];
  const monoliths = spots.map(([x, y, z]) => {
    const geo = new THREE.BoxGeometry(14, y * 2, 14);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x07131d,
      metalness: 0.7,
      roughness: 0.35,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.06,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x00e5ff })));
    scene.add(mesh);
    monoMats.push(mat);
    return mesh;
  });

  // quadros com o SITE REAL de cada projeto dentro (iframe): passo 1..N = projeto 1..N
  const frames = story.slice(1).map((b, i) => {
    const [mx, , mz] = pick(spots, i);
    const frame = new ProjectFrame({ width: 26, color: '#00e5ff', url: b.embed ?? null, title: b.title });
    frame.group.position.set(mx, 24, mz - 13);
    scene.add(frame.group);
    return frame;
  });

  // letreiro neon da abertura
  const sign = new GlowText(84, '#00e5ff', 5);
  sign.mesh.position.set(30, 38, 72);
  scene.add(sign.mesh);

  // anéis de dados: no FIM da avenida (atrás do último quadro), como cenário de fundo —
  // no meio dela eles cruzavam os quadros e ficavam por cima dos sites
  const ringZ = 95 + count * 36 + 90;
  const rings = [50, 72].map((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.6, 16, 160),
      new THREE.MeshBasicMaterial({ color: i ? 0x00ffaa : 0x00e5ff, fog: false }),
    );
    ring.position.set(0, 40, ringZ);
    scene.add(ring);
    return ring;
  });

  // chuva de luz
  const N = lite ? 400 : 700;
  const rain = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    rain[i * 3] = rand(-100, 100);
    rain[i * 3 + 1] = rand(0, 120);
    rain[i * 3 + 2] = rand(-40, 130 + count * 36);
  }
  const rainPts = softPoints(rain, 3, { color: 0x66ffd9, opacity: 0.8 });
  scene.add(rainPts);

  let active = -1; // monólito em foco

  return {
    scene,
    beats: story.length,
    pose(b) {
      if (b === 0) return { cam: v(0, 19, -27), target: v(0, 16, 0), astro: v(12, 15, 0), facing: Math.PI + 0.5 };
      const [mx, , mz] = pick(spots, b - 1);
      return {
        cam: v(mx + 2, 19, mz - 49),
        target: v(mx - 10, 18, mz - 8),
        astro: v(mx + 12, 17, mz - 22),
        facing: Math.PI + 0.45,
      };
    },
    setLayout(c) {
      sign.mesh.scale.setScalar(c ? 0.55 : 1);
      sign.mesh.position.x = c ? 0 : 30;
      frames.forEach((f) => f.setCompact(c));
    },
    layoutEmbeds(camera, w, h) {
      frames.forEach((f) => f.layout(camera, w, h));
    },
    framePose(b, aspect, fov) {
      if (b < 1 || !story[b]?.embed) return null;
      const [mx, , mz] = pick(spots, b - 1);
      const t = Math.tan((fov * Math.PI) / 360);
      const fh = (16.25 + 3.6) / 2; // meia altura/largura do quadro inteiro (com moldura)
      const fw = (26 + 1.2) / 2;
      const d = Math.max(fh / 0.74 / t, fw / 0.9 / (t * aspect)); // deixa folga em cima para a barra de saída
      const cy = 24 + 1.2; // centro do quadro inteiro (a barra de janela sobe o centro)
      return { cam: v(mx, cy, mz - 13 - d), target: v(mx, cy, mz - 13) };
    },
    setInteractive(on) {
      frames[active]?.setInteractive(on);
    },
    hitFrame: (ray) => !!frames[active]?.hit(ray),
    show(b) {
      active = b - 1;
      if (b === 0) sign.setText(story[0].keyword);
      sign.show(b === 0);
      // só o quadro atual e o PRÓXIMO ficam carregados (os outros são descarregados)
      frames.forEach((f, i) => f.setMode(i === b - 1 ? 'active' : i === b ? 'preload' : 'idle'));
    },
    update(t, dt) {
      monoliths.forEach((m, i) => {
        m.position.y += Math.sin(t * 0.8 + i * 2) * 0.02;
        m.rotation.y = Math.sin(t * 0.4 + i) * 0.1; // só balança (girar faria os cantos atravessarem o holograma)
        const goal = i === active ? 0.55 : 0.06;
        monoMats[i].emissiveIntensity += (goal - monoMats[i].emissiveIntensity) * (1 - Math.exp(-dt * 3));
      });
      rings[0].rotation.z = t * 0.3;
      rings[1].rotation.z = -t * 0.2;
      rings[0].rotation.x = Math.sin(t * 0.4) * 0.4;
      sign.update(t, dt);
      frames.forEach((f) => f.update(t, dt));

      const a = rainPts.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        let y = a.getY(i) - dt * 40;
        if (y < 0) y = 120;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    },
    dispose() {
      sign.dispose();
      frames.forEach((f) => f.dispose());
      disposeTree(scene);
    },
  };
}

// ─── 3 · PLANETA VERMELHO (Contato) — letras 3D brotando do chão, sol nascendo ──────

const SPAWN_X = 12;
function terrainHeight(x: number, z: number): number {
  const flat = THREE.MathUtils.smoothstep(Math.hypot(x - SPAWN_X, z), 30, 110); // plano perto do astronauta
  return (Math.sin(x * 0.018) * 9 + Math.cos(z * 0.022) * 7 + Math.sin((x + z) * 0.045) * 3.5) * flat - 2;
}

function createRedPlanet(story: Beat[], lite: boolean): World {
  const scene = baseScene(0x2b0e09, 0x4a1a0e, 0.004);
  scene.add(new THREE.AmbientLight(0xffb08a, 0.75));

  const key = new THREE.DirectionalLight(0xffd2a8, 1.9);
  key.position.set(20, 40, -40);
  const back = new THREE.DirectionalLight(0xff7a3d, 2);
  back.position.set(-60, 30, 200);
  scene.add(key, back);

  // céu de entardecer (as estrelas dele somem perto do horizonte) com cordilheiras ao longe
  const sky = duskSky(0x4a1a0e, lite);
  scene.add(sky.mesh);

  const seg = lite ? 90 : 140;
  const geo = new THREE.PlaneGeometry(900, 900, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  // cor por altura: vales escuros e avermelhados, cristas claras e alaranjadas, com manchas
  const low = new THREE.Color(0x5e2112);
  const high = new THREE.Color(0xc4582c);
  const tint = new THREE.Color();
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const h = terrainHeight(p.getX(i), p.getZ(i));
    p.setY(i, h);
    tint.copy(low).lerp(high, THREE.MathUtils.smoothstep(h, -8, 12)).multiplyScalar(rand(0.82, 1.1));
    colors.set([tint.r, tint.g, tint.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })));

  // sol baixo + halo (sobe a cada passo) e duas luas
  const sun = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffc27a, fog: false }));
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(46, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  sun.position.set(-90, 38, 260);
  halo.position.copy(sun.position);
  const moonA = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 18), new THREE.MeshBasicMaterial({ color: 0xe8b8a0, fog: false }));
  moonA.position.set(70, 70, 280);
  const moonB = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 14), new THREE.MeshBasicMaterial({ color: 0xc89a88, fog: false }));
  moonB.position.set(30, 95, 300);
  scene.add(sun, halo, moonA, moonB);

  // rochas
  for (let i = 0; i < (lite ? 18 : 30); i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(55, 260);
    const x = Math.cos(a) * r + SPAWN_X;
    const z = Math.abs(Math.sin(a)) * r + 10;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(rand(3, 9)),
      new THREE.MeshStandardMaterial({ color: 0x6e2a16, flatShading: true, roughness: 1 }),
    );
    rock.position.set(x, terrainHeight(x, z) + 2, z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.add(rock);
  }

  // areia soprando com o vento (GPU) + estrelas cadentes no alto
  const dust = motes({
    count: lite ? 400 : 800,
    center: [5, 16, 40],
    box: [160, 40, 140],
    wind: [9, 0.8, 1.5],
    color: 0xffb27a,
    size: 0.8,
    opacity: 0.7,
  });
  const meteors = new ShootingStars(2, 0xffe2c8);
  scene.add(dust.points, meteors.group);

  // antena de sinal à esquerda da tela (x+), atrás do astronauta: "do outro lado do sinal"
  const beacon = new SignalBeacon(0xffa25a);
  beacon.group.position.set(58, terrainHeight(58, 62) - 0.5, 62);
  beacon.group.rotation.y = -0.5;
  scene.add(beacon.group);

  // monumento de letras 3D
  const MX = 4;
  const MZ = 100;
  const monument = new LetterMonument(18, 6);
  monument.group.position.set(MX, terrainHeight(MX, MZ) + 14, MZ); // acima das colinas da frente
  monument.group.rotation.y = Math.PI; // frente voltada para a câmera
  scene.add(monument.group);
  const fill = new THREE.PointLight(0xff8a4a, 3.5, 140);
  fill.position.set(MX, 44, MZ - 30);
  scene.add(fill);

  const CAM = [[0, 18, -27], [-8, 13, -30], [6, 9, -24]] as const;
  const TGT = [[0, 14, 0], [2, 16, 10], [6, 20, 40]] as const;
  const AST = [[16, 13, 0], [14, 12, 4], [10, 12, -2]] as const;
  const FACE = [Math.PI + 0.5, Math.PI + 0.25, Math.PI + 0.6] as const;
  const SUN_Y = [38, 56, 80] as const;
  let sunGoal: number = SUN_Y[0];

  return {
    scene,
    beats: story.length,
    pose: (b) => ({
      cam: vec(pick(CAM, b)),
      target: vec(pick(TGT, b)),
      astro: vec(pick(AST, b)),
      facing: pick(FACE, b),
    }),
    setLayout(c) {
      monument.group.scale.setScalar(c ? 0.5 : 1);
      monument.group.position.x = c ? 0 : MX;
    },
    show(b) {
      monument.setWord(story[b].keyword);
      sunGoal = pick(SUN_Y, b);
    },
    update(t, dt) {
      const k = 1 - Math.exp(-dt * 0.9);
      sun.position.y += (sunGoal - sun.position.y) * k;
      halo.position.y = sun.position.y;
      halo.scale.setScalar(1 + Math.sin(t * 0.8) * 0.03);
      monument.update(dt);

      sky.uniforms.uTime.value = t;
      (sky.uniforms.uSunDir.value as THREE.Vector3).copy(sun.position).normalize(); // o brilho do céu segue o sol
      dust.update(t);
      meteors.update(dt);
      beacon.update(t);
    },
    dispose() {
      monument.dispose();
      disposeTree(scene);
    },
  };
}

const BUILDERS = [createNebula, createNeon, createRedPlanet] as const;

export function createWorld(index: number, story: Beat[], lite = false): World {
  return BUILDERS[index](story, lite);
}
