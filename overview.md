# Scribble - Technical Overview & Handoff

Scribble is a lightweight, hand-drawn style whiteboard application inspired by Excalidraw, built with a focus on simplicity, organic aesthetics, and intelligent interaction models.

## 🚀 Tech Stack
- **Build Tool**: Vite (configured for GitHub Pages deployment)
- **Styling**: Tailwind CSS 4 (using the `@theme` and `@variant dark` configuration)
- **Graphics**: [RoughJS](https://roughjs.com/) for canvas-based hand-drawn rendering
- **Architecture**: Vanilla JavaScript with ES Modules

---

## 🏗️ Core Architecture

### 1. `CanvasState.js` (The Heart)
- **State Management**: Maintains the array of `elements`, the current `selection`, and `history` (Undo/Redo).
- **Rendering Loop**: Uses `requestAnimationFrame` to handle dirty-flag rendering, ensuring 60FPS performance.
- **Coordinate Space**: Manages the transformation matrix for **Zooming** (scale) and **Panning** (offset).
- **Hit Testing**: Geometric calculations to determine if a point or marquee box intersects with shapes.
- **Persistence**: Automatically syncs the canvas state to `localStorage` under the key `scribble-elements`.

### 2. `Renderer.js` (The Artist)
- **RoughJS Integration**: Wraps RoughJS to draw rectangles, ellipses, lines, and curves.
- **Dynamic Styling**: Elements store their own `strokeColor`, `strokeWidth`, and `fillColor`.
- **Arrow Routing**: Implements cubic bezier curves for arrows. When elements are connected via anchors, the renderer calculates the control points based on the anchor keys (`top`, `bottom`, `left`, `right`).

### 3. `ToolManager.js` & Tool Strategy
- Uses a strategy pattern where each tool (Select, Rectangle, Ellipse, Line, Arrow, Pen, Text) is a class with `onPointerDown`, `onPointerMove`, and `onPointerUp` methods.
- **Select Tool**: Handles single selection, multi-selection (marquee), and dragging/resizing.
- **Text Tool**: Manages the creation and editing of text elements.

---

## ✨ Key Features & Implementation Details

### 💡 Intelligent Connections (Arrows)
- **Anchors**: Shapes have 4 connection points (`top`, `bottom`, `left`, `right`).
- **Bindings**: Arrows store `startBinding` and `endBinding` which reference the `elementId` and the specific `key` (anchor).
- **Routing**: The `Renderer` uses the anchor position to determine the exit/entry direction of the arrow's curve.

### 🌓 Theme-Aware Engine
- **Dark Mode**: Implemented via a `.dark` selector on the `html` element.
- **Dynamic Palettes**: A central `PALETTES` object in `main.js` defines corresponding colors for Light and Dark modes.
- **Element Migration**: When the theme toggles, the `updatePalette` function iterates through all canvas elements and updates their hex codes to the equivalent color in the new theme's palette to ensure visibility.

### ⌨️ Interaction Model
- **Zooming**: `Ctrl + Mouse Scroll` (pinned to the cursor's canvas coordinates).
- **Duplication**: `Ctrl + Drag` on a selection instantly clones elements.
- **Shortcuts**: Number keys `1-7` map to tool selection. Visual shortcut labels are displayed in the toolbar.
- **Text Lifecycle**: Text elements default to 0-width/0-height. They expand as you type. Empty text elements are automatically culled on blur.

### 📂 Data Handling
- **Exporter**: Handles JSON serialization.
- **Import**: Supports loading `.json` files, which clears the current canvas and populates it with the imported array.

---

## 🛠️ Deployment & Standards
- **CI/CD**: `.github/workflows/deploy.yml` builds the Vite project and deploys the `dist` folder to GitHub Pages using the `actions/deploy-pages` mechanism.
- **Base Path**: Configured as `/scribble/` in `vite.config.js` to match the GitHub repository name.
- **Standards**: Uses relative paths (`./`) in `index.html` for maximum compatibility across different hosting environments.

## ⚠️ Technical "Gotchas" for the next Agent
- **Screen-to-Canvas Conversion**: Always use `canvasState.screenToCanvas(clientX, clientY)` to get coordinates that account for current zoom and pan.
- **RoughJS Cache**: The renderer recreates the RoughJS generator on every frame; for extremely complex boards, caching generators might be a future optimization.
- **Text Element Selection**: Since text can have 0-width initially, hit-testing for text uses a minimum 20px hit area to ensure user can click into it to edit.
