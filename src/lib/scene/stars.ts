import * as THREE from 'three';

export function createStars(count = 8000): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = (Math.random() - 0.5) * 2000;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 0.45, color: 0xffffff, transparent: true, opacity: 0.9 }),
  );
}
