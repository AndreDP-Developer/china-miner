import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { MinerEngine } from "../src/engine.js";
import { CPU } from "../src/cpu.js";
import { loadSettings, saveSettings } from "../src/settings.js";
import { createCreature, creatureShapes } from "../src/creature-mesh.js";

const data = JSON.parse(
  fs.readFileSync(new URL("../public/data/original.json", import.meta.url)),
);
const levels = JSON.parse(
  fs.readFileSync(new URL("../public/data/levels.json", import.meta.url)),
);
const fresh = () => new MinerEngine(data, levels);

test("all thirty maps are byte-identical to the extracted original, with five distinct treasures", () => {
  const e = fresh();
  assert.equal(levels.length, 30);
  for (let i = 0; i < 30; i++) {
    e.select(i);
    assert.equal(e.level, i);
    assert.equal(e.lives, 5);
    assert.deepEqual(Array.from(e.m.slice(0x4a0, 0x7c0)), levels[i].map);
    assert.equal(
      crypto
        .createHash("sha256")
        .update(Buffer.from(levels[i].map))
        .digest("hex"),
      levels[i].sha256,
    );
    for (const c of [250, 251, 252, 253, 254])
      assert.equal(
        levels[i].map.filter((v) => v === c).length,
        1,
        `${i + 1}: item ${c}`,
      );
  }
});

test("100 game ticks match independent py65 execution: registers, working memory, and cycle counts", () => {
  const e = fresh();
  e.cpu.readHook = (a) =>
    a === 0xdc00 ? 255 ^ e.input : a === 0xd01e ? 0 : undefined;
  const trace = JSON.parse(
    fs.readFileSync(new URL("./reference-trace.json", import.meta.url)),
  );
  assert.equal(trace.length, 100);
  for (const [i, t] of trace.entries()) {
    e.tick(t.input);
    for (const [key, value] of Object.entries(t.cpu))
      assert.equal(e.cpu[key], value, `tick ${i}: ${key}`);
    assert.equal(e.cpu.cycles, t.cycles, `tick ${i}: cycles`);
    assert.deepEqual(
      Buffer.from(e.m.slice(0, 2048)),
      Buffer.from(t.memory, "base64"),
      `tick ${i}: RAM`,
    );
  }
});

test("all thirty rooms survive 120 deterministic simulation ticks, including enemy and hazard updates", () => {
  const e = fresh();
  for (let room = 0; room < 30; room++) {
    e.select(room);
    for (let i = 0; i < 120 && e.status === "playing"; i++)
      e.tick([0, 4, 8, 17, 18][Math.floor(i / 12) % 5]);
    assert.ok(["playing", "gameover"].includes(e.status));
    assert.ok(e.lives >= 0 && e.lives <= 5);
  }
});

