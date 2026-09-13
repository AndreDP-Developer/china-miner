import "./style.css";
import { MinerEngine } from "./engine.js";
import { MineScene } from "./scene.js";

const $ = (id) => document.getElementById(id);
const base = import.meta.env.BASE_URL;
const [data, levels] = await Promise.all(
  ["original", "levels"].map(async (name) => {
    const r = await fetch(`${base}data/${name}.json`);
    if (!r.ok) throw new Error(`Could not load ${name}`);
    return r.json();
  }),
);
const engine = new MinerEngine(data, levels);
let scene;
try {
  scene = new MineScene($("viewport"), engine);
} catch (error) {
  $("start-button").disabled = true;
  $("start-overlay").querySelector("h2").textContent = "WebGL could not start";
  $("start-overlay").querySelector("p").textContent =
    "Please enable hardware acceleration in your browser, then reload.";
  throw error;
}
let started = false,
  paused = true,
  assisted = false,
  speed = 1,
  budget = 0,
  keys = new Set(),
  touch = 0,
  lastTime = 0,
  toastTimer;
let previous = engine.snapshot(),
  soundEnabled = false,
  audio;
const keyBits = {
  ArrowLeft: 4,
  KeyA: 4,
  ArrowRight: 8,
  KeyD: 8,
  ArrowUp: 1,
  KeyW: 1,
  ArrowDown: 2,
  KeyS: 2,
  Space: 16,
  ShiftLeft: 16,
  ShiftRight: 16,
};

