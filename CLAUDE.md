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
src/PresentationEngine.js         — Viewport math, eased animation, keyboard/resize listeners for presentation mode
src/Exporter.js                   — JSON export/import
src/utils/GeometryUtils.js        — Pure math: calculatePathLength(), simplifyPath() (Ramer-Douglas-Peucker)
src/utils/HitTestUtils.js         — Pure geometry: getElementAt(), hitTest(), getElementBounds(), isPointDeepInsideElement()
src/utils/ConnectionPointUtils.js — Pure geometry: getConnectionPoints(), getClosestConnectionPoint()
src/tools/ToolManager.js          — Dispatches pointer/wheel events to active tool; manages pan/zoom gestures
src/tools/SelectTool.js           — Selection, drag-move, resize (8 handles), Ctrl+drag duplicate
src/tools/DrawTool.js             — Rectangle, Ellipse, Line, Arrow tools
src/tools/FreehandTool.js         — Pen/freehand drawing, auto-shape detection on hold
src/tools/TextTool.js             — Text creation, editing, wrapping via resize handles
src/tools/FrameTool.js            — Frame creation (drag-to-draw labeled bounding boxes for presentation)
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
  id, type,           // 'rectangle'|'ellipse'|'line'|'arrow'|'freehand'|'text'|'frame'
  x, y,               // top-left (or start point for lines/arrows)
  width, height,      // used by rect/ellipse/text/frame (can be negative if drawn right-to-left)
  x2, y2,             // end point for line/arrow
  points,             // [[x,y], ...] for freehand
  text, maxWidth,     // text elements
  textAlign,          // text elements only: 'center' for shape captions, omit/undefined for left-aligned
  startBinding, endBinding,  // arrows: { elementId, key: 'top'|'bottom'|'left'|'right' }
  name, frameOrder,   // frame elements: display label and sort index for presentation order
  style: {
    strokeColor, strokeWidth, fillColor,
    textColor, fontSize,               // fontSize is a number from [12,14,16,18,20,24,28,32,36,48,64,96]
    fontBold, fontItalic,              // boolean — canvas uses 'bold'/'italic' in ctx.font string
    fontUnderline, fontStrikethrough   // boolean — drawn manually as lines (canvas has no text-decoration)
  }
  // Note: frame elements have NO style property — use fixed visual appearance
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
- **Frame elements have no `style` property** (`ThemeManager.js`, `CanvasState.js`): Unlike every other element type, frames use a fixed visual style — any code that reads `el.style` (theme migration, `applyStyleToSelection`) must guard with `if (!el.style) return`.
- **Frame render order** (`CanvasState.render()`): Frames are drawn in a separate first pass before all other elements so they always appear as a background layer — the single `elements.forEach` loop was split into two to achieve this without changing element array order.
- **Frame width/height can be negative** (`Renderer.js`, `CanvasState.js`, `PresentationEngine.js`): A frame drawn right-to-left or bottom-to-top has negative `width`/`height`; all rendering, viewport math, and the dimming overlay must normalize with `Math.abs()` and compute the true top-left as `x + min(0, width)`.
- **frameOrder uses max+1, not count** (`FrameTool.js`): New frames get `frameOrder = maxExistingOrder + 1` rather than `frameCount`, because using count would produce collisions after any frame is deleted.
- **Presentation blocks undo/redo and canvas events** (`CanvasState.js`, `ToolManager.js`): While `isPresenting` is true, `undo()`/`redo()` return early and `ToolManager` ignores all pointer events — this prevents accidental edits while navigating slides.
- **`_onElementsChanged` callback** (`CanvasState.js`): Set `state._onElementsChanged = fn` to get notified after every `saveToLocalStorage()` call — used by the Frames panel to re-render its list without polling.
- **`state.getFrames()`** (`CanvasState.js`): Single source of truth for the sorted frame list — use this everywhere instead of inline `filter + sort` to stay consistent.
- **Font size is a stepped set, not a free value** (`main.js`, `FONT_SIZES`): The allowed font sizes are `[12,14,16,18,20,24,28,32,36,48,64,96]`; Ctrl+Shift+Period/Comma steps through this array — use `e.code` (not `e.key`) for these shortcuts because `e.key` for `>` is unreliable when Ctrl is held on Windows.
- **Underline/strikethrough are drawn manually** (`Renderer.js`): Canvas 2D has no `textDecoration` API, so underline and strikethrough are painted as `ctx.stroke()` lines after each text row; the x-origin must account for `textAlign === 'center'` (use `x - lineWidth/2`) vs left-aligned (use `x`).
- **Arrow/line hit-testing uses path distance** (`HitTestUtils.js`): Lines use `distToSegment`; arrows sample 24 points along the cubic bezier (control points mirrored from `Renderer.js`) and return min distance — bounding-box testing caused shapes beneath curved arrows to become unselectable.
- **Alignment guides live on `canvasState.alignGuides`** (`SelectTool.js`, `CanvasState.js`): During drag, `SelectTool.computeAlignSnap()` checks proposed group bounds against all non-selected elements (threshold 8px), snaps dx/dy, and stores `{ type: 'v'|'h', pos }` guide entries drawn in the render loop; guides are cleared on pointer-up.
- **Hyperlinks stored as `element.urlSpans`** (`Renderer.js`, `main.js`): Text elements gain an optional `urlSpans: [{start, end, url}]` array (character ranges). The renderer splits each visual line into plain/linked segments via `_getLineSegments()` and renders linked segments in blue with forced underline — `style.textColor` is not touched. Ctrl+K during text editing opens the link dialog for the textarea's current selection. A link tooltip (`#link-tooltip`) floats below the selected element, updated every rAF tick via `canvasState._onAfterRender`. Legacy `element.url` is migrated to `urlSpans` both on localStorage load and inline during rendering.
- **TextTool `_suppressBlurCommit`** (`TextTool.js`): When Ctrl+K opens the link dialog while a textarea is active, `_suppressBlurCommit = true` prevents the blur handler from committing and removing the textarea. It is reset to `false` when the dialog closes (confirm or cancel), after which the textarea is re-focused.
- **Centered text captions** (`TextTool.js`, `HitTestUtils.js`, `SelectTool.js`): When text is created by double-clicking a rectangle/ellipse, `element.textAlign = 'center'` is stored and `element.x` becomes the horizontal center (not left edge). Every consumer — hit-testing, bounding box, resize handles, textarea positioning — must branch on `element.textAlign === 'center'`.
- **Panel interaction can clear selection** (`main.js`): Clicking a native `<select>` or a button in the properties panel fires `window.pointerup`, which may race with the `change`/`click` handler. The fix: save `state.selection` on `mousedown` of each panel control and restore it before applying the style change.
- **Text style keyboard shortcuts use `e.code`** (`main.js`): Ctrl+B/I use `e.code === 'KeyB'`/`'KeyI'`; Ctrl+Shift+S uses `e.code === 'KeyS'` with `e.shiftKey` — avoids locale/OS differences in `e.key` values under modifier keys.
- **PNG export uses a fresh `Renderer` per call** (`Exporter.js`): `exportPng` instantiates `new Renderer(offCtx)` on an offscreen canvas because `Renderer`'s constructor calls `rough.canvas(ctx.canvas)` — RoughJS binds to the canvas element, not the context, so the live renderer cannot be reused. Text element bounds from `getElementBounds` are only accurate if the live canvas has rendered at least once, since `drawElement` writes back `element.width`/`height` for text during rendering.

## Dev Commands
```bash
npm run dev     # local dev server (Vite HMR)
npm run build   # production build → dist/
npm run preview # preview built dist/
```
