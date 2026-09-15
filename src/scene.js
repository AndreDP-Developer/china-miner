import * as THREE from "./vendor/three.module.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { originalArtMesh, spritePixels, pickupPixels } from "./original-art.js";

const COLORS = [
  0x15272b, 0xffedd5, 0xc07755, 0x71dedb, 0xbe81cf, 0x84b58a, 0x6998b1,
  0xffcf77, 0xaa7847, 0x6b5740, 0xe29d80, 0x385258, 0x809ca1, 0xc7e6ab,
  0x8bb9d7, 0xc4cfc1,
];
const THEMES = [
  {
    name: "The Jade Mines",
    stone: 0x385957,
    trim: 0x739384,
    glow: 0x73d8b6,
    fog: 0x102d31,
  },
  {
    name: "The Copper Works",
    stone: 0x625247,
    trim: 0xb08b61,
    glow: 0xf5ba74,
    fog: 0x302728,
  },
  {
    name: "The Sunken Chambers",
    stone: 0x365768,
    trim: 0x80a9b8,
    glow: 0x86dded,
    fog: 0x112d43,
  },
  {
    name: "The Amethyst Depths",
    stone: 0x514960,
    trim: 0x9e88ae,
    glow: 0xc69ae2,
    fog: 0x292039,
  },
  {
    name: "The Forgotten Gardens",
    stone: 0x435d49,
    trim: 0x89a679,
    glow: 0xb9d699,
    fog: 0x192e27,
  },
  {
    name: "The Mountain King",
    stone: 0x595449,
    trim: 0xb59c67,
    glow: 0xf4d28d,
    fog: 0x292b2b,
  },
];
function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...options });
}
const boxGeometry = new RoundedBoxGeometry(1, 1, 1, 1, 0.055);
const sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
const coneGeometry = new THREE.ConeGeometry(1, 1, 5);
const dummy = new THREE.Object3D();
function mesh(parent, geom, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(geom, mat);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  parent.add(o);
  return o;
}
function box(parent, mat, x, y, z, sx, sy, sz) {
  return mesh(parent, boxGeometry, mat, x, y, z, sx, sy, sz);
}
function cylinder(parent, mat, x, y, z, r, h) {
  return mesh(parent, new THREE.CylinderGeometry(r, r, h, 12), mat, x, y, z);
}

