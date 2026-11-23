# Six Chambers (fin04)

A raycaster FPS for a parent and their son to build together and learn from.

## Ground rules
- Plain HTML, CSS and JavaScript modules. No build step, no packages, no libraries. Deploys as a static site.
- Keep the code simple and well commented so a teenager can read and change it. Tuning numbers go at the top of each file.
- Everything (textures, sprites, the gun, sounds) is generated in code. No image or sound files.
- Black and white only. In the game, red is reserved for blood (and the red hurt flash). The cutscene may also use red for drama. Don't add other colours.
- Build in small steps and test in the browser after each change. `node serve.mjs` serves it at http://localhost:5175.
- `index.html#test` starts level 1 straight away without pointer lock (`?level=2#test` for another level, 0-based). The console then has `window.game` (player, enemies, world, props, pickups, particles), `game.run(seconds)` to simulate forward, and `game.freeze = true` to hold the picture still. The preview pane may be hidden, so animation frames don't tick: use `game.run` / `game.draw(0)`.
- When testing in the preview browser, load a NEW url each time (`?v=2#test`, `?v=3#test`...): changing only the hash doesn't reload.
- `node --check` on a copy named `.mjs` is a quick syntax check without a browser.
- GitHub: `megarobogod/fin04`, connected to the Vercel project `fin04`: every push to `main` goes live at https://fin04.vercel.app (the public link; the `-megarobogod` links ask for a Vercel login). Commits are made as `megarobogod` with the GitHub no-reply email.

## Game design (from the son's prompt)
- 2D-style (raycaster) black and white FPS; red blood is the only colour.
- Armed with a revolver.
- Kill gang members in the street, in secluded alleys, and in their hideouts.

## Story (from the son's prompts)
- You're a retired hitman. Opening cutscene (inked comic panels, in the spirit of the son's reference "Red Hot Vengeance" but all our own art): sitting on the bed in a run-down flat, a call on an old flip phone. The voice says he has your wife and threatens her unless you meet his demands. You threaten him back and hang up, take a crowbar, break open a wall panel to reveal a stash (suits, wanted posters, revolver), take the revolver and walk out of the door into the street, which starts level 1.
- Keep the threat to the wife implied, not graphic.
- Cutscene mood: cold and chilling, not loud. No shocked or shouting faces, no comic sound-effect lettering, no action bursts. Stillness, darkness, empty space, his calm. Subtitles stay.

## How it's built
- **Cutscene** (`cutscene.js`): 11 quiet inked comic panels (stark black ink, cold white light, a touch of red, rough hand-drawn edges), drawn in code on a separate sharp 1280x720 canvas `#cine` over the game. `PANELS` lists each panel's draw function, duration, dialogue lines and sound cues. The inking kit at the top (`ink`, `rough`, `brush`, `hatch`, `rain`, `burst`, `letters`) wobbles edges with a seeded random so panels don't jitter. Slow push-in per panel, black blink between panels, paper grain and a thick black border. Click/Enter = next panel, Space/Esc = skip. Test with `game.playCutscene(); game.freeze = true; game.cutscene.show(i); game.cutscene.t = 1; game.cutscene.draw()`. Style is inspired by hand-inked noir comics; keep the art original.
- **Renderer** (`render.js`): 480x270 buffer, one ray per column (DDA), textured floors/ceilings cast row by row, billboard sprites with a z-buffer, then rain, film grain, vignette and the red hurt edge. Pixels with alpha 254 "glow" (ignore light and fog).
- **Light** (`world.js` `buildLight`): baked at 4x4 per square from lamps, bulbs and lit windows, blocked by walls. `world.flash` adds light everywhere (muzzle flash, lightning).
- **Blood**: hits spray particles that leave drops on the floor, splatter the wall behind the target (`splatWall`), and corpses grow a pool (`splatFloor`). Each square gets its own copy of its texture the first time it's painted.
- **Revolver** (`player.js`): 6 rounds, reloaded one at a time; firing cancels a reload. Hitscan with height: the bullet starts at eye height 0.5 and rises by `tan(pitch)` per square, so it can hit legs, body or head (`headLine`), go over a hat, or hit the floor/ceiling first.
- **Looking up/down**: y-shearing. `player.pitch` moves the horizon by `H * tan(pitch)`; floors, ceilings, walls and sprites all hang off the horizon.
- **Aiming down the sights** (hold right mouse, `game.adsHeld`): `player.ads` eases 0..1; the renderer zooms by `player.zoom` (focal length `F = H * zoom`, narrower `plane`), the hip gun drops away and `drawSights` raises the two-handed sight view with the front sight tip on the screen centre. Spread x0.25, walk x0.5, no running, slower mouse; reloading lowers the sights. Tuning is under `ads*` in `PLAYER`.
- **Gang AI** (`enemies.js`): idle → hunt → aim → fire. They see in a cone while idle, wake each other and wake to gunshots, side-step between shots, and follow a BFS path map (`updateFlow` in `main.js`) when they can't see you. The `aim` pause is the player's window to shoot first.
- **Levels** (`levels.js`): text maps; the key is at the top of the file. Kill every gang member to clear a level.