class Sound {
  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.11;
    this.master.connect(this.ctx.destination);
    this.drone = this.ctx.createGain();
    this.drone.gain.value = 0.12;
    this.drone.connect(this.master);
    for (const hz of [73.42, 110.0]) {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = hz;
      o.connect(this.drone);
      o.start();
    }
  }
  enable(value) {
    this.master.gain.setTargetAtTime(
      value ? 0.11 : 0,
      this.ctx.currentTime,
      0.2,
    );
    if (value) this.ctx.resume();
  }
  note(freq, duration = 0.14, type = "sine", delay = 0) {
    const t = this.ctx.currentTime + delay,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.8, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  effect(kind) {
    if (!soundEnabled) return;
    if (kind === "pickup") {
      [523, 659, 784].forEach((n, i) => this.note(n, 0.22, "sine", i * 0.08));
    } else if (kind === "death") {
      this.note(110, 0.35, "triangle");
      this.note(73, 0.45, "triangle", 0.1);
    } else if (kind === "jump") this.note(280, 0.08, "triangle");
    else
      [392, 523, 659, 784].forEach((n, i) =>
        this.note(n, 0.24, "sine", i * 0.1),
      );
  }
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3000);
}
function testMode() {
  assisted = true;
  $("practice-badge").hidden = false;
}
function setPaused(value, overlay = true) {
  paused = value;
  keys.clear();
  touch = 0;
  engine.input = 0;
  budget = 0;
  $("pause-overlay").hidden = !value || !started || !overlay;
  if (value) {
    $("pause-kicker").textContent = "TAKE A BREATHER";
    $("pause-title").textContent = "Lanterns still burning.";
    $("pause-copy").textContent = "Your adventure is paused.";
    $("resume-button").innerHTML = "Back to the mine <span>→</span>";
  }
}
function start() {
  if (engine.status !== "playing") engine.reset();
  started = true;
  $("start-overlay").hidden = true;
  setPaused(false);
  audio?.ctx.resume();
  $("viewport").focus({ preventScroll: true });
  document
    .querySelector(".game-shell")
    .scrollIntoView({ block: "start", behavior: "smooth" });
}
function selectLevel(index) {
  testMode();
  engine.select(index);
  started = true;
  $("start-overlay").hidden = true;
  setPaused(true, false);
  previous = engine.snapshot();
  updateUI();
  toast(`Room ${index + 1} loaded · Enter to play`);
}
function endGame() {
  paused = true;
  keys.clear();
  $("pause-overlay").hidden = false;
  const won = engine.status === "complete";
  $("pause-kicker").textContent = won
    ? "THE END OF THE DESCENT"
    : "FIVE LIVES. ONE MORE TRY.";
  $("pause-title").textContent = won
    ? "A jolly good megazap!"
    : "The mine keeps its secrets.";
  $("pause-copy").textContent = won
    ? `All thirty caverns conquered. Final score: ${engine.score}.`
    : `Final score: ${engine.score}. Wally’s next adventure awaits.`;
  $("resume-button").innerHTML = "Try again <span>↗</span>";
}
function gameTick() {
  const before = engine.snapshot();
  const dt = engine.tick();
  const after = engine.snapshot();
  if (after.lives < before.lives) {
    audio?.effect("death");
    toast(
      `${after.lives} ${after.lives === 1 ? "life" : "lives"} left · Room reset`,
    );
    $("viewport").animate(
      [
        { filter: "brightness(1)" },
        { filter: "brightness(1.6) saturate(.4)" },
        { filter: "brightness(1)" },
      ],
      { duration: 350 },
    );
  }
  if (after.collected > before.collected) {
    audio?.effect("pickup");
    toast(
      after.collected === 4
        ? "Four treasures found. Take the key!"
        : `${after.collected} of 4 treasures found`,
    );
  }
  if (after.jumpPhase > 0 && before.jumpPhase === 0) audio?.effect("jump");
  if (after.level !== before.level) {
    audio?.effect("room");
    toast(`${after.name} · Room ${after.level}`);
  }
  if (engine.status !== "playing") endGame();
  previous = after;
  return dt;
}
function updateUI() {
  const i = engine.level,
    level = levels[i];
  $("room-number").textContent = String(i + 1).padStart(2, "0");
  $("room-name").textContent = level.name;
  $("biome-label").textContent =
    scene.theme?.name.toUpperCase() || "THE JADE MINES";
  $("scene-label").textContent =
    `PONG DYNASTY · JADE MINE ${String(i + 1).padStart(2, "0")}`;
  $("score").textContent = String(engine.score).padStart(5, "0");
  $("lives").textContent = Array(Math.min(engine.lives, 10))
    .fill("◆")
    .join(" ");
  $("lives").setAttribute("aria-label", `${engine.lives} lives`);
  $("collected").innerHTML = `${engine.collected} <i>/ 4</i>`;
  $("key-status").textContent =
    engine.collected === 4 ? "The key is ready" : "Collect all four to unlock";
  const map = engine.m.slice(0x4a0, 0x7c0);
  document.querySelectorAll("[data-item]").forEach((el) => {
    const found = !map.includes(Number(el.dataset.item));
    el.classList.toggle("found", found);
    el.querySelector("i").textContent = found ? "FOUND" : "FIND";
  });
  $("level-select").value = String(i);
  if (!$("debug-panel").hidden) {
    const s = engine.snapshot();
    $("debug-state").textContent =
      `ROOM ${s.level} / 30    ${paused ? "PAUSED" : "RUNNING"}\nX ${s.player.x}  Y ${s.player.y}\nJump ${s.jumpPhase}  Fall ${s.fallCounter}\nInput 0x${s.input.toString(16)}  Frame ${s.player.frame}\nTick ${s.ticks}  Score ${s.score}\nCPU cycles ${s.cycles}\n${assisted ? "TEST RUN" : "NORMAL RUN"} · ${speed}×`;
    $("pause-debug").textContent = paused ? "Resume" : "Pause";
  }
}
function toggleDebug() {
  const hidden = !$("debug-panel").hidden;
  $("debug-panel").hidden = hidden;
  $("debug-button").setAttribute("aria-expanded", String(!hidden));
  updateUI();
}
function openDialog(id) {
  if (started && engine.status === "playing") setPaused(true, false);
  $(id).showModal();
}
function closeDialog(id) {
  $(id).close();
  if (started && engine.status === "playing") setPaused(true);
}

