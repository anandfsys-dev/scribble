# Scribble Board 🎨

Scribble is a lightweight, hand-drawn style whiteboard application built with modern web technologies. It provides an organic, "scribbled" aesthetic for diagrams, wireframes, and quick sketches, while maintaining the precision and features of a professional drawing tool.

## ✨ Features

- **Hand-drawn Aesthetic**: Powered by [RoughJS](https://roughjs.com/) for that organic, sketch-like feel.
- **Smart Tools**:
  - **Selection**: Click and drag marquee selection, Ctrl + Drag to duplicate.
  - **Shapes**: Rectangles, Ellipses, Lines, and Arrows.
  - **Freehand Drawing**: Smooth pen tool for sketching.
  - **Text Tool**: Double-click any shape to add centered text or double-click the canvas to create floating text.
- **Advanced Connections**: Arrows snap to shapes and maintain connections when shapes are moved.
- **Productivity Features**:
  - **Keyboard Shortcuts**: Number keys (1-7) to switch tools, Ctrl+C/V/X for clipboard, and Delete/Backspace for removal.
  - **Infinite Canvas**: Pan (Space/Middle Click + Drag) and Zoom (Ctrl + Scroll).
  - **Undo/Redo**: Full history support for all actions.
- **Data Portability**: Export your boards as JSON or Markdown. Local storage ensures your work is saved automatically.

## 🚀 Tech Stack

- **Core**: HTML5, Vanilla JavaScript (ES Modules)
- **Styling**: Tailwind CSS
- **Graphics**: RoughJS for hand-drawn rendering
- **Build Tool**: Vite

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/scribble.git
   ```
2. Navigate to the project directory:
   ```bash
   cd scribble
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Development
Run the development server:
```bash
npm run dev
```

### Building for Production
Create a production build in the `dist/` directory:
```bash
npm run build
```

## 🌐 Hosting

This project is ready for **GitHub Pages**. A GitHub Actions workflow is included in `.github/workflows/deploy.yml` which automatically deploys the site whenever you push to the `main` branch.

## ⌨️ Shortcuts

| Key | Action |
| --- | --- |
| **1** | Select Tool |
| **2** | Rectangle Tool |
| **3** | Ellipse Tool |
| **4** | Line Tool |
| **5** | Arrow Tool |
| **6** | Pen (Freehand) Tool |
| **7** | Text Tool |
| **Ctrl + C / V / X** | Copy / Paste / Cut |
| **Ctrl + Drag** | Duplicate Selection |
| **Ctrl + Scroll** | Zoom In/Out |
| **Space + Drag** | Pan Canvas |
| **Del / Backspace** | Delete Selection |
| **Ctrl + Z / Shift + Z** | Undo / Redo |

## 📄 License
MIT
