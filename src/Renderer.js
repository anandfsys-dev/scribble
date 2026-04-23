import rough from 'roughjs';

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.rc = rough.canvas(ctx.canvas);
  }

  drawElement(element, isSelected = false) {
    const { type, x, y, style } = element;

    this.ctx.save();

    // Frame has no style object — render it separately before roughOptions is constructed
    if (type === 'frame') {
      const isDark = document.documentElement.classList.contains('dark');
      const frameColor = isDark ? '#7eb5cc' : '#5b8fa8';
      const normX = element.width >= 0 ? x : x + element.width;
      const normY = element.height >= 0 ? y : y + element.height;
      const normW = Math.abs(element.width);
      const normH = Math.abs(element.height);

      this.rc.rectangle(normX, normY, normW, normH, {
        stroke: frameColor,
        strokeWidth: 1.5,
        fill: undefined,
        roughness: 1,
        strokeLineDash: [8, 4],
      });

      this.ctx.font = `700 13px 'Caveat', cursive`;
      this.ctx.fillStyle = frameColor;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillText(element.name || 'Frame', normX + 4, normY - 4);

      if (isSelected) this.drawResizeHandles(normX, normY, normW, normH);

      this.ctx.restore();
      return;
    }

    // Convert our internal style to roughjs options (all non-frame elements)
    // seed makes RoughJS deterministic per element — without it every render frame
    // produces slightly different random paths, causing visible shivering.
    const idNum = parseInt(element.id, 10);
    const roughOptions = {
      stroke: style.strokeColor,
      strokeWidth: style.strokeWidth,
      fill: style.fillColor === 'transparent' ? undefined : style.fillColor,
      fillStyle: 'hachure',
      roughness: type === 'freehand' ? 0 : 1.5,
      bowing: type === 'freehand' ? 0 : 1,
      seed: (isNaN(idNum) ? 1 : idNum % 65521) || 1
    };

    switch (type) {
      case 'rectangle':
        this.rc.rectangle(x, y, element.width, element.height, roughOptions);

        if (isSelected) {
          this.drawBoundingBox(x, y, element.width, element.height);
          this.drawResizeHandles(x, y, element.width, element.height);
        }
        break;

      case 'ellipse':
        // roughjs ellipse takes center x, center y, width, height
        this.rc.ellipse(x + element.width / 2, y + element.height / 2, element.width, element.height, roughOptions);
        if (isSelected) {
          this.drawBoundingBox(x, y, element.width, element.height);
          this.drawResizeHandles(x, y, element.width, element.height);
        }
        break;

      case 'line':
        this.rc.line(x, y, element.x2, element.y2, roughOptions);
        if (isSelected) this.drawEndpointHandles(x, y, element.x2, element.y2);
        break;
        
      case 'arrow': {
        // Orthogonal curve routing
        let cx1, cy1, cx2, cy2;

        let startHorizontal = true;
        if (element.startBinding && (element.startBinding.key === 'top' || element.startBinding.key === 'bottom')) {
          startHorizontal = false;
        }

        let endHorizontal = !startHorizontal;
        if (element.endBinding) {
          if (element.endBinding.key === 'top' || element.endBinding.key === 'bottom') {
            endHorizontal = false;
          } else if (element.endBinding.key === 'left' || element.endBinding.key === 'right') {
            endHorizontal = true;
          }
        } else if (!element.startBinding) {
          // No bindings: snap both ends to dominant direction for a consistent arrowhead
          const dx = Math.abs(element.x2 - x);
          const dy = Math.abs(element.y2 - y);
          startHorizontal = dx >= dy;
          endHorizontal = startHorizontal;
        } else {
          // startBinding set, no endBinding: free end uses dominant direction
          const dx = Math.abs(element.x2 - x);
          const dy = Math.abs(element.y2 - y);
          endHorizontal = dx >= dy;
        }

        if (startHorizontal) {
          cx1 = (x + element.x2) / 2;
          cy1 = y;
        } else {
          cx1 = x;
          cy1 = (y + element.y2) / 2;
        }

        if (endHorizontal) {
          cx2 = (x + element.x2) / 2;
          cy2 = element.y2;
        } else {
          cx2 = element.x2;
          cy2 = (y + element.y2) / 2;
        }

        const pathData = `M ${x} ${y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${element.x2} ${element.y2}`;
        this.rc.path(pathData, roughOptions);

        // Draw arrowhead aligned to the entry side
        const headLen = 20;
        let hx1, hy1;
        if (element.endBinding) {
          switch (element.endBinding.key) {
            case 'left':   hx1 = element.x2 - headLen; hy1 = element.y2; break;
            case 'right':  hx1 = element.x2 + headLen; hy1 = element.y2; break;
            case 'top':    hx1 = element.x2; hy1 = element.y2 - headLen; break;
            case 'bottom': hx1 = element.x2; hy1 = element.y2 + headLen; break;
            default:
              hx1 = endHorizontal ? element.x2 - (cx2 <= element.x2 ? 1 : -1) * headLen : element.x2;
              hy1 = endHorizontal ? element.y2 : element.y2 - (cy2 <= element.y2 ? 1 : -1) * headLen;
          }
        } else if (endHorizontal) {
          const sign = cx2 <= element.x2 ? 1 : -1;
          hx1 = element.x2 - sign * headLen;
          hy1 = element.y2;
        } else {
          const sign = cy2 <= element.y2 ? 1 : -1;
          hx1 = element.x2;
          hy1 = element.y2 - sign * headLen;
        }
        this.drawArrowHead(hx1, hy1, element.x2, element.y2, roughOptions);

        if (isSelected) this.drawEndpointHandles(x, y, element.x2, element.y2);
        break;
      }
        
      case 'freehand':
        if (element.points.length > 1) {
          // Use curve instead of linearPath for smoother, rounder shapes
          this.rc.curve(element.points, roughOptions);
        }
        if (isSelected) this.drawBoundingBoxForPoints(element.points);
        break;
        
      case 'text': {
        const fontSize = style.fontSize || 24;
        const isCentered = element.textAlign === 'center';
        const isDark = document.documentElement.classList.contains('dark');
        const linkColor = isDark ? '#60a5fa' : '#1d4ed8';
        const baseTextColor = style.textColor || style.strokeColor;

        // Inline migration: legacy single url → urlSpans
        if (element.url && !element.urlSpans) {
          element.urlSpans = [{ start: 0, end: (element.text || '').length, url: element.url }];
          delete element.url;
        }
        const urlSpans = element.urlSpans || [];

        this.ctx.font = `${style.fontItalic ? 'italic ' : ''}${style.fontBold ? 'bold ' : ''}${fontSize}px 'Caveat', cursive`;
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left'; // segment rendering always uses left; centered handled via x offset

        const lines = this.wrapTextWithOffsets(this.ctx, element.text, element.maxWidth);
        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        const measuredWidth = lines.length ? Math.max(...lines.map(l => this.ctx.measureText(l.text).width)) : 0;
        const width = element.maxWidth || Math.max(measuredWidth, 1);

        element.width = width;
        element.height = totalHeight;

        const startY = y - totalHeight / 2 + lineHeight / 2;

        for (let li = 0; li < lines.length; li++) {
          const { text: lineText, startOffset } = lines[li];
          const lineY = startY + li * lineHeight;
          const lineWidth = this.ctx.measureText(lineText).width;
          const lineStartX = isCentered ? x - lineWidth / 2 : x;
          const segments = this._getLineSegments(lineText, startOffset, urlSpans);

          let curX = lineStartX;
          for (const seg of segments) {
            const color = seg.url ? linkColor : baseTextColor;
            this.ctx.fillStyle = color;
            this.ctx.fillText(seg.text, curX, lineY);
            const segW = this.ctx.measureText(seg.text).width;

            const needsDec = style.fontUnderline || style.fontStrikethrough || !!seg.url;
            if (needsDec) {
              this.ctx.save();
              this.ctx.strokeStyle = color;
              this.ctx.lineWidth = Math.max(1, fontSize / 20);
              this.ctx.lineCap = 'round';
              if (style.fontUnderline || seg.url) {
                const uy = lineY + fontSize * 0.42;
                this.ctx.beginPath();
                this.ctx.moveTo(curX, uy);
                this.ctx.lineTo(curX + segW, uy);
                this.ctx.stroke();
              }
              if (style.fontStrikethrough) {
                this.ctx.beginPath();
                this.ctx.moveTo(curX, lineY);
                this.ctx.lineTo(curX + segW, lineY);
                this.ctx.stroke();
              }
              this.ctx.restore();
            }
            curX += segW;
          }
        }

        const bboxX = isCentered ? x - width / 2 : x;

        if (isSelected) {
          this.drawBoundingBox(bboxX, y - totalHeight / 2, width, totalHeight);

          const handlePositions = isCentered ? [
            { x: x,             y: y - totalHeight / 2 },
            { x: x + width / 2, y: y },
            { x: x,             y: y + totalHeight / 2 },
            { x: x - width / 2, y: y }
          ] : [
            { x: x + width / 2, y: y - totalHeight / 2 },
            { x: x + width,     y: y },
            { x: x + width / 2, y: y + totalHeight / 2 },
            { x: x,             y: y }
          ];

          this.ctx.fillStyle = '#b95530';
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1.5;

          handlePositions.forEach(hPos => {
            this.ctx.beginPath();
            this.ctx.arc(hPos.x, hPos.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
          });
        }
        break;
      }
    }

    this.ctx.restore();
  }

  // Returns [{text, startOffset}] — same wrapping as wrapText but tracks char offsets for span rendering.
  wrapTextWithOffsets(ctx, text, maxWidth) {
    if (!maxWidth) {
      let offset = 0;
      return text.split('\n').map(line => {
        const r = { text: line, startOffset: offset };
        offset += line.length + 1;
        return r;
      });
    }
    const result = [];
    const paragraphs = text.split('\n');
    let globalOffset = 0;
    for (const paragraph of paragraphs) {
      if (!paragraph) {
        result.push({ text: '', startOffset: globalOffset });
        globalOffset += 1;
        continue;
      }
      const words = paragraph.split(' ');
      let currentLine = '';
      let lineStartOffset = globalOffset;
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          result.push({ text: currentLine, startOffset: lineStartOffset });
          lineStartOffset += currentLine.length + 1; // consumed chars + the breaking space
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      result.push({ text: currentLine, startOffset: lineStartOffset });
      globalOffset += paragraph.length + 1; // +1 for '\n'
    }
    return result;
  }

  // Split one visual line into [{text, url}] segments based on urlSpans.
  _getLineSegments(lineText, lineStart, urlSpans) {
    const len = lineText.length;
    if (!urlSpans || urlSpans.length === 0) return [{ text: lineText, url: null }];
    // Map each character position to a url (null = plain)
    const urlAt = new Array(len).fill(null);
    for (const span of urlSpans) {
      const s = Math.max(span.start - lineStart, 0);
      const e = Math.min(span.end - lineStart, len);
      for (let i = s; i < e; i++) urlAt[i] = span.url;
    }
    // Group consecutive chars with the same url
    const segments = [];
    let i = 0;
    while (i < len) {
      const url = urlAt[i];
      let j = i + 1;
      while (j < len && urlAt[j] === url) j++;
      segments.push({ text: lineText.substring(i, j), url });
      i = j;
    }
    return segments;
  }

  wrapText(ctx, text, maxWidth, fontSize) {
    if (!maxWidth) return text.split('\n');
    
    const lines = [];
    const paragraphs = text.split('\n');
    
    paragraphs.forEach(paragraph => {
      if (!paragraph) {
        lines.push('');
        return;
      }
      
      const words = paragraph.split(' ');
      let currentLine = '';
      
      words.forEach(word => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      lines.push(currentLine);
    });
    
    return lines;
  }

  drawArrowHead(x1, y1, x2, y2, roughOptions) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 15;
    
    // Draw two lines for the arrow head
    const leftX = x2 - headLength * Math.cos(angle - Math.PI / 6);
    const leftY = y2 - headLength * Math.sin(angle - Math.PI / 6);
    this.rc.line(x2, y2, leftX, leftY, roughOptions);

    const rightX = x2 - headLength * Math.cos(angle + Math.PI / 6);
    const rightY = y2 - headLength * Math.sin(angle + Math.PI / 6);
    this.rc.line(x2, y2, rightX, rightY, roughOptions);
  }

  drawResizeHandles(x, y, width, height) {
    const rx = width < 0 ? x + width : x;
    const ry = height < 0 ? y + height : y;
    const rw = Math.abs(width);
    const rh = Math.abs(height);
    const positions = [
      { x: rx,          y: ry           }, // nw
      { x: rx + rw / 2, y: ry           }, // n
      { x: rx + rw,     y: ry           }, // ne
      { x: rx + rw,     y: ry + rh / 2  }, // e
      { x: rx + rw,     y: ry + rh      }, // se
      { x: rx + rw / 2, y: ry + rh      }, // s
      { x: rx,          y: ry + rh      }, // sw
      { x: rx,          y: ry + rh / 2  }, // w
    ];
    this.ctx.fillStyle = '#b95530';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;
    positions.forEach(h => {
      this.ctx.beginPath();
      this.ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    });
  }

  drawEndpointHandles(x1, y1, x2, y2) {
    this.ctx.fillStyle = '#b95530';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;
    [[x1, y1], [x2, y2]].forEach(([hx, hy]) => {
      this.ctx.beginPath();
      this.ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    });
  }

  drawBoundingBox(x, y, width, height) {
    this.ctx.strokeStyle = '#b95530';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    // Fix negative width/height
    const rx = width < 0 ? x + width : x;
    const ry = height < 0 ? y + height : y;
    const rw = Math.abs(width);
    const rh = Math.abs(height);
    
    this.ctx.strokeRect(rx - 5, ry - 5, rw + 10, rh + 10);
    this.ctx.setLineDash([]);
  }

  drawBoundingBoxForLine(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const width = Math.abs(x1 - x2);
    const height = Math.abs(y1 - y2);
    this.drawBoundingBox(minX, minY, width, height);
  }

  drawBoundingBoxForPoints(points) {
    if (!points || points.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    });
    this.drawBoundingBox(minX, minY, maxX - minX, maxY - minY);
  }
}