$("start-button").onclick = start;
$("resume-button").onclick = () => {
  if (engine.status !== "playing") {
    engine.reset();
    assisted = false;
    $("practice-badge").hidden = true;
    engine.god = false;
    $("god-mode").checked = false;
    speed = 1;
    $("speed-select").value = "1";
  }
  start();
};
$("play-tab").onclick = () => {
  if (!started) start();
  else if (engine.status === "playing") setPaused(!paused);
};
$("rooms-button").onclick = $("browse-button").onclick = () =>
  openDialog("rooms-dialog");
$("about-button").onclick = () => openDialog("about-dialog");
document
  .querySelectorAll("[data-close]")
  .forEach((el) => (el.onclick = () => closeDialog(el.dataset.close)));
document.querySelectorAll("dialog").forEach((d) =>
  d.addEventListener("cancel", () => {
    if (started && engine.status === "playing") setPaused(true);
  }),
);
$("restart-button").onclick = () => selectLevel(engine.level);
$("debug-button").onclick = $("close-debug").onclick = toggleDebug;
$("prev-level").onclick = () => selectLevel(Math.max(0, engine.level - 1));
$("next-level").onclick = () => selectLevel(Math.min(29, engine.level + 1));
$("level-select").onchange = (event) => selectLevel(Number(event.target.value));
$("god-mode").onchange = (event) => {
  engine.god = event.target.checked;
  if (engine.god) testMode();
  toast(engine.god ? "Invulnerability enabled" : "Invulnerability disabled");
};
$("collision-mode").onchange = (event) => {
  scene.debugGroup.visible = event.target.checked;
  scene.drawDebug();
};
$("speed-select").onchange = (event) => {
  speed = Number(event.target.value);
  if (speed !== 1) testMode();
  budget = 0;
};
$("pause-debug").onclick = () => {
  if (!started) start();
  else setPaused(!paused, false);
};
$("step-debug").onclick = () => {
  testMode();
  started = true;
  $("start-overlay").hidden = true;
  setPaused(true, false);
  if (engine.status === "playing") {
    gameTick();
    scene.render(performance.now() / 1000, false);
    updateUI();
  }
};
$("unlock-debug").onclick = () => {
  testMode();
  const m = engine.m;
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 40; x++) {
      const a = 0x4a0 + y * 40 + x;
      if (m[a] >= 251) {
        for (const d of [0, 1, 40, 41]) m[a + d] = 32;
      }
    }
  m[0x3e2] = 4;
  toast("Test assist · All treasures collected");
};
$("copy-debug").onclick = async () => {
  try {
    await navigator.clipboard.writeText(
      JSON.stringify(engine.snapshot(), null, 2),
    );
    toast("State copied to clipboard");
  } catch {
    toast("Clipboard unavailable; state is shown in the test panel");
  }
};
$("sound-button").onclick = () => {
  soundEnabled = !soundEnabled;
  try {
    if (!audio) audio = new Sound();
    audio.enable(soundEnabled);
    $("sound-button").classList.toggle("active", soundEnabled);
    $("sound-button").setAttribute(
      "aria-label",
      soundEnabled ? "Mute sound" : "Enable sound",
    );
    toast(soundEnabled ? "Ambient sound on" : "Sound muted");
  } catch {
    soundEnabled = false;
    toast("Audio unavailable in this browser");
  }
};
$("fullscreen-button").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("viewport").requestFullscreen();
  } catch {
    toast("Fullscreen is unavailable in this browser");
  }
};

