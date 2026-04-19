import rough from 'roughjs';

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.rc = rough.canvas(ctx.canvas);
  }

  drawElement(element, isSelected = false) {
    const { type, x, y, style } = element;
    
    // Convert our internal style to roughjs options
    const roughOptions = {
      stroke: style.strokeColor,
      strokeWidth: style.strokeWidth,
      fill: style.fillColor === 'transparent' ? undefined : style.fillColor,
      fillStyle: 'hachure',
      // Default to 0 roughness for freehand (Smooth Mode)
      roughness: type === 'freehand' ? 0 : 1.5,
      bowing: type === 'freehand' ? 0 : 1
    };

    this.ctx.save();
    
    switch (type) {
      case 'rectangle':
        this.rc.rectangle(x, y, element.width, element.height, roughOptions);
        if (isSelected) this.drawBoundingBox(x, y, element.width, element.height);
        break;
        
      case 'ellipse':
        // roughjs ellipse takes center x, center y, width, height
        this.rc.ellipse(x + element.width / 2, y + element.height / 2, element.width, element.height, roughOptions);
        if (isSelected) this.drawBoundingBox(x, y, element.width, element.height);
        break;
        
      case 'line':
        this.rc.line(x, y, element.x2, element.y2, roughOptions);
        if (isSelected) this.drawBoundingBoxForLine(x, y, element.x2, element.y2);
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
        
        const tx = element.x2 - cx2;
        const ty = element.y2 - cy2;
        
        if (Math.abs(tx) < 0.1 && Math.abs(ty) < 0.1) {
            this.drawArrowHead(x, y, element.x2, element.y2, roughOptions);
        } else {
            this.drawArrowHead(element.x2 - tx, element.y2 - ty, element.x2, element.y2, roughOptions);
        }
        
        if (isSelected) this.drawBoundingBoxForLine(x, y, element.x2, element.y2);
        break;
      }
        
      case 'freehand':
        if (element.points.length > 1) {
          // Use curve instead of linearPath for smoother, rounder shapes
          this.rc.curve(element.points, roughOptions);
        }
        if (isSelected) this.drawBoundingBoxForPoints(element.points);
        break;
        
      case 'text':
        const fontSize = style.fontSize || 24;
        const textColor = style.textColor || style.strokeColor;
        this.ctx.font = `${fontSize}px 'Caveat', cursive`; 
        this.ctx.fillStyle = textColor;
        this.ctx.textAlign = 'left'; 
        this.ctx.textBaseline = 'middle';
        
        // Use wrapText if maxWidth exists, otherwise just split by \n
        const lines = this.wrapText(this.ctx, element.text, element.maxWidth, fontSize);
        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        const width = element.maxWidth || Math.max(...lines.map(l => this.ctx.measureText(l).width));
        
        // Cache dimensions for hit testing
        element.width = width;
        element.height = totalHeight;
        
        const startY = y - totalHeight / 2 + lineHeight / 2;
        
        lines.forEach((line, i) => {
          this.ctx.fillText(line, x, startY + (i * lineHeight));
        });
        
        if (isSelected) {
          this.drawBoundingBox(x, y - totalHeight/2, width, totalHeight);
          
          // Draw 8 resize handles
          const handlePositions = [
            { x: x, y: y - totalHeight/2 }, // NW
            { x: x + width/2, y: y - totalHeight/2 }, // N
            { x: x + width, y: y - totalHeight/2 }, // NE
            { x: x + width, y: y }, // E
            { x: x + width, y: y + totalHeight/2 }, // SE
            { x: x + width/2, y: y + totalHeight/2 }, // S
            { x: x, y: y + totalHeight/2 }, // SW
            { x: x, y: y } // W
          ];

          this.ctx.fillStyle = '#6366f1';
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1;
          
          handlePositions.forEach(pos => {
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
          });
        }
        break;
    }

    this.ctx.restore();
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

  drawBoundingBox(x, y, width, height) {
    this.ctx.strokeStyle = '#4f46e5';
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
