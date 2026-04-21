export const PALETTES = {
  light: {
    stroke: ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'],
    fill: ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99']
  },
  dark: {
    stroke: ['#f8f9fa', '#ff8787', '#8ce99a', '#74c0fc', '#ffd43b'],
    fill: ['transparent', '#5c0011', '#092b00', '#001d66', '#5c3e00']
  }
};

// Remaps all element colors and UI buttons to the current theme palette
export function updatePalette(state) {
  const isDark = document.documentElement.classList.contains('dark');
  const palette = isDark ? PALETTES.dark : PALETTES.light;
  const oldPalette = isDark ? PALETTES.light : PALETTES.dark;

  document.querySelectorAll('.color-btn').forEach(btn => {
    const color = palette.stroke[btn.dataset.colorIndex];
    btn.style.backgroundColor = color;
    btn.dataset.color = color;
  });

  document.querySelectorAll('.fill-btn').forEach(btn => {
    const color = palette.fill[btn.dataset.colorIndex];
    if (color === 'transparent') {
      btn.style.background = isDark
        ? 'repeating-linear-gradient(45deg, transparent, transparent 3px, #334155 3px, #334155 6px)'
        : 'repeating-linear-gradient(45deg, transparent, transparent 3px, #e2e8f0 3px, #e2e8f0 6px)';
    } else {
      btn.style.background = color;
    }
    btn.dataset.color = color;
  });

  document.querySelectorAll('.text-color-btn').forEach(btn => {
    const color = palette.stroke[btn.dataset.colorIndex];
    btn.style.backgroundColor = color;
    btn.dataset.color = color;
  });

  // Migrate current style colors to new palette by index
  const sIdx = oldPalette.stroke.indexOf(state.currentStyle.strokeColor);
  if (sIdx !== -1) state.currentStyle.strokeColor = palette.stroke[sIdx];

  const fIdx = oldPalette.fill.indexOf(state.currentStyle.fillColor);
  if (fIdx !== -1) state.currentStyle.fillColor = palette.fill[fIdx];

  const tIdx = oldPalette.stroke.indexOf(state.currentStyle.textColor);
  if (tIdx !== -1) state.currentStyle.textColor = palette.stroke[tIdx];

  // Migrate all existing element colors
  state.elements.forEach(el => {
    if (!el.style) return; // frame elements have no user-controlled style
    const s = oldPalette.stroke.indexOf(el.style.strokeColor);
    if (s !== -1) el.style.strokeColor = palette.stroke[s];

    const f = oldPalette.fill.indexOf(el.style.fillColor);
    if (f !== -1) el.style.fillColor = palette.fill[f];

    const t = oldPalette.stroke.indexOf(el.style.textColor);
    if (t !== -1) el.style.textColor = palette.stroke[t];
  });

  state.isDirty = true;
}

// Wires up the theme toggle button and restores saved theme on load
export function setupTheme(state) {
  const btn = document.getElementById('btn-theme');
  const html = document.documentElement;

  if (localStorage.getItem('theme') === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  updatePalette(state);

  btn.addEventListener('click', () => {
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updatePalette(state);
  });
}
