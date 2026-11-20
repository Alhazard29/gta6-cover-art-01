// Vice City Cover Studio — editor shell (chunk A).
// Photo loading and the headless test hook live here. The cover engine
// (panel layouts, colour grades, PNG export) lands in src/cover.js in
// chunk B, which rewrites this file around the same hook.

const LAYOUTS = ['vice-grid', 'four-panel', 'nine-grid', 'full-bleed', 'triple-strip'];
const GRADES = ['vice-sunset', 'neon-nights', 'palm-dusk', 'noir', 'candy-pop'];
const SIZES = ['1080x1080', '1080x1350', '1920x1080'];

// Panel counts per layout, used by the shell preview until the engine lands.
const PANEL_COUNTS = {
  'vice-grid': 5,
  'four-panel': 4,
  'nine-grid': 9,
  'full-bleed': 1,
  'triple-strip': 3,
};

// Grade palettes: [sky top, sky bottom, accent] for the shell preview.
const GRADE_COLORS = {
  'vice-sunset': ['#ff9a5a', '#ff6b5e', '#2ec4b6'],
  'neon-nights': ['#2b1055', '#ff2e88', '#2ec4b6'],
  'palm-dusk': ['#7b5ea7', '#ff7e5f', '#feb47b'],
  'noir': ['#3a3a3a', '#0a0a0a', '#f4efe6'],
  'candy-pop': ['#ff8fb1', '#7b61ff', '#ffe066'],
};

const state = {
  layout: 'vice-grid',
  grade: 'vice-sunset',
  title: 'VICE CITY',
  subtitle: 'a story in every panel',
  photos: [], // { name, url, width, height }
  size: '1080x1080',
  zoom: 100,
  selectedPanel: 0,
};

const $ = (id) => document.getElementById(id);

function setStatus(message) {
  const line = $('statusLine');
  if (line) line.textContent = message;
}

function updatePanelHint() {
  const hint = $('panelHint');
  if (!hint) return;
  const count = PANEL_COUNTS[state.layout] ?? 1;
  const selected = Math.min(state.selectedPanel, count - 1);
  hint.textContent = `Selected panel: ${selected + 1} of ${count} — click a panel on the canvas to select it.`;
}

