import * as THREE from 'three';

export const DISPLAY_FONT = '"Orbitron", "Arial Black", Impact, sans-serif';

/**
 * Desenha `text` num canvas e amostra `count` pontos aleatórios sobre os pixels preenchidos.
 * Retorna posições 3D centralizadas (largura total ≈ `width` unidades), já espelhadas em X para
 * a leitura correta por uma câmera olhando para +Z.
 */
export function sampleText(text: string, count: number, width: number): THREE.Vector3[] {
  const cw = 1024;
  const ch = 256;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  let size = 200;
  g.font = `800 ${size}px ${DISPLAY_FONT}`;
  while (g.measureText(text).width > cw * 0.94 && size > 40) {
    size -= 8;
    g.font = `800 ${size}px ${DISPLAY_FONT}`;
  }
  g.fillText(text, cw / 2, ch / 2);

  const data = g.getImageData(0, 0, cw, ch).data;
  const filled: number[] = [];
  for (let y = 0; y < ch; y += 2) {
    for (let x = 0; x < cw; x += 2) {
      if (data[(y * cw + x) * 4 + 3] > 128) filled.push(x, y);
    }
  }

  const scale = width / cw;
  const n = filled.length / 2;
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const k = n ? Math.floor(Math.random() * n) * 2 : 0;
    const px = n ? filled[k] : cw / 2;
    const py = n ? filled[k + 1] : ch / 2;
    out.push(new THREE.Vector3(-(px - cw / 2) * scale, -(py - ch / 2) * scale, 0));
  }
  return out;
}
