import * as THREE from 'three';

export type SceneState = 'loading' | 'start' | 'transitioning' | 'dock' | 'floating' | 'world';

export const BG_COLOR = 0x020205;

/** Seções que o astronauta visita (posição no eixo Z). */
export const SECTIONS = [
  { id: 'sobre', zPos: 120 },
  { id: 'projetos', zPos: 260 },
  { id: 'contato', zPos: 400 },
] as const;

/** Gatilhos de scroll em pixels absolutos (wrapper = 3000px). */
export const SCROLL_GATES = {
  total: 3000,
  takeOff: 200,
  sections: [800, 1500, 2200],
  blackHole: 2700,
};

export const DOCK_POS = new THREE.Vector3(0, 10, 0);
export const ASTRONAUT_SCALE = 10;

/** Câmera follow */
export const CAM_HEIGHT = 8;
export const CAM_OFFSET_Z = -28;

/** Trechos da animação do astronauta: [frameInicial, frameFinal, fps] */
export const CLIPS = {
  idle: [0, 50, 30],
  run: [100, 177, 30],
  jump: [250, 300, 30],
} as const;

/**
 * Portais (um por seção). `offset` = posição relativa ao ponto onde o astronauta para
 * (x, y acima da altura de cruzeiro, z à frente da seção). x positivo = lado esquerdo da tela.
 * `offsetTall` = mesma coisa para tela vertical (celular em pé): o portal fica ACIMA do astronauta.
 */
export const PORTALS = [
  { color: 0xc04dff, css: '#c04dff', offset: [30, 3, 16], offsetTall: [4, 14, 40] },
  { color: 0x00e5ff, css: '#00e5ff', offset: [30, 3, 16], offsetTall: [4, 14, 40] },
  { color: 0xff7a3d, css: '#ff7a3d', offset: [30, 3, 16], offsetTall: [4, 14, 40] },
] as const;
