# China Miner — The Jade Mines

**[Play in your browser](https://andredp-developer.github.io/china-miner/)** — no installation required.

A Three.js fan remake of **China Miner**, programmed and designed by **Ian Gray**, published by **Interceptor Software in 1984** for the Commodore 64.

All thirty original rooms return with layered cavern scenery, a ruined temple, illuminated lanterns, drifting dust, waterfalls and jade crystals. The miner, monsters and pickups use the original C64 artwork, colours and animation frames, displayed with crisp scaling on the high-resolution Three.js canvas.

Original music: **Chris Cox**, based on Scott Joplin’s _Maple Leaf Rag_. This remake uses newly synthesized ambience and effects, not a recording of the original soundtrack.

## Run

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173/**. Click **Enter the mine** or press **Enter**. WebGL2 and browser hardware acceleration are required. The runtime, fonts and game assets are included locally; no CDN or account is required.

```sh
npm test
npm run build
npm run preview
```

The production site is generated in `dist/` and works under a subdirectory. Serve it over HTTP; opening `index.html` directly with `file://` does not support its modules and data requests. GitHub Actions tests and builds each push and provides the production folder as an artifact.

## Play

| Control                | Action                                   |
| ---------------------- | ---------------------------------------- |
| Left / Right, or A / D | Walk                                     |
| Up / Down, or W / S    | Climb ladders                            |
| Space or Shift         | Jump (Modern); add direction in Hardcore |
| Up + Space             | Vertical jump                            |
| P / Escape             | Pause or resume                          |
| Enter                  | Start or resume                          |
| M                      | Toggle sound                             |

Touch buttons and standard gamepad movement / button A are supported. In Hardcore, use a vertical direction with gamepad A to jump straight up. Switching away from the game pauses it and clears held input.

Collect the **pickaxe, candle, lantern and jade vase**, then take the key. Every item and key is worth 50 points. You begin with five lives, gain an extra life every five rooms, and lose a life to creatures, spikes, active lasers or long falls. Death restores the room’s items and collapsing floors. The first room is already difficult; its unforgiving layout has deliberately been retained.

## Settings

Open the gear **Settings** button. **Modern is the default:** Space alone jumps, you can reverse or stop horizontally during a jump, and a brief input buffer catches presses just before landing. Spike and laser contact follows their visible shapes. **Hardcore** preserves the original committed jump direction, directional fire-button controls, fall limit and character-cell hazard rules. Both modes retain all thirty original maps and use corrected creature contact against the original opaque sprite pixels at their current logical positions.

Settings are remembered in this browser. Changing mode restarts the current room with five lives and zero score. A reduced-animation option is also available.

## Debugging and level skipping

Click **Developer** or press **F2**. No console commands are needed.

| Tool                           | Purpose                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| Room dropdown, Previous / Next | Direct access to all 30 rooms                                        |
| `[` / `]`                      | Previous / next room shortcuts                                       |
| The caverns                    | Visual room browser with original map thumbnails                     |
| Invulnerability / G            | Ignore creature and hazard deaths; recover extreme falls             |
| Tile grid & contact mask       | Inspect the tile grid, creature bounds and gold miner contact mask   |
| ¼×, ½×, 1×, 2× speed           | Slow motion and fast-forward                                         |
| Single step                    | Advance one game update, or one death-animation update               |
| Collect all treasures          | Unlock the key for transition testing                                |
| Copy state as JSON             | Copy position, jump phase, input, lives, score and CPU state summary |

Room selection starts a fresh five-life test run, **paused with the scene unobscured**. Press Enter to play. Restart room also starts a fresh test run. Assists visibly mark the session as **TEST MODE · ASSISTED**. Level skipping does not award completion points.

Deep links use one-based room numbers:

```text
http://127.0.0.1:5173/?level=30&debug
```

The optional browser test API is `window.chinaMiner`:

```js
chinaMiner.selectLevel(29); // API uses zero-based room indices
chinaMiner.pause();
chinaMiner.step();
chinaMiner.snapshot();
chinaMiner.resume();
```

## Fidelity and implementation

This is **not a physics approximation made from video**. A small NMOS 6502 interpreter executes the recovered gameplay routines, and Three.js renders their output. No C64 system ROM or full-system emulator is bundled. Character-grid collision, jump phases, ladders, conveyors, collapsing floors, slides, moving platforms, laser phases, scoring and enemy motion remain in those routines. Creature contact uses the original miner and enemy pixel masks, at the current logical position. Modern mode adds the movement and hazard overrides described above.

The simulation is scheduled against the PAL CPU clock, 985,248 Hz. Original gameplay busy waits retain their calculated instruction-cycle cost without wasting host CPU time. Browser rendering is independent of game updates. In both modes, death uses a short local reaction lasting roughly 0.75 seconds, followed by the original life deduction and room reset, instead of the original upward flight.

**Limits:** This does not simulate VIC-II raster timing, CPU contention or SID / KERNAL interrupts. Sprite collision is sampled at the original collision-check point rather than latched over a full hardware raster. The miner contact mask is the displayed original sprite frame; backgrounds do not affect contact. Therefore frame-for-frame timing equivalence to an entire C64 longplay is **not certified**. The original layouts and gameplay routines are preserved, but this is not a cycle-exact C64 emulator.

Tests cover:

- Every original room’s 800 map bytes, SHA-256 digest and five treasure markers.
- 100 Hardcore game updates against an independently generated py65 reference, including CPU registers, working RAM and cycle counts.
- 120 simulation updates in every room in both modes with changing inputs.
- Key locking, collection order, scoring, room transitions, extra lives and the final ending.
- Death resets, game over, the jump arc, visible creature contact and stale-coordinate regression.
- Modern air steering, jump buffering, held-button behavior and persistent settings.
- The entrance ladder beside spikes, approached from both accepted positions in both modes.
- Treasure collection and transitions in every room in both modes; original sprite pixels and all five composite pickup images; the short death presentation.

All 30 rooms were also loaded and single-stepped through the browser's developer controls without console errors. These checks exercise engine and rendering behavior; they are not an unassisted completion of every route.

The reference trace uses an input sequence and disables sprite collision to isolate CPU and movement behavior. It is not a complete 30-room playthrough. See [reference notes](docs/REFERENCE.md).

## Project structure

| Location                    | Contents                                                  |
| --------------------------- | --------------------------------------------------------- |
| `src/cpu.js`                | NMOS instruction interpreter                              |
| `src/engine.js`             | Original gameplay execution and sprite collision adapter  |
| `src/scene.js`              | Three.js environment, characters and animation            |
| `src/main.js`               | Input, audio, interface and developer tools               |
| `public/data/levels.json`   | Thirty original maps and room metadata                    |
| `public/data/original.json` | Selected original data and gameplay memory segments       |
| `src/vendor/`               | Three.js 0.186.0 and its license                          |
| `tests/`                    | Automated behavior checks and independent reference trace |

Three.js was copied from the requested local checkout at `C:\Projects\3js`; that checkout is not modified or needed after cloning this repository.

## Credits and sources

- **Ian Gray** — original programmer and game designer.
- **Interceptor Software** — original publisher, 1984.
- **Chris Cox** — original music; **Scott Joplin** — _Maple Leaf Rag_.
- [AL82 Retrogaming Longplays — supplied China Miner longplay](https://www.youtube.com/watch?v=Yg7RBFTAD4g).
- [Krisztián Tóth’s C64 archive](https://c64.krissz.hu/china-miner/play-online/) — original program reference.
- [Three.js](https://threejs.org/) — rendering library.
- [py65](https://github.com/mnaberez/py65) — independent reference interpreter and opcode metadata.

Original game data and routines retain their original rights. The MIT license here applies to the new remake code only; see [third-party notices](THIRD_PARTY.md).