export class MineScene {
  constructor(container, engine) {
    this.engine = engine;
    this.container = container;
    this.lastLevel = -1;
    this.lastMap = "";
    this.lowMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.7;
    container.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "China Miner game scene",
    );
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-21, 21, 11.7, -11.7, 0.1, 180);
    this.camera.position.set(20, 10, 70);
    this.camera.lookAt(20, 10, 0);
    this.scene.add(new THREE.HemisphereLight(0xc5e8e0, 0x1c293b, 1.6));
    const light = new THREE.DirectionalLight(0xffd7ac, 3.6);
    light.position.set(-12, 35, 35);
    this.scene.add(light);
    const rim = new THREE.DirectionalLight(0x7fcbdd, 1.7);
    rim.position.set(40, 2, 8);
    this.scene.add(rim);
    this.background = new THREE.Group();
    this.terrain = new THREE.Group();
    this.entities = new THREE.Group();
    this.scene.add(this.background, this.terrain, this.entities);
    this.gold = material(0xe9b86d, { metalness: 0.45, roughness: 0.4 });
    this.dark = material(0x193032);
    this.ivory = material(0xffe9c5);
    this.jade = material(0x7bddb7, {
      metalness: 0.3,
      roughness: 0.2,
      emissive: 0x1b6146,
      emissiveIntensity: 0.7,
    });
    this.player = new THREE.Group();
    this.entities.add(this.player);
    this.lamp = new THREE.PointLight(0xffd99b, 16, 8, 1.7);
    this.entities.add(this.lamp);
    this.creatureCache = new Map();
    this.creatures = Array.from({ length: 7 }, () => {
      const group = new THREE.Group();
      this.entities.add(group);
      return group;
    });
    this.items = new THREE.Group();
    this.entities.add(this.items);
    this.itemModels = new Map();
    this.rings = [];
    this.debugGroup = new THREE.Group();
    this.scene.add(this.debugGroup);
    this.debugGroup.visible = false;
    this.particlePositions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      this.particlePositions[i * 3] = Math.random() * 46 - 3;
      this.particlePositions[i * 3 + 1] = Math.random() * 26 - 3;
      this.particlePositions[i * 3 + 2] = -Math.random() * 12;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute(
      "position",
      new THREE.BufferAttribute(this.particlePositions, 3),
    );
    this.particles = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        color: 0xbde8cf,
        size: 0.065,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.scene.add(this.particles);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    let halfH = 11.7,
      halfW = (halfH * w) / h;
    if (halfW < 21) {
      halfW = 21;
      halfH = (halfW * h) / w;
    }
    Object.assign(this.camera, {
      left: -halfW,
      right: halfW,
      top: halfH,
      bottom: -halfH,
    });
    this.camera.updateProjectionMatrix();
  }
  clear(group) {
    group.traverse((o) => {
      if (
        o.geometry &&
        ![boxGeometry, sphereGeometry, coneGeometry].includes(o.geometry)
      )
        o.geometry.dispose();
      if (
        o.material &&
        !Array.isArray(o.material) &&
        !Object.values(this).includes(o.material)
      )
        o.material.dispose();
    });
    group.clear();
  }
  buildBackground(level) {
    this.clear(this.background);
    this.water = [];
    this.flames = [];
    this.theme = THEMES[Math.floor(level / 5)];
    const t = this.theme;
    this.scene.fog = new THREE.FogExp2(t.fog, 0.006);
    // Layered, deliberately quiet cavern silhouettes behind the untouched playfield.
    const wall = material(t.fog);
    box(this.background, wall, 20, 10, -24, 65, 44, 2);
    const seeded = (n) => {
      const v = Math.sin(n * 127.1 + level * 31.8) * 43758.5453;
      return v - Math.floor(v);
    };
    for (let layer = 0; layer < 3; layer++) {
      const color = new THREE.Color(t.stone).multiplyScalar(0.25 + layer * 0.1),
        m = material(color);
      for (let i = 0; i < 16; i++) {
        let x = i * 3 - 3 + seeded(i + layer * 24),
          hh = 2 + seeded(i + layer * 60) * 7;
        const top = mesh(
          this.background,
          coneGeometry,
          m,
          x,
          20 - hh * 0.5 + seeded(i + 9) * 3,
          -19 + layer * 4,
          2.5,
          hh,
          2,
        );
        top.rotation.z = Math.PI;
        mesh(
          this.background,
          coneGeometry,
          m,
          x,
          -1 + hh * 0.3,
          -20 + layer * 4,
          2.8,
          hh * 0.8,
          2.5,
        );
      }
    }
    // The ruined gate of the Pong dynasty, visible deep behind the platforms.
    const temple = material(new THREE.Color(t.stone).multiplyScalar(0.6)),
      wood = material(0x34494a);
    for (const x of [12, 26]) {
      box(this.background, temple, x, 7, -13, 1.6, 14, 1.5);
      box(this.background, temple, x, 1, -12.8, 2.5, 1.1, 2.2);
      box(this.background, wood, x, 14, -12.8, 2.1, 0.8, 2.1);
    }
    box(this.background, temple, 19, 13, -13, 16, 1.3, 2);
    box(this.background, wood, 19, 14, -13, 18, 0.65, 3);
    for (const x of [10.5, 27.5])
      box(this.background, wood, x, 14.45, -13, 2, 0.5, 3).rotation.z =
        x < 19 ? -0.3 : 0.3;
    box(this.background, temple, 19, 11.65, -12.8, 4, 1.2, 0.25);
    const carv = material(new THREE.Color(t.trim).multiplyScalar(0.6));
    for (let i = 0; i < 5; i++)
      box(
        this.background,
        carv,
        17.6 + i * 0.7,
        11.65,
        -12.6,
        0.22,
        0.58,
        0.08,
      );
    for (const x of [6, 33]) {
      const wm = new THREE.MeshBasicMaterial({
        color: t.glow,
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
      });
      box(this.background, wm, x, 10, -10, 0.65, 23, 0.02);
      for (let i = 0; i < 12; i++) {
        const w = box(
          this.background,
          wm,
          x + (seeded(i + x) - 0.5) * 0.7,
          i * 2,
          -9.9,
          0.025,
          0.6,
          0.02,
        );
        this.water.push(w);
      }
    }
    const crystal = material(t.glow, {
      metalness: 0.3,
      roughness: 0.25,
      emissive: t.glow,
      emissiveIntensity: 0.2,
    });
    for (const x of [1.4, 8, 29, 38]) {
      for (let i = 0; i < 4; i++) {
        const c = mesh(
          this.background,
          coneGeometry,
          crystal,
          x + i * 0.35,
          -0.4 + (i % 2) * 0.3,
          -3,
          0.24,
          1 + seeded(x + i) * 1.8,
          0.35,
        );
        c.rotation.z = (i - 1.5) * 0.2;
      }
    }
    for (const x of [-0.8, 40.8]) {
      const chain = material(0x796c4c);
      box(this.background, chain, x, 18.4, -0.4, 0.045, 4, 0.045);
      box(this.background, this.gold, x, 16.2, -0.3, 0.9, 0.15, 0.7);
      box(this.background, this.gold, x, 15.2, -0.3, 0.9, 0.14, 0.7);
      const fire = mesh(
        this.background,
        sphereGeometry,
        material(0xffce79, {
          emissive: 0xffaa43,
          emissiveIntensity: 1.7,
          transparent: true,
          opacity: 0.9,
        }),
        x,
        15.7,
        -0.3,
        0.35,
        0.48,
        0.3,
      );
      this.flames.push(fire);
      for (const dx of [-0.34, 0.34])
        box(this.background, chain, x + dx, 15.7, -0.2, 0.045, 1, 0.04);
      const l = new THREE.PointLight(0xffb762, 16, 9, 1.5);
      l.position.set(x, 15.7, 2);
      this.background.add(l);
    }
    this.createTerrainBatches();
    this.lastMap = "";
  }
  createTerrainBatches() {
    this.clear(this.terrain);
    const t = this.theme;
    const mats = {
      rock: material(t.stone),
      edge: material(t.trim),
      brick: material(new THREE.Color(t.stone).multiplyScalar(1.2)),
      crumble: material(0xad855e),
      ladder: this.gold,
      hazard: material(0xc1b6a0),
      belt: material(0x548f94, { metalness: 0.55, roughness: 0.4 }),
      laser: material(0xe69a92, { emissive: 0xff695e, emissiveIntensity: 2 }),
      slide: material(0x81bcb1, { metalness: 0.5, roughness: 0.4 }),
    };
    this.batches = {};
    for (const [k, mat] of Object.entries(mats)) {
      const g = k === "hazard" ? coneGeometry : boxGeometry;
      const b = new THREE.InstancedMesh(g, mat, 2600);
      b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      b.frustumCulled = false;
      this.batches[k] = b;
      this.terrain.add(b);
    }
  }
  put(type, x, y, z, sx, sy, sz, rot = 0, tint = 0xffffff) {
    const b = this.batches[type];
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, 0, rot);
    dummy.updateMatrix();
    b.setMatrixAt(b.count, dummy.matrix);
    b.setColorAt(b.count, new THREE.Color(tint));
    b.count++;
  }
  rebuildTiles() {
    const m = this.engine.m;
    const map = Array.from(m.slice(0x4a0, 0x7c0)).join(",");
    if (map === this.lastMap) return;
    this.lastMap = map;
    for (const b of Object.values(this.batches)) b.count = 0;
    const tile = (c, x, y) => {
      if (c === 32 || c >= 147) return;
      if (c >= 120 && c <= 128) {
        if (c === 120) {
          this.put("ladder", x + 0.2, y, 0.05, 0.11, 1.03, 0.18);
          this.put("ladder", x + 1.8, y, 0.05, 0.11, 1.03, 0.18);
          for (let k = 0; k < 2; k++)
            this.put(
              "ladder",
              x + 1,
              y - 0.24 + k * 0.5,
              0.09,
              1.6,
              0.08,
              0.16,
            );
        }
        return;
      }
      if (c === 129) return;
      if (c >= 130 && c <= 134) {
        this.put(
          "slide",
          x + 0.5,
          y,
          0.08,
          1.4,
          0.13,
          0.75,
          c % 2 ? Math.PI / 4 : -Math.PI / 4,
        );
        return;
      }
      if (c === 70 || c === 135) {
        this.put(
          "hazard",
          x + 0.5,
          y,
          0,
          0.45,
          0.98,
          0.4,
          c === 70 ? Math.PI : 0,
        );
        return;
      }
      if (c >= 136 && c <= 139) {
        if (c % 2)
          this.put(
            "laser",
            x + 0.5,
            y,
            0.2,
            c < 138 ? 0.88 : 0.12,
            c < 138 ? 0.12 : 1,
            0.12,
          );
        return;
      }
      if (c === 146) return;
      if (c === 84 || c === 85 || c === 86 || c === 87) {
        this.put("edge", x + 0.5, y, -0.02, 0.4, 0.45, 0.6);
        return;
      }
      const crumb = c >= 33 && c <= 36,
        belt =
          c === 62 ||
          c === 63 ||
          (c >= 76 && c <= 83) ||
          (c >= 140 && c <= 145);
      const kind = crumb
        ? "crumble"
        : belt
          ? "belt"
          : c === 75
            ? "brick"
            : "rock";
      const h = crumb ? 0.2 : belt ? 0.25 : 1;
      const tint =
        c === 73
          ? 0x80c3e5
          : c === 74
            ? 0x9be2d2
            : c === 64 || c === 65
              ? 0xb0d28c
              : c >= 66 && c <= 69
                ? 0xe2bd99
                : 0xffffff;
      this.put(kind, x + 0.5, y + (1 - h) / 2, 0, 0.97, h, 0.7, 0, tint);
      this.put("edge", x + 0.5, y + 0.47, 0.04, 0.97, 0.07, 0.83);
      if (!crumb && !belt) {
        this.put("brick", x + 0.28, y - 0.08, 0.39, 0.4, 0.32, 0.1);
        this.put("brick", x + 0.76, y - 0.27, 0.39, 0.4, 0.3, 0.1);
      }
      if (belt) {
        for (let k = 0; k < 2; k++)
          this.put(
            "edge",
            x + 0.25 + k * 0.45,
            y + 0.35,
            0.45,
            0.14,
            0.1,
            0.07,
          );
      }
      if (crumb && c < 36)
        this.put("rock", x + 0.5, y + 0.46, 0.46, 0.07, 0.13, 0.03, 0.3);
    };
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 40; x++) tile(m[0x4a0 + y * 40 + x], x, 19.5 - y);
    for (let x = 0; x < 40; x++) {
      tile(72, x, 20.5);
      tile(72, x, -0.5);
    }
    for (const b of Object.values(this.batches)) {
      b.instanceMatrix.needsUpdate = true;
      if (b.instanceColor) b.instanceColor.needsUpdate = true;
    }
    const live = new Set();
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 40; x++) {
        const c = m[0x4a0 + y * 40 + x];
        if (c >= 250) {
          const key = `${x},${y}`;
          live.add(key);
          if (!this.itemModels.has(key)) {
            const model = this.createItem(c);
            model.position.set(x + 1, 19 - y, 0.8);
            model.userData.baseY = 19 - y;
            model.userData.kind = c;
            model.userData.seed = x + y;
            this.items.add(model);
            this.itemModels.set(key, model);
          }
        }
      }
    for (const [key, model] of this.itemModels)
      if (!live.has(key)) {
        this.items.remove(model);
        this.itemModels.delete(key);
      }
  }
  createItem(c) {
    const g = new THREE.Group();
    const art = originalArtMesh(pickupPixels(this.engine, c), 16, 16);
    art.position.set(0, 0, 0);
    g.add(art);
    return g;
  }
  drawEnemies() {
    const m = this.engine.m;
    for (let i = 1; i < 8; i++) {
      const s = this.engine.sprite(i);
      const group = this.creatures[i - 1];
      group.visible = s.enabled && s.y >= -30 && s.x >= -30 && s.x <= 335;
      if (!group.visible) continue;
      if (!s.frame && m[0x384 + i]) s.frame = m[0x3a2 + i];
      const key = `${s.frame}:${s.multi}:${s.color}:${m[0xd025]}:${m[0xd026]}`;
      if (group.userData.frameKey !== key) {
        if (!this.creatureCache.has(key))
          this.creatureCache.set(
            key,
            new THREE.Group().add(
              originalArtMesh(spritePixels(this.engine, s), 24, 21),
            ),
          );
        group.clear();
        group.add(this.creatureCache.get(key).clone());
        group.userData.frameKey = key;
      }
      group.position.set(s.x / 8, 20 - s.y / 8, 0.4);
    }
  }
  drawDebug() {
    this.debugGroup.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.debugGroup.clear();
    if (!this.debugGroup.visible) return;
    const positions = [];
    for (let x = 0; x <= 40; x++) positions.push(x, 0, 1.5, x, 20, 1.5);
    for (let y = 0; y <= 20; y++) positions.push(0, y, 1.5, 40, y, 1.5);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    this.debugGroup.add(
      new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({
          color: 0x99c6ac,
          transparent: true,
          opacity: 0.22,
        }),
      ),
    );
    for (let i = 0; i < 8; i++) {
      const s = this.engine.sprite(i);
      if (!s.enabled) continue;
      const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(3, 21 / 8, 0.1));
      const l = new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({ color: i ? 0xffb487 : 0xffffff }),
      );
      l.position.set((s.x + 12) / 8, 20 - (s.y + 10.5) / 8, 1.6);
      this.debugGroup.add(l);
    }
    const p = this.engine.sprite(0),
      contact = [];
    for (const { x, y } of this.engine.contactPixels()) {
      const x0 = (p.x + x) / 8,
        y0 = 20 - (p.y + y) / 8;
      contact.push(
        x0,
        y0,
        1.7,
        x0 + 0.125,
        y0,
        1.7,
        x0 + 0.125,
        y0,
        1.7,
        x0 + 0.125,
        y0 - 0.125,
        1.7,
        x0 + 0.125,
        y0 - 0.125,
        1.7,
        x0,
        y0 - 0.125,
        1.7,
        x0,
        y0 - 0.125,
        1.7,
        x0,
        y0,
        1.7,
      );
    }
    const mask = new THREE.BufferGeometry();
    mask.setAttribute("position", new THREE.Float32BufferAttribute(contact, 3));
    this.debugGroup.add(
      new THREE.LineSegments(
        mask,
        new THREE.LineBasicMaterial({
          color: 0xffeab0,
          transparent: true,
          opacity: 0.65,
        }),
      ),
    );
  }
  render(time, playing) {
    const e = this.engine,
      level = e.level;
    if (level !== this.lastLevel) {
      this.lastLevel = level;
      this.buildBackground(level);
      this.items.clear();
      this.itemModels.clear();
    }
    this.rebuildTiles();
    this.drawEnemies();
    const p = e.dying && e.lastDeath ? e.lastDeath.player : e.sprite(0);
    this.player.position.set(p.x / 8, 20 - p.y / 8, 0.5);
    this.player.visible = p.enabled;
    const visibleSprite = { ...p, frame: e.sprite(0).frame };
    const key = `player:${visibleSprite.frame}:${p.multi}:${p.color}:${e.m[0xd025]}:${e.m[0xd026]}`;
    if (this.player.userData.frameKey !== key) {
      if (!this.creatureCache.has(key))
        this.creatureCache.set(
          key,
          new THREE.Group().add(
            originalArtMesh(spritePixels(e, visibleSprite), 24, 21),
          ),
        );
      this.player.clear();
      this.player.add(this.creatureCache.get(key).clone());
      this.player.userData.frameKey = key;
    }
    this.lamp.position
      .copy(this.player.position)
      .add(new THREE.Vector3(0, 1.9, 2));
    for (const model of this.itemModels.values()) {
      model.position.y = model.userData.baseY;
      model.rotation.set(0, 0, 0);
    }

    if (!this.lowMotion) {
      for (const w of this.water)
        w.position.y = ((w.position.y - 0.03 + 24) % 24) - 2;
      for (const f of this.flames)
        f.scale.y = 0.48 + Math.sin(time * 7 + f.position.x) * 0.025;
      for (let i = 0; i < 180; i++) {
        this.particlePositions[i * 3] += 0.0015 * Math.sin(time + i);
        this.particlePositions[i * 3 + 1] += 0.003;
        if (this.particlePositions[i * 3 + 1] > 23)
          this.particlePositions[i * 3 + 1] = -2;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
    if (this.debugGroup.visible && e.ticks !== this.debugTick) {
      this.debugTick = e.ticks;
      this.drawDebug();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
