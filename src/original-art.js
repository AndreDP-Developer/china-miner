import * as THREE from "./vendor/three.module.js";

const PALETTE = [
  0x000000, 0xffffff, 0x813338, 0x75cec8, 0x8e3c97, 0x56ac4d, 0x2e2c9b,
  0xedf071, 0x8e5029, 0x553800, 0xc46c71, 0x4a4a4a, 0x7b7b7b, 0xa9ff9f,
  0x706deb, 0xb2b2b2,
];

export function spritePixels(engine, sprite) {
  const pixels = new Array(24 * 21).fill(-1);
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 24; x++) {
      const raw = engine.m[sprite.frame * 64 + y * 3 + (x >> 3)];
      const v = sprite.multi
        ? (raw >> (6 - ((x & 7) >> 1) * 2)) & 3
        : (raw >> (7 - (x & 7))) & 1;
      if (v)
        pixels[y * 24 + x] =
          sprite.multi && v !== 2
            ? engine.m[v === 1 ? 0xd025 : 0xd026] & 15
            : sprite.color;
    }
  return pixels;
}

export function pickupPixels(engine, code) {
  const pixels = new Array(16 * 16).fill(-1);
  const first = 232 + (code - 250) * 3;
  [code, first, first + 1, first + 2].forEach((character, quadrant) => {
    const color = engine.m[0x8054 + character] & 15;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const raw = engine.m[0x800 + character * 8 + y];
        const v =
          color & 8 ? (raw >> (6 - (x >> 1) * 2)) & 3 : (raw >> (7 - x)) & 1;
        if (v)
          pixels[(y + (quadrant >> 1) * 8) * 16 + x + (quadrant & 1) * 8] =
            color & 8
              ? [0, engine.m[0xd022] & 15, engine.m[0xd023] & 15, color & 7][v]
              : color;
      }
  });
  return pixels;
}

export function originalArtMesh(pixels, width, height) {
  const bytes = new Uint8Array(width * height * 4);
  pixels.forEach((index, i) => {
    if (index < 0) return;
    const color = PALETTE[index];
    // DataTexture's first row is at the bottom; source artwork starts at the top.
    const offset =
      ((height - 1 - Math.floor(i / width)) * width + (i % width)) * 4;
    bytes.set(
      [(color >> 16) & 255, (color >> 8) & 255, color & 255, 255],
      offset,
    );
  });
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width / 8, height / 8),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.5,
      toneMapped: false,
    }),
  );
  mesh.position.set(width / 16, -height / 16, 0);
  return mesh;
}
