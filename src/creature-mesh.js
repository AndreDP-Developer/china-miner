import * as THREE from "./vendor/three.module.js";

// Join the original coloured regions before rounding their outlines. This keeps
// each creature's animation and features without drawing separate pixel cubes.
export function creatureShapes(pixels, color) {
  const edges = new Map();
  const has = (x, y) =>
    x >= 0 && x < 24 && y >= 0 && y < 21 && pixels[y * 24 + x] === color;
  const add = (x, y, nx, ny, direction) => {
    const key = `${x},${y}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push({ x, y, nx, ny, direction });
  };
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 24; x++) {
      if (!has(x, y)) continue;
      if (!has(x, y - 1)) add(x, y, x + 1, y, 0);
      if (!has(x + 1, y)) add(x + 1, y, x + 1, y + 1, 1);
      if (!has(x, y + 1)) add(x + 1, y + 1, x, y + 1, 2);
      if (!has(x - 1, y)) add(x, y + 1, x, y, 3);
    }
  const path = new THREE.ShapePath();
  while (edges.size) {
    const start = edges.values().next().value[0];
    let edge = start;
    const loop = [];
    do {
      loop.push(new THREE.Vector2(edge.x / 8, -edge.y / 8));
      const key = `${edge.x},${edge.y}`,
        list = edges.get(key);
      list.splice(list.indexOf(edge), 1);
      if (!list.length) edges.delete(key);
      const next = edges.get(`${edge.nx},${edge.ny}`);
      if (edge.nx === start.x && edge.ny === start.y) break;
      // At diagonally touching corners, follow the same connected region.
      edge =
        next?.find((n) => (n.direction - edge.direction + 4) % 4 === 1) ||
        next?.[0];
    } while (edge);
    if (loop.length < 3) continue;
    // Remove the tiny staircase turns before curving the contour, so diagonal
    // outlines read as a continuous surface rather than softened square pixels.
    let simplified = true;
    while (simplified && loop.length > 4) {
      simplified = false;
      for (let i = 0; i < loop.length; i++) {
        const a = loop[(i + loop.length - 1) % loop.length],
          b = loop[i],
          c = loop[(i + 1) % loop.length];
        const length = a.distanceTo(c);
        const distance = length
          ? Math.abs((c.x - a.x) * (a.y - b.y) - (a.x - b.x) * (c.y - a.y)) /
            length
          : Infinity;
        if (distance < 0.095) {
          loop.splice(i, 1);
          simplified = true;
          break;
        }
      }
    }
    const last = loop[loop.length - 1],
      first = loop[0];
    path.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    loop.forEach((p, i) => {
      const next = loop[(i + 1) % loop.length];
      path.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
    });
    path.currentPath.closePath();
  }
  return path.toShapes();
}

export function createCreature(engine, sprite, palette) {
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
  const group = new THREE.Group();
  for (const color of new Set(pixels)) {
    if (color < 0) continue;
    const geometry = new THREE.ExtrudeGeometry(creatureShapes(pixels, color), {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.025,
      bevelSegments: 3,
      curveSegments: 5,
      steps: 1,
    });
    group.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: palette[color],
          roughness: 0.4,
          metalness: 0.12,
        }),
      ),
    );
  }
  return group;
}
