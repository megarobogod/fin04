# Six Chambers (fin04)

A black-and-white, old-school 2D-style FPS (a raycaster, like the early-90s
shooters). The only colour is red, and red is blood.

It opens with a cold, quiet cutscene drawn as inked comic panels: you're a retired hitman in a run-down flat, and the Vipers
call to say they've got your wife. You dig your old revolver out of a stash behind
the wall panelling and walk out into the rain. (Click for the next shot, Space skips it.)

You have a revolver: six rounds, reloaded one at a time. Clear the Vipers gang
out of three levels: **The Dellwood** (an apartment building, three floors, with the
Vipers lieutenant at the top), **The Docks** at Pier Nine, and **The Hideout** inside the
Pier Nine warehouse, where the boss is waiting.

## Controls
- **WASD**: move. **Mouse**: look around, including up and down. **Click** or **Space**: shoot.
- **Hold right-click**: aim down the revolver's sights. It zooms in and your shots go dead straight, but you walk slower and can't run.
  Aim for the head: headshots do over twice the damage.
- **R**: reload (one round at a time; shoot to stop early).
- **1 / 2** or the **mouse wheel**: switch between the revolver and the shotgun (once you've taken it).
- **Shift**: run (faster, but your aim wobbles more).
- **Arrow keys** / **Q E**: turn without the mouse.

Play it online: https://fin04.vercel.app

## Running it locally
```
node serve.mjs
```
Then open http://localhost:5175. (Browsers won't load the game's modules
straight from a file, so it needs this tiny server.)

## Where things are
- `src/levels.js`: the maps, drawn as text. Easiest place to start changing things.
- `src/enemies.js`: the gang. Health, speed, accuracy at the top.
- `src/player.js`: you and the revolver. Damage, reload speed at the top.
- `src/render.js`: the raycaster that draws the 3D view.
- `src/textures.js`: every picture, drawn in code.
- `src/world.js`: walls, light, line of sight, blood on walls and floors.
- `src/audio.js`: every sound, made in code.
- `src/cutscene.js`: the opening scene. Each panel's words, sounds and timing are in `PANELS` at the top; the drawings are the functions below it.
- `src/main.js`: ties it all together.
