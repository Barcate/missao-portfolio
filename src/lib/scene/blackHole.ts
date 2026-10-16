import * as THREE from 'three';

export function createBlackHole(posZ: number): THREE.Group {
  const group = new THREE.Group();

  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(5, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    ),
  );

  group.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(9, 2.5, 16, 100),
      new THREE.MeshBasicMaterial({
        color: 0x0033ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    ),
  );

  group.position.set(0, 14, posZ);
  group.rotation.x = Math.PI / 2.5;
  return group;
}
