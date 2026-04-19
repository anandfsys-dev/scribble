export class Exporter {
  static exportJson(elements) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(elements, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "scribble_export.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  static exportMarkdown(canvas) {
    // 1. Get base64 representation of canvas
    // Create a temporary canvas to draw with white background if needed
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    
    // Draw background based on theme or just white
    const isDark = document.body.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
    ctx.fillStyle = isDark ? '#0f172a' : '#f8f9fa';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the main canvas over it
    ctx.drawImage(canvas, 0, 0);

    const dataUrl = tempCanvas.toDataURL("image/png");

    // 2. Create markdown content
    const markdownContent = `# Scribble Export

![Scribble Canvas](${dataUrl})

*Exported on ${new Date().toLocaleString()}*
`;

    // 3. Trigger download
    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(markdownContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "scribble_export.md");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
}
