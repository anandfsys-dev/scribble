# Scribble — CLAUDE.md

Hand-drawn whiteboard app (Excalidraw-inspired). Vanilla JS + Vite + Tailwind CSS 4 + RoughJS.

## Tech Stack
- **Build**: Vite (`npm run dev` / `npm run build`)
- **Styling**: Tailwind CSS 4 — uses `@theme` directive, NOT `tailwind.config.js`
- **Canvas**: RoughJS for hand-drawn rendering
- **Font**: Caveat (Google Fonts) — used for all text elements on canvas
- **Deploy**: GitHub Pages at `/scribble/` base path (see `vite.config.js`)

## File Map
```
index.html                        — UI chrome: toolbar, properties panel, action buttons
src/main.js                       — Entry: canvas init, keyboard shortcuts, UI setup functions
src/CanvasState.js                — Core state: elements[], selection, pan/zoom, render loop, localStorage
src/Renderer.js                   — Drawing: RoughJS wrappers for each element type + arrowheads + bounding boxes
src/HistoryManager.js             — Undo/redo stack: save(), undo(), redo() returning element snapshots
src/ThemeManager.js               — PALETTES constant, updatePalette(), setupTheme() for dark/light mode
src/Exporter.js                   — JSON export/import
src/utils/GeometryUtils.js        — Pure math: calculatePathLength(), simplifyPath() (Ramer-Douglas-Peucker)
src/utils/HitTestUtils.js         — Pure geometry: getElementAt(), hitTest(), getElementBounds(), isPointDeepInsideElement()
src/utils/ConnectionPointUtils.js — Pure geometry: getConnectionPoints(), getClosestConnectionPoint()
src/tools/ToolManager.js          — Dispatches pointer/wheel events to active tool; manages pan/zoom gestures
src/tools/SelectTool.js           — Selection, drag-move, resize (8 handles), Ctrl+drag duplicate
src/tools/DrawTool.js             — Rectangle, Ellipse, Line, Arrow tools
src/tools/FreehandTool.js         — Pen/freehand drawing, auto-shape detection on hold
src/tools/TextTool.js             — Text creation, editing, wrapping via resize handles
src/style.css                     — Tailwind imports + canvas/panel positioning overrides
```

## Architecture Patterns
- **Rendering**: dirty-flag + `requestAnimationFrame` loop in `CanvasState.render()`
- **Tool Strategy**: each tool implements `onPointerDown / onPointerMove / onPointerUp`
- **Coordinate space**: always use `canvasState.screenToCanvas(clientX, clientY)` — never raw event coords
- **Element IDs**: `Date.now().toString()` — unique enough for this use case
- **Persistence**: `localStorage` key `scribble-elements`

## Element Schema
```js
{
  id, type,           // 'rectangle'|'ellipse'|'line'|'arrow'|'freehand'|'text'
  x, y,               // top-left (or start point for lines/arrows)
  width, height,      // used by rect/ellipse/text
  x2, y2,             // end point for line/arrow
  points,             // [[x,y], ...] for freehand
  text, maxWidth,     // text elements
  startBinding, endBinding,  // arrows: { elementId, key: 'top'|'bottom'|'left'|'right' }
  style: { strokeColor, strokeWidth, fillColor, textColor, fontSize }
}
```

## Theme / Palette System
- Dark mode: `.dark` class on `<html>`
- `PALETTES` in `src/ThemeManager.js` defines light/dark hex arrays (5 stroke + 5 fill)
- `updatePalette()` migrates existing element colors when theme toggles — uses index-matching

## Key Gotchas
- **Screen → Canvas coords**: always `canvasState.screenToCanvas()` for zoom/pan correctness
- **Text hit area**: minimum 20px even when width=0, so empty text is still clickable
- **RoughJS re-generates every frame** — no caching; acceptable perf for typical boards
- **Arrow control points**: `cx2` drives the arrowhead direction — must be close to endpoint for straight heads
- **Tailwind 4**: config is inline in CSS via `@theme {}`, not a JS config file

## Feature Notes
> **Rule:** When you add or change a feature, append one entry here — but only if there's a non-obvious decision, gotcha, or constraint that isn't clear from reading the code. Skip it if the code is self-explanatory. Each entry: **bold title**, one sentence on what changed, one sentence on *why* it was done that way or what to watch out for.

- **Arrow endHorizontal logic** (`Renderer.js`): For arrows with `startBinding` but no `endBinding`, `endHorizontal` must be derived from the dominant axis (dx vs dy), not defaulted to `!startHorizontal` — the latter causes a 90° arrowhead mismatch on straight arrows exiting a shape.
- **Text element y-coordinate** (`HitTestUtils.js`, `Renderer.js`): `element.y` is the vertical **center**, not the top edge. Every hit-test and render for text must subtract `height/2` to get the top.
- **Utils are the source of truth** (`src/utils/`): `CanvasState` methods like `getElementAt`, `hitTest`, `getElementBounds`, `getConnectionPoints` are thin wrappers — fix bugs in the `utils/` files, not in `CanvasState.js`.

## Dev Commands
```bash
npm run dev     # local dev server (Vite HMR)
npm run build   # production build → dist/
npm run preview # preview built dist/
```
