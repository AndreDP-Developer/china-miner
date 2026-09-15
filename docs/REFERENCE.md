# Reference and verification notes

The user supplied [AL82’s 50 FPS China Miner longplay](https://www.youtube.com/watch?v=Yg7RBFTAD4g). The original program reference was recovered from the game loader on [c64.krissz.hu](https://c64.krissz.hu/china-miner/play-online/). The loader, emulator, system ROMs, crack intros, instruction viewer, trainer UI and music driver are **not** included in this application.

The extracted game provides a stronger layout reference than screenshots. Thirty records of 120 bytes begin at `$1000`. Each record includes ten-entry sprite-coordinate and motion tables, moving-floor parameters, seven enemy colours, a multicolour mask, the map pointer, a laser timing value, an ending-message character and a room-title pointer. Each room map is 40 × 20 characters (800 bytes).

Map addresses are `$4000 + 800 * room` for rooms 1–20, and `$A000 + 800 * (room - 20)` for rooms 21–30, using zero-based room indices. The title table starts at `$C000`, with 40 characters per room. The final title in the recovered data is **The Hall of the Mountain King**. Titles in the interface use mixed case; their underlying original bytes remain intact.

## Gameplay memory

| Address          | Meaning                                                      |
| ---------------- | ------------------------------------------------------------ |
| `$0352 + sprite` | X coordinate in two-pixel units, including VIC border offset |
| `$035C + sprite` | Y coordinate in pixels, including VIC border offset          |
| `$0384 + sprite` | Enemy motion direction                                       |
| `$03D3`          | Player direction bitfield                                    |
| `$03D4`          | Jump phase                                                   |
| `$03D6`          | Fall counter                                                 |
| `$03DF`          | Lives                                                        |
| `$03E1`          | Zero-based room index                                        |
| `$03E2`          | Number of collected treasures                                |
| `$03E5–$03E6`    | Score, little-endian                                         |
| `$04A0–$07BF`    | Active 40 × 20 map                                           |
| `$07F8–$07FF`    | Sprite frame pointers                                        |

The game loop begins at `$82C0`; room loading starts at `$8248`; death begins at `$8742`; the ending at `$876E`. The small score-display / life-display hooks retained from the reference do not enable trainer options. The game starts directly in room initialization with five lives. The rendering model uses an orthographic camera and converts eight original pixels to one scene unit.

## Independent trace

`tests/reference-trace.json` was generated using py65, executing the original routine instructions, including their actual busy-wait loops. It covers 100 Hardcore updates: eight left inputs followed by 92 neutral inputs, with sprite collision disabled in both implementations. All registers, the first 2 KiB of RAM and instruction-cycle totals match. The reference generator corrects py65’s DEC-absolute cycle metadata from 3 to the NMOS 6502’s 6 cycles.

The production interpreter replaces only the original busy wait with its instruction-cycle cost: `3325 * iterations + 17`. It retains the final registers, relevant memory and flags. In Hardcore, other gameplay instructions execute normally, with corrected creature contact supplied by the host. Modern mode intercepts jump setup at `$82D8`, airborne direction at `$82F9`, and the hazard flag at `$8601`.

To regenerate the independent fixture, install `py65` in a Python virtual environment and run `python scripts/reference-trace.py`. This is optional; normal builds and tests need only Node.js.

`scripts/extract-reference.py` can regenerate the data files from a user-supplied, unpacked 64 KiB memory image. Its default input is `research/game2.bin`. Raw downloads and intermediate analysis are excluded from Git. No external emulator code is evaluated in the application.

## Remaining limits

The original maps and routines are checked; full-system, raster-latched sprite collisions and sound-interrupt timing are not reproduced. No automated solver or full unassisted thirty-room playthrough has been used to certify longplay equivalence. Creature collision uses the original opaque miner and enemy sprite pixels. The art decoder in `src/original-art.js` renders those same sprite frames. The current logical player coordinates avoid the stale VIC position at the original collision-check point. The developer overlay shows the gold player contact mask and creature bounds; transparent enemy pixels do not collide.
