import { Renderer } from './Renderer.js';
import { getElementBounds } from './utils/HitTestUtils.js';

export class Exporter {
  static exportPng(elements) {
    if (!elements.length) return;

    const PADDING = 20;
    const SCALE = 2;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      const b = getElementBounds(el);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    });

    const offscreen = document.createElement('canvas');
    offscreen.width  = (maxX - minX + PADDING * 2) * SCALE;
    offscreen.height = (maxY - minY + PADDING * 2) * SCALE;

    const ctx = offscreen.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.translate(-(minX - PADDING), -(minY - PADDING));

    const renderer = new Renderer(ctx);
    elements.forEach(el => { if (el.type === 'frame') renderer.drawElement(el, false); });
    elements.forEach(el => { if (el.type !== 'frame') renderer.drawElement(el, false); });

    ctx.restore();

    offscreen.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scribble-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  static exportJson(elements) {
    const data = JSON.stringify(elements, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scribble-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async importJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const elements = JSON.parse(e.target.result);
          resolve(elements);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}