// Shell preview: a sunset wash, panel dividers and the caption in system
// fonts. Chunk B replaces this with the real cover engine.
function renderPreview() {
  const canvas = $('coverCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const [w, h] = state.size.split('x').map(Number);
  canvas.width = w;
  canvas.height = h;
  const colors = GRADE_COLORS[state.grade] ?? GRADE_COLORS['vice-sunset'];
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, colors[0]);
  wash.addColorStop(1, colors[1]);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  const count = PANEL_COUNTS[state.layout] ?? 1;
  const cols = count === 9 ? 3 : count === 4 ? 2 : count === 3 ? 3 : count === 5 ? 3 : 1;
  const rows = Math.ceil(count / cols);
  const gap = Math.round(w * 0.012);
  const cellW = (w - gap * (cols + 1)) / cols;
  const cellH = (h * 0.72 - gap * (rows + 1)) / rows;
  ctx.fillStyle = 'rgba(10, 22, 27, 0.55)';
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.fillRect(gap + col * (cellW + gap), gap + row * (cellH + gap), cellW, cellH);
  }
  if (state.selectedPanel < count) {
    const col = state.selectedPanel % cols;
    const row = Math.floor(state.selectedPanel / cols);
    ctx.strokeStyle = colors[2];
    ctx.lineWidth = Math.max(4, Math.round(w * 0.006));
    ctx.strokeRect(gap + col * (cellW + gap), gap + row * (cellH + gap), cellW, cellH);
  }

  const titleSize = Math.round(w * 0.085);
  ctx.textAlign = 'center';
  ctx.font = `900 ${titleSize}px 'Arial Narrow', 'Helvetica Neue Condensed', Impact, sans-serif-condensed, sans-serif`;
  ctx.fillStyle = '#f4efe6';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = Math.round(w * 0.01);
  ctx.shadowOffsetY = Math.round(w * 0.006);
  ctx.fillText(state.title.toUpperCase(), w / 2, h * 0.86, w * 0.92);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = `italic ${Math.round(w * 0.032)}px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText(state.subtitle, w / 2, h * 0.93, w * 0.9);
  updatePanelHint();
}

// Load photos from a file input or a drop: object URLs only, the files
// never leave the machine.
function loadPhotos(files) {
  const list = Array.from(files ?? []).filter((f) => f && f.type.startsWith('image/'));
  if (list.length === 0) return Promise.resolve([]);
  const loaded = list.map((file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ name: file.name, url, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  }));
  return Promise.all(loaded).then((results) => {
    const good = results.filter(Boolean);
    state.photos.push(...good);
    const listEl = $('photoList');
    if (listEl) {
      for (const photo of good) {
        const item = document.createElement('li');
        item.textContent = `${photo.name} — ${photo.width}×${photo.height}`;
        listEl.appendChild(item);
      }
    }
    setStatus(good.length === 1
      ? `Loaded 1 photo (${state.photos.length} total).`
      : `Loaded ${good.length} photos (${state.photos.length} total).`);
    renderPreview();
    return good;
  });
}

// Stub until chunk B ships the cover engine: reports that export is not
// wired yet instead of failing silently.
function exportCoverPNG() {
  setStatus('Export is not wired yet — the cover engine lands in the next build step.');
  return Promise.resolve(null);
}

function setLayout(layout) {
  if (!LAYOUTS.includes(layout)) return;
  state.layout = layout;
  state.selectedPanel = 0;
  renderPreview();
}

function setGrade(grade) {
  if (!GRADES.includes(grade)) return;
  state.grade = grade;
  renderPreview();
}

function setSize(size) {
  if (!SIZES.includes(size)) return;
  state.size = size;
  renderPreview();
}

function markActive(containerId, attr, value) {
  const container = $(containerId);
  if (!container) return;
  for (const button of container.querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset[attr] === value);
  }
}

function wireControls() {
  const photoInput = $('photoInput');
  if (photoInput) photoInput.addEventListener('change', () => loadPhotos(photoInput.files));

  const layoutPicker = $('layoutPicker');
  if (layoutPicker) layoutPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-layout]');
    if (!button) return;
    setLayout(button.dataset.layout);
    markActive('layoutPicker', 'layout', state.layout);
  });

  const gradePicker = $('gradePicker');
  if (gradePicker) gradePicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-grade]');
    if (!button) return;
    setGrade(button.dataset.grade);
    markActive('gradePicker', 'grade', state.grade);
  });

  const sizePicker = $('sizePicker');
  if (sizePicker) sizePicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-size]');
    if (!button) return;
    setSize(button.dataset.size);
    markActive('sizePicker', 'size', state.size);
  });

  const titleInput = $('titleInput');
  if (titleInput) titleInput.addEventListener('input', () => { state.title = titleInput.value; renderPreview(); });
  const subtitleInput = $('subtitleInput');
  if (subtitleInput) subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; renderPreview(); });

  const zoomSlider = $('zoomSlider');
  if (zoomSlider) zoomSlider.addEventListener('input', () => { state.zoom = Number(zoomSlider.value); renderPreview(); });
  const resetPanelBtn = $('resetPanelBtn');
  if (resetPanelBtn) resetPanelBtn.addEventListener('click', () => {
    state.zoom = 100;
    state.selectedPanel = 0;
    if (zoomSlider) zoomSlider.value = '100';
    renderPreview();
  });

  const canvas = $('coverCanvas');
  if (canvas) canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const count = PANEL_COUNTS[state.layout] ?? 1;
    const cols = count === 9 ? 3 : count === 4 ? 2 : count === 3 ? 3 : count === 5 ? 3 : 1;
    const rows = Math.ceil(count / cols);
    const y = (event.clientY - rect.top) / rect.height;
    const col = Math.min(cols - 1, Math.floor(x * cols));
    const row = Math.min(rows - 1, Math.floor((y / 0.72) * rows));
    state.selectedPanel = Math.min(count - 1, row * cols + col);
    renderPreview();
  });

  const shuffleBtn = $('shuffleBtn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
    const grades = GRADES.filter((g) => g !== state.grade);
    setGrade(grades[Math.floor(Math.random() * grades.length)]);
    markActive('gradePicker', 'grade', state.grade);
    setStatus('Shuffled the colour grade.');
  });

  const exportBtn = $('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => exportCoverPNG());
}

wireControls();
renderPreview();

// Headless test hook: chunk B keeps this shape and fills in the engine.
window.__coverStudio = { state, loadPhotos, exportCoverPNG, setLayout, setGrade, setSize, renderPreview };
