import { CPU } from "./cpu.js";

export const PAL_HZ = 985248;
export class MinerEngine {
  constructor(data, levels) {
    this.original = new Uint8Array(65536);
    for (const s of data.segments) {
      const raw = atob(s.bytes);
      for (let i = 0; i < raw.length; i++)
        this.original[s.address + i] = raw.charCodeAt(i);
    }
    this.levels = levels;
    this.god = false;
    this.input = 0;
    this.status = "ready";
    this.ticks = 0;
    this.reset();
  }
  reset(level = 0) {
    this.cpu = new CPU(this.original.slice());
    this.m = this.cpu.m;
    this.cpu.readHook = (a) =>
      a === 0xdc00
        ? 255 ^ this.input
        : a === 0xd01e
          ? this.spriteCollision()
          : undefined;
    this.m[0xc5] = 64;
    this.m[0xd018] = 0x12;
    this.m[0xd016] = 0xd8;
    this.m[0xd022] = 1;
    this.m[0xd023] = 8;
    this.m[0x3df] = 5;
    this.m[0x3e1] = level;
    this.cpu.pc = 0x8248;
    this.status = "playing";
    this.ticks = 0;
    this.elapsed = 0;
    this.runToBoundary(true);
  }
  get level() {
    return this.m[0x3e1];
  }
  get lives() {
    return this.m[0x3df];
  }
  get score() {
    return this.m[0x3e5] | (this.m[0x3e6] << 8);
  }
  get collected() {
    return this.m[0x3e2];
  }
  get dying() {
    return this.cpu.pc >= 0x8742 && this.cpu.pc < 0x876e;
  }
  select(level) {
    this.reset(Math.max(0, Math.min(29, level)));
  }
  sprite(index) {
    return {
      x:
        this.m[0xd000 + index * 2] + ((this.m[0xd010] >> index) & 1) * 256 - 24,
      y: this.m[0xd001 + index * 2] - 82,
      frame: this.m[0x7f8 + index],
      enabled: !!(this.m[0xd015] & (1 << index)),
      multi: !!(this.m[0xd01c] & (1 << index)),
      color: this.m[0xd027 + index] & 15,
    };
  }
  opaque(s, x, y) {
    if (x < 0 || x >= 24 || y < 0 || y >= 21) return false;
    const b = this.m[s.frame * 64 + y * 3 + (x >> 3)];
    return s.multi
      ? !!((b >> (6 - ((x & 7) >> 1) * 2)) & 3)
      : !!((b >> (7 - (x & 7))) & 1);
  }
  spriteCollision() {
    if (this.god) return 0;
    const p = this.sprite(0);
    if (!p.enabled) return 0;
    for (let i = 1; i < 8; i++) {
      const e = this.sprite(i);
      if (!e.enabled) continue;
      const x0 = Math.max(p.x, e.x),
        y0 = Math.max(p.y, e.y),
        x1 = Math.min(p.x + 24, e.x + 24),
        y1 = Math.min(p.y + 21, e.y + 21);
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++)
          if (
            this.opaque(p, x - p.x, y - p.y) &&
            this.opaque(e, x - e.x, y - e.y)
          )
            return 1 | (1 << i);
    }
    return 0;
  }
  runToBoundary(initial = false, yieldAnimation = false) {
    const c = this.cpu,
      start = c.cycles;
    for (let instructions = 0; instructions < 200000; instructions++) {
      if (c.pc === 0x82c0 && (initial || instructions > 0))
        return c.cycles - start;
      if (yieldAnimation && instructions > 0 && c.pc === 0x8757)
        return c.cycles - start;
      if (c.pc === 0x8bb5 || c.pc === 0x8197) {
        this.status = "gameover";
        return c.cycles - start;
      }
      if (c.pc === 0x876e) {
        this.status = "complete";
        return c.cycles - start;
      }
      if (c.pc === 0x8742 && this.god) {
        // Test aid: ignore deaths, but recover out-of-bounds falls by reloading the room.
        if (this.m[0x35c] > 238 || this.m[0x35c] < 50) {
          c.pc = 0x8248;
          continue;
        }
        this.m[0x3d6] = 0;
        c.pc = 0x8730;
      }
      if (c.pc === 0xffd2) {
        if (c.a === 0x93) this.m.fill(32, 0x400, 0x7e8);
        c.rts();
        continue;
      }
      if (c.pc === 0x8abb) {
        // Collapse the original busy wait, retaining its exact instruction-cycle cost.
        c.cycles += 3325 * (c.a || 256) + 17;
        this.m[0x340] = 0;
        this.m[0x345] = c.x;
        c.nz(c.x);
        c.rts();
        continue;
      }
      c.step();
    }
    throw new Error(`Game routine did not yield: $${c.pc.toString(16)}`);
  }
  tick(input = this.input) {
    if (this.status !== "playing") return 0;
    this.input = input;
    const cycles = this.runToBoundary(false, true);
    this.ticks++;
    const dt = cycles / PAL_HZ;
    this.elapsed += dt;
    return dt;
  }
  snapshot() {
    return {
      level: this.level + 1,
      name: this.levels[this.level].name,
      lives: this.lives,
      score: this.score,
      collected: this.collected,
      status: this.status,
      ticks: this.ticks,
      cycles: this.cpu.cycles,
      player: this.sprite(0),
      jumpPhase: this.m[0x3d4],
      fallCounter: this.m[0x3d6],
      input: this.input,
    };
  }
}
