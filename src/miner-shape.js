// Shared model measurements, in Three.js scene units before scaling.
// The pickaxe and swinging hands are cosmetic, as with most platformer hurtboxes.
export const MINER = Object.freeze({
  scale: 1.08,
  // A ladder occupies two character cells; the original climb aligns the
  // sprite origin with their left edge, so its centre is eight pixels in.
  anchorX: 8,
  feetY: 21,
  torso: { x: 0, y: 1, width: 0.87, height: 0.95 },
  head: { x: 0, y: 1.73, rx: 0.44, ry: 0.44 },
  hat: { baseY: 1.96, height: 0.46, radius: 0.77 },
});

export function minerContains(pixelX, pixelY) {
  const x = (pixelX - MINER.anchorX) / (8 * MINER.scale);
  const y = (MINER.feetY - pixelY) / (8 * MINER.scale);
  const { torso, head, hat } = MINER;
  if (
    Math.abs(x) <= torso.width / 2 - 0.02 &&
    Math.abs(y - torso.y) <= torso.height / 2 - 0.02
  )
    return true;
  if (
    (x / (head.rx - 0.025)) ** 2 + ((y - head.y) / (head.ry - 0.025)) ** 2 <=
    1
  )
    return true;
  if (
    y >= hat.baseY &&
    y <= hat.baseY + hat.height &&
    Math.abs(x) <= hat.radius * (1 - (y - hat.baseY) / hat.height) - 0.02
  )
    return true;
  // Conservative leg interiors remain inside the animated model in every stride.
  return (
    y >= 0.17 &&
    y <= 0.53 &&
    (Math.abs(x - 0.24) <= 0.1 || Math.abs(x + 0.24) <= 0.1)
  );
}

export const MINER_CONTACT_PIXELS = Object.freeze(
  Array.from({ length: 24 * 21 }, (_, i) => ({
    x: i % 24,
    y: Math.floor(i / 24),
  })).filter(({ x, y }) => minerContains(x + 0.5, y + 0.5)),
);