// Enter the original item-collection routine at a tile-aligned position.
function touchItem(e, code) {
  const pos = Array.from(e.m.slice(0x4a0, 0x7c0)).indexOf(code);
  assert.ok(pos >= 0);
  e.m[0x352] = 12 + (pos % 40) * 4;
  e.m[0x35c] = 77 + Math.floor(pos / 40) * 8;
  e.m[0x34e] = 0;
  e.cpu.push(0x86);
  e.cpu.push(0xce);
  e.cpu.pc = 0x8dce;
  e.runToBoundary();
}
test("key remains locked until four items, each worth 50 points; completion resets the next room", () => {
  const e = fresh();
  touchItem(e, 250);
  assert.equal(e.level, 0);
  assert.equal(e.score, 0);
  for (const [i, code] of [251, 252, 253, 254].entries()) {
    touchItem(e, code);
    assert.equal(e.collected, i + 1);
    assert.equal(e.score, (i + 1) * 50);
  }
  touchItem(e, 250);
  assert.equal(e.level, 1);
  assert.equal(e.score, 250);
  assert.equal(e.collected, 0);
  assert.deepEqual(Array.from(e.m.slice(0x4a0, 0x7c0)), levels[1].map);
});
test("fifth-room completion awards an extra life and thirtieth-room completion ends the game", () => {
  const e = fresh();
  e.select(4);
  e.m[0x3e2] = 4;
  touchItem(e, 250);
  assert.equal(e.lives, 6);
  assert.equal(e.level, 5);
  e.select(29);
  e.m[0x3e2] = 4;
  touchItem(e, 250);
  assert.equal(e.status, "complete");
  assert.equal(e.score, 50);
});
test("every room collects all treasures and transitions correctly in both modes", () => {
  for (const hardcore of [false, true])
    for (let room = 0; room < 30; room++) {
      const e = new MinerEngine(data, levels, { hardcore });
      e.select(room);
      for (const code of [251, 252, 253, 254]) touchItem(e, code);
      assert.equal(e.collected, 4);
      assert.equal(e.score, 200);
      touchItem(e, 250);
      assert.equal(e.score, 250);
      if (room === 29) assert.equal(e.status, "complete");
      else assert.equal(e.level, room + 1);
    }
});
test("smooth creature outlines preserve holes and generate valid animation geometry in every room", () => {
  const pixels = new Array(24 * 21).fill(-1);
  for (let y = 2; y < 8; y++)
    for (let x = 2; x < 8; x++) pixels[y * 24 + x] = 1;
  for (let y = 4; y < 6; y++)
    for (let x = 4; x < 6; x++) pixels[y * 24 + x] = -1;
  const shapes = creatureShapes(pixels, 1);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].holes.length, 1);
  const seen = new Set(),
    e = fresh();
  for (let room = 0; room < 30; room++) {
    e.select(room);
    e.god = true;
    for (let tick = 0; tick < 120; tick++) {
      e.tick(0);
      for (let i = 1; i < 8; i++) {
        const s = e.sprite(i);
        if (!s.enabled || !s.frame) continue;
        const key = `${s.frame}:${s.multi}:${s.color}:${e.m[0xd025]}:${e.m[0xd026]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const model = createCreature(e, s, new Array(16).fill(0xffffff));
        assert.ok(
          model.children.length > 0,
          `room ${room + 1}, frame ${s.frame}`,
        );
        for (const mesh of model.children) {
          const p = mesh.geometry.attributes.position.array;
          assert.ok(p.length > 0 && p.every(Number.isFinite));
          mesh.geometry.computeBoundingBox();
          const b = mesh.geometry.boundingBox;
          assert.ok(b.min.x >= -0.04 && b.max.x <= 3.04);
          assert.ok(b.min.y >= -2.67 && b.max.y <= 0.04);
          mesh.geometry.dispose();
          mesh.material.dispose();
        }
      }
    }
  }
  assert.ok(seen.size > 30);
});
test("death consumes a life and restores every item and the room geometry", () => {
  const e = fresh();
  touchItem(e, 251);
  e.cpu.pc = 0x8742;
  e.runToBoundary();
  assert.equal(e.lives, 4);
  assert.equal(e.collected, 0);
  assert.deepEqual(Array.from(e.m.slice(0x4a0, 0x7c0)), levels[0].map);
  e.m[0x3df] = 1;
  e.cpu.pc = 0x8742;
  e.runToBoundary();
  assert.equal(e.status, "gameover");
  assert.equal(e.lives, 0);
});
test("death presentation finishes in six short frames without flying up the screen", () => {
  for (const hardcore of [true, false]) {
    const e = new MinerEngine(data, levels, { hardcore });
    const y = e.m[0x35c];
    e.cpu.pc = 0x8742;
    let seconds = 0;
    for (let i = 0; i < 6; i++) {
      seconds += e.tick(0);
      assert.equal(e.lives, 4);
      assert.equal(e.dying, true);
      assert.ok(Math.abs(e.m[0x35c] - y) <= 2);
    }
    e.tick(0);
    assert.equal(e.dying, false);
    assert.equal(e.lives, 4);
    assert.ok(seconds >= 0.45 && seconds < 0.55);
  }
});
test("sprite collision uses pixel masks, not merely overlapping rectangles", () => {
  const e = fresh();
  e.m[0xd015] = 3;
  e.m[0xd010] = 0;
  e.m[0xd01c] = 0;
  e.m[0xd000] = 100;
  e.m[0xd001] = 100;
  e.m[0xd002] = 100;
  e.m[0xd003] = 100;
  e.m[0x352] = 50;
  e.m[0x35c] = 100;
  e.m[0x7f8] = 0x90;
  e.m[0x7f9] = 0x91;
  e.m.fill(0, 0x2400, 0x2480);
  e.m[0x2400] = 0x80;
  e.m[0x2440] = 0x40;
  assert.equal(e.spriteCollision(), 0);
  e.m[0x2440] = 0;
  e.m[0x2462] = 0x10; // Enemy pixel at (11, 11), inside the displayed torso.
  assert.equal(e.spriteCollision(), 3);
  e.m[0x352] = 60; // Logical movement precedes the VIC register update.
  assert.equal(e.spriteCollision(), 0);
  e.m[0xd002] = 120;
  assert.equal(e.spriteCollision(), 3);
  e.god = true;
  assert.equal(e.spriteCollision(), 0);
});
function openFloor(hardcore) {
  const e = new MinerEngine(data, levels, { hardcore });
  e.m.fill(32, 0x4a0, 0x7c0);
  e.god = true;
  return e;
}
test("the entrance ladder can be climbed past its adjacent spikes in both modes", () => {
  for (const hardcore of [false, true]) {
    for (const x of [92, 93]) {
      const e = new MinerEngine(data, levels, { hardcore });
      e.m[0x352] = x;
      e.m[0x35c] = 221;
      // Isolate the real ladder and spike layout from roaming creatures.
      e.spriteCollision = () => 0;
      for (let i = 0; i < 20; i++) e.tick(1);
      assert.equal(e.lives, 5, `mode ${hardcore}, approach ${x}`);
      assert.equal(e.lastDeath, null);
      assert.equal(e.m[0x35c], 181);
    }
  }
});
test("Modern supports Space-only jumping, air reversal and stopping; Hardcore commits its direction", () => {
  const e = openFloor(false);
  const x = e.m[0x352],
    y = e.m[0x35c];
  e.tick(16);
  assert.equal(e.m[0x35c], y - 2);
  e.tick(8);
  assert.equal(e.m[0x352], x + 1);
  e.tick(4);
  assert.equal(e.m[0x352], x);
  e.tick(0);
  assert.equal(e.m[0x352], x);
  const h = openFloor(true);
  h.tick(24);
  h.tick(24);
  const hx = h.m[0x352];
  h.tick(4);
  assert.equal(h.m[0x352], hx + 1);
});
test("Modern buffers a jump just before landing and does not repeatedly jump while held", () => {
  const e = openFloor(false);
  e.m[0x35c] = 219;
  e.m[0x3d6] = 1;
  e.tick(16);
  assert.equal(e.m[0x35c], 221);
  e.tick(16);
  assert.equal(e.m[0x35c], 219);
  for (let i = 0; i < 80; i++) e.tick(16);
  assert.equal(e.m[0x35c], 221);
  assert.equal(e.m[0x3d4], 0);
  e.reset();
  assert.equal(e.hardcore, false);
  assert.equal(e.jumpBuffer, 0);
  assert.equal(e.previousJump, false);
});
test("Modern runs every original room with changing inputs", () => {
  const e = new MinerEngine(data, levels, { hardcore: false });
  for (let room = 0; room < 30; room++) {
    e.select(room);
    for (let i = 0; i < 120 && e.status === "playing"; i++)
      e.tick([0, 4, 8, 16, 24][Math.floor(i / 12) % 5]);
    assert.ok(["playing", "gameover"].includes(e.status));
    assert.ok(e.lives >= 0 && e.lives <= 5);
  }
});
test("Settings default to Modern and persist safely even when storage is unavailable", () => {
  let value;
  const storage = { getItem: () => value, setItem: (_, v) => (value = v) };
  assert.deepEqual(loadSettings(storage), {
    hardcore: false,
    reducedMotion: false,
  });
  assert.equal(
    saveSettings(storage, { hardcore: true, reducedMotion: true }),
    true,
  );
  assert.deepEqual(loadSettings(storage), {
    hardcore: true,
    reducedMotion: true,
  });
  value = "broken json";
  assert.equal(loadSettings(storage).hardcore, false);
  assert.equal(saveSettings(null, {}), false);
  assert.equal(loadSettings(null).hardcore, false);
});
test("jump arc has twelve two-pixel ascent steps and a four-step apex, as in the original routine", () => {
  const e = fresh();
  e.m.fill(32, 0x4a0, 0x7c0);
  e.cpu.readHook = (a) =>
    a === 0xdc00 ? 255 ^ e.input : a === 0xd01e ? 0 : undefined;
  e.m[0x35c] = 160;
  e.m[0x3d4] = 1;
  e.m[0x3d3] = 0;
  const heights = [160];
  for (let i = 0; i < 15; i++) {
    e.tick(0);
    heights.push(e.m[0x35c]);
  }
  assert.deepEqual(
    heights.slice(0, 12),
    Array.from({ length: 12 }, (_, i) => 160 - 2 * i),
  );
  assert.equal(heights[12], heights[15]);
});
test("CPU indexed reads and DEC absolute use NMOS cycle timings", () => {
  const c = new CPU();
  c.m.set([0xce, 0, 0x20, 0xbd, 0xff, 0x20], 0x1000);
  c.pc = 0x1000;
  c.m[0x2000] = 5;
  c.step();
  assert.equal(c.cycles, 6);
  assert.equal(c.m[0x2000], 4);
  c.x = 1;
  c.m[0x2100] = 7;
  c.step();
  assert.equal(c.a, 7);
  assert.equal(c.cycles, 11);
});
