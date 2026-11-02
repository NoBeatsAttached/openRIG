# OpenRig

Free, open-source stage design and previs that runs in a web browser. Build festival and tour stages with real gear (decks, truss, ground support, hoists, moving lights, LED walls, line arrays), run looks through the rig, check what the crowd sees, and get the paperwork: power, rigging loads, DMX patch and gear list.

No install, no account, no license fee.

**Use it now:** https://nobeatsattached.github.io/openRIG/

## What it does

- **3D stage building.** 20 pieces of gear with real weights, power draw and DMX footprints. Lights clamp onto truss and hang inverted automatically. Snap to 3″, 6″ or 1′.
- **Previs.** Volumetric beams that stop at the floor, haze, bloom, LED walls with live content, a crowd that moves, and six looks (sweep, fan, ballyhoo, chase, strobe).
- **Views.** Perspective, plan (1 ft grid), front elevation, and crowd POV at eye height.
- **Paperwork.**
  - Power by department in amps at 120V and per leg at 208V 3-phase, with a suggested service size
  - Rigging load per truss against an estimated rating, and hoist capacity against flown weight
  - Automatic DMX patch, exportable as CSV
  - Gear list, plus print or save as PDF
- **Files.** Designs autosave in the browser and export as `.openrig.json` to share.
- **Runs smooth.** Static gear is merged into a handful of draw calls, and Auto quality lowers the render resolution when the frame rate drops. Pick Low, Medium or High yourself from the toolbar.

> Rigging numbers are planning estimates, not engineering. Use the manufacturer's load tables and have a qualified rigger sign off before anything flies.

## Host your own copy

It's plain static files with no build step, so any static host works. On GitHub:

1. Fork this repo.
2. In your fork go to **Settings → Pages**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, then click **Save**.
3. After about a minute it's live at `https://YOUR-USERNAME.github.io/openRIG/`.

## Run it on your own computer

Browsers block module scripts opened straight from a file, so start a tiny local server in this folder:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## How to use it

1. **Add gear.** Drag anything from the Library onto the stage. A see-through preview shows where it will land. Lights snap onto truss and hang upside down on their own. (On a phone: tap the gear, then tap the stage.)
2. **Move it.** Click something to select it, then drag it. Pull the arrow up or down to change its height. The bar that pops up has Rotate, Add lights (on truss), Duplicate, Zoom and Delete. Lights and hoists on a truss move, rotate, copy and delete with it.
3. **Light a truss fast.** Select a truss, hit **Add lights**, pick the fixture and how many. They get spaced evenly along it.
4. **Check the numbers.** The Paperwork tab works out power, rigging load, the DMX patch and the gear list as you build. The Scene tab lists everything; click a row to fly to it.

| Key | Action |
| --- | --- |
| Drag | Move the selected thing |
| R / Shift+R | Rotate 90° / 15° (also works while placing) |
| D | Duplicate |
| Delete | Delete |
| Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z | Undo, redo |
| F or double-click | Zoom to the selection |
| 1 2 3 4 | 3D, plan, front, crowd POV |
| Space | Play or pause the show |
| Shift + click | Keep placing the same item |

Camera: drag to orbit, right-drag (or two fingers on a trackpad) to pan, scroll to zoom.

## Project layout

```
index.html          app shell
css/app.css         all styling
src/main.js         boot, input, render loop
src/engine.js       renderer, cameras, bloom/outline, sky, grid, crowd
src/models.js       3D models and materials for every piece of gear
src/catalog.js      gear specs: weight, watts, DMX channels, beam angles
src/objects.js      placing, selecting, moving things in the scene
src/show.js         fixture animation, beams, LED wall content
src/paperwork.js    power, rigging, DMX patch, gear list
src/ui.js           library, inspector, show and paperwork panels
src/templates.js    starter stages
src/thumbs.js       renders the library thumbnails
vendor/three/       three.js r169 (MIT), bundled so the app works offline
```

### Adding gear

Add an entry to `CAT` in `src/catalog.js`. Give it a name, category, weight (`lb`), watts (`W`), DMX channels (`dmx`), default `props`, an inspector `schema`, and a `build` function from `src/models.js` (or write a new one). It shows up in the library with its own rendered thumbnail.

## License

MIT, see `LICENSE`. three.js is MIT, see `vendor/three/LICENSE`.
