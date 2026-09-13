# Third-party notices

## China Miner (1984)

Original programming and game design: **Ian Gray**. Original publisher: **Interceptor Software**, 1984. Original music: **Chris Cox**, using Scott Joplin’s _Maple Leaf Rag_.

Selected original game routines, sprite masks, character data, room designs, titles and metadata appear in `public/data/original.json` and `public/data/levels.json`. They retain their original copyright and are not covered by this repository’s MIT license. The reference fixtures contain derived game working memory and have the same exclusion. This is an unofficial fan remake, not an official Interceptor release.

Reference: https://c64.krissz.hu/china-miner/play-online/

## Three.js

Three.js version 0.186.0, including RoundedBoxGeometry. MIT license, copyright the Three.js authors. See `src/vendor/THREE-LICENSE.txt`. Copied from the user-specified local checkout; only the geometry helper’s import path was changed.

## py65

Opcode names, addressing modes and cycle metadata in `src/opcodes.js` were generated from py65. The reference trace was generated with py65. BSD three-clause license; see `licenses/py65-LICENSE.txt`. py65 itself is not a runtime dependency. The DEC absolute cycle metadata typo is corrected to six cycles in this application and reference generator.

## Fonts

DM Sans and Manrope are locally bundled Google Fonts, under the SIL Open Font License. See `public/fonts/dmsans-OFL.txt` and `public/fonts/manrope-OFL.txt`.

## New artwork and audio

The cavern backgrounds, temple, miner model, collectible models, UI and ambient sound/effects are new for this remake. Creature silhouettes use the original game’s sprite masks and are rendered as bevelled voxels. No YouTube footage, third-party remake artwork or original soundtrack recording is bundled.
