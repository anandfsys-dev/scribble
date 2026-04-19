export class TextTool {
  constructor(state) {
    this.state = state;
  }
  
  onPointerDown(pos, e) {
    // Check if we clicked on an existing text element
    const hitElement = this.state.getElementAt(pos, null, ['text']);
    if (hitElement) {
        this.editElement(hitElement);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.style.position = 'absolute';
    
    const screenX = pos.x * this.state.zoom + this.state.pan.x;
    const screenY = pos.y * this.state.zoom + this.state.pan.y;
    
    textarea.style.left = `${screenX}px`;
    textarea.style.top = `${screenY}px`;
    textarea.style.minWidth = '100px';
    textarea.style.minHeight = '30px';
    textarea.style.background = 'transparent';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.fontFamily = "'Caveat', cursive";
    textarea.style.fontSize = `${(this.state.currentStyle.fontSize || 24) * this.state.zoom}px`;
    textarea.style.color = this.state.currentStyle.textColor || this.state.currentStyle.strokeColor;
    textarea.style.lineHeight = '1.2';
    textarea.style.padding = '0';
    textarea.style.margin = '0';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    textarea.style.zIndex = '100';
    textarea.style.textAlign = 'left';
    textarea.style.transform = 'translate(0, -50%)';

    document.getElementById('app').appendChild(textarea);
    
    // Auto-resize textarea vertically based on content
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });

    // Timeout to ensure focus happens
    setTimeout(() => textarea.focus(), 10);

    const commitText = () => {
      if (textarea.parentNode) {
        const text = textarea.value.trim();
        if (text) {
          const element = {
            id: Date.now().toString(),
            type: 'text',
            text: text,
            x: pos.x,
            y: pos.y,
            style: { ...this.state.currentStyle }
          };
          this.state.addElement(element);
          this.state.setSelection([element]);
        }
        textarea.remove();
      }
    };

    textarea.addEventListener('blur', commitText);
    
    // Commit on Shift+Enter, allow regular Enter for new lines
    textarea.addEventListener('keydown', (ev) => {
      // Prevent deleting the text area from triggering canvas delete
      ev.stopPropagation(); 
      if (ev.key === 'Enter' && ev.shiftKey) {
        ev.preventDefault();
        commitText();
      } else if (ev.key === 'Escape') {
        textarea.value = ''; // Cancel
        commitText();
      }
    });
  }

  editElement(element) {
    const textarea = document.createElement('textarea');
    textarea.style.position = 'absolute';
    
    const screenX = element.x * this.state.zoom + this.state.pan.x;
    const screenY = element.y * this.state.zoom + this.state.pan.y;
    
    textarea.style.left = `${screenX}px`;
    textarea.style.top = `${screenY}px`;
    textarea.style.minWidth = '100px';
    textarea.style.minHeight = '30px';
    textarea.style.background = 'transparent';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.fontFamily = "'Caveat', cursive";
    textarea.style.fontSize = `${(element.style.fontSize || 24) * this.state.zoom}px`;
    textarea.style.color = element.style.textColor || element.style.strokeColor;
    textarea.style.lineHeight = '1.2';
    textarea.style.padding = '0';
    textarea.style.margin = '0';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    textarea.style.zIndex = '100';
    textarea.style.textAlign = 'left';
    textarea.style.transform = 'translate(0, -50%)';
    textarea.value = element.text;

    document.getElementById('app').appendChild(textarea);
    
    // Auto-resize textarea vertically based on content
    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    };
    textarea.addEventListener('input', resize);
    resize();

    // Timeout to ensure focus happens
    setTimeout(() => {
      textarea.focus();
      textarea.select();
    }, 10);

    const originalText = element.text;
    element.text = ''; // Hide while editing
    this.state.isDirty = true;

    const commitText = () => {
      if (textarea.parentNode) {
        const text = textarea.value.trim();
        if (text) {
          element.text = text;
          this.state.isDirty = true;
          this.state.saveHistory();
          this.state.saveToLocalStorage();
        } else {
          this.state.removeElement(element);
        }
        textarea.remove();
      }
    };

    textarea.addEventListener('blur', commitText);
    
    textarea.addEventListener('keydown', (ev) => {
      ev.stopPropagation(); 
      if (ev.key === 'Enter' && ev.shiftKey) {
        ev.preventDefault();
        commitText();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        element.text = originalText;
        textarea.remove();
        this.state.isDirty = true;
      }
    });
  }
  
  onPointerMove(pos, e) {}
  onPointerUp(pos, e) {}
}