for (const [i, level] of levels.entries()) {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = `${String(i + 1).padStart(2, "0")} · ${level.name}`;
  $("level-select").append(opt);
  const b = document.createElement("button");
  b.className = "room-card";
  b.setAttribute("aria-label", `Select room ${i + 1}: ${level.name}`);
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 80;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#132720";
  ctx.fillRect(0, 0, 160, 80);
  level.map.forEach((code, j) => {
    if (code === 32) return;
    ctx.fillStyle =
      code >= 250
        ? "#e5c786"
        : code >= 120 && code < 130
          ? "#7ba98f"
          : code === 70 || code === 135
            ? "#cf997f"
            : "#52715e";
    ctx.fillRect((j % 40) * 4, Math.floor(j / 40) * 4, 4, code >= 250 ? 4 : 2);
  });
  b.append(c);
  const num = document.createElement("b");
  num.textContent = String(i + 1).padStart(2, "0");
  b.append(num);
  const name = document.createElement("span");
  name.textContent = level.name;
  b.append(name);
  b.onclick = () => {
    $("rooms-dialog").close();
    selectLevel(i);
  };
  $("rooms-grid").append(b);
}

addEventListener("keydown", (event) => {
  if (event.code === "F2") {
    event.preventDefault();
    toggleDebug();
    return;
  }
  if (
    document.querySelector("dialog[open]") ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)
  )
    return;
  if (event.code in keyBits) {
    event.preventDefault();
    keys.add(event.code);
    return;
  }
  if (event.repeat) return;
  if (event.code === "Enter") {
    if (!started) start();
    else if (engine.status !== "playing") $("resume-button").click();
    else setPaused(!paused);
  }
  if (event.code === "KeyP" || event.code === "Escape") {
    if (started && engine.status === "playing") setPaused(!paused);
  }
  if (event.code === "BracketRight")
    selectLevel(Math.min(29, engine.level + 1));
  if (event.code === "BracketLeft") selectLevel(Math.max(0, engine.level - 1));
  if (event.code === "KeyG") {
    engine.god = !engine.god;
    $("god-mode").checked = engine.god;
    if (engine.god) testMode();
    toast(engine.god ? "Invulnerability enabled" : "Invulnerability disabled");
  }
  if (event.code === "KeyM") $("sound-button").click();
});
addEventListener("keyup", (event) => keys.delete(event.code));
addEventListener("blur", () => {
  keys.clear();
  touch = 0;
  if (started && engine.status === "playing") setPaused(true);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started && engine.status === "playing")
    setPaused(true);
});
document.querySelectorAll("[data-key]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    touch |= Number(button.dataset.key);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(type, () => {
      touch &= ~Number(button.dataset.key);
    });
});
function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  try {
    if (started && !paused && engine.status === "playing") {
      engine.input = touch;
      for (const key of keys) engine.input |= keyBits[key] || 0;
      const pad = navigator.getGamepads?.()[0];
      if (pad) {
        if (pad.axes[0] < -0.35 || pad.buttons[14]?.pressed) engine.input |= 4;
        if (pad.axes[0] > 0.35 || pad.buttons[15]?.pressed) engine.input |= 8;
        if (pad.axes[1] < -0.35 || pad.buttons[12]?.pressed) engine.input |= 1;
        if (pad.axes[1] > 0.35 || pad.buttons[13]?.pressed) engine.input |= 2;
        if (pad.buttons[0]?.pressed) engine.input |= 16;
      }
      budget += dt * speed;
      let n = 0;
      while (budget > 0 && n++ < 8 && !paused) {
        budget -= gameTick();
      }
    }
    scene.render(time / 1000, started && !paused);
    updateUI();
  } catch (error) {
    paused = true;
    console.error(error);
    toast(`Simulation stopped: ${error.message}`);
  }
  requestAnimationFrame(frame);
}
const params = new URLSearchParams(location.search);
if (params.has("level")) {
  const n = Number(params.get("level"));
  if (Number.isInteger(n) && n >= 1 && n <= 30) selectLevel(n - 1);
}
if (params.has("debug")) toggleDebug();
// Explicit, documented test API; no console-only controls are required to play.
window.chinaMiner = {
  engine,
  levels,
  scene,
  selectLevel,
  pause: () => setPaused(true, false),
  resume: start,
  step: () => $("step-debug").click(),
  snapshot: () => engine.snapshot(),
};
requestAnimationFrame(frame);
