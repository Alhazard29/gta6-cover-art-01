// Vice City Cover Studio — editor wiring (chunk B).
//
// Owns the page state and every control, and hands all drawing to the
// cover engine in src/cover.js. Photos are read from the file input as
// object URLs and never leave the machine.

import {
  LAYOUTS,
  GRADES,
  SIZES,
  PANEL_COUNTS,
  createPanelStates,
  panelRects,
  clampPan,
  renderCover,
  exportCoverPNG as engineExport,
} from './cover.js';

const state = {
  layout: 'vice-grid',
  grade: 'vice-sunset',
  title: 'VICE CITY',
  subtitle: 'a story in every panel',
  photos: [], // { name, url, width, height, img }
  size: '1080x1080',
  zoom: 100,
  selectedPanel: 0,
};

// One entry per panel of the current layout: which photo it shows and
// how that photo is cropped inside it. Kept beside state, not in it, so
// the headless hook keeps exactly the shape chunk A defined.
let panels = createPanelStates(PANEL_COUNTS[state.layout]);

const $ = (id) => document.getElementById(id);

function setStatus(message) {
  const line = $('statusLine');
  if (line) line.textContent = message;
}

function canvasSize() {
  const [w, h] = state.size.split('x').map(Number);
  return [w, h];
}

// Resize the panel list to the current layout, keeping each panel's photo
// and crop by index, then fill any panel left empty from the photo pool.
function ensurePanels() {
  const count = PANEL_COUNTS[state.layout] ?? 1;
  const kept = panels.slice(0, count);
  while (kept.length < count) kept.push({ photo: null, zoom: 1, dx: 0, dy: 0 });
  panels = kept;
  fillEmptyPanels();
}

function fillEmptyPanels() {
  if (state.photos.length === 0) return;
  panels.forEach((panel, i) => {
    if (!panel.photo) panel.photo = state.photos[i % state.photos.length];
  });
}

// Hand every photo out round-robin, one per panel, wrapping when there
// are fewer photos than panels. Used on load and on Shuffle.
function assignPhotosRoundRobin() {
  if (state.photos.length === 0) {
    panels.forEach((panel) => { panel.photo = null; });
    return;
  }
  panels.forEach((panel, i) => {
    panel.photo = state.photos[i % state.photos.length];
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = 0;
  });
}

function selectedPanelState() {
  return panels[state.selectedPanel] || panels[0];
}

function syncZoomSlider() {
  const slider = $('zoomSlider');
  const panel = selectedPanelState();
  state.zoom = Math.round((panel ? panel.zoom : 1) * 100);
  if (slider) slider.value = String(state.zoom);
}

function updatePanelHint() {
  const hint = $('panelHint');
  if (!hint) return;
  const count = PANEL_COUNTS[state.layout] ?? 1;
  const selected = Math.min(state.selectedPanel, count - 1);
  const panel = panels[selected];
  const name = panel && panel.photo ? panel.photo.name : 'sunset art';
  hint.textContent = `Selected panel: ${selected + 1} of ${count} (${name}) — click a panel to select it, drag to pan, scroll to zoom.`;
}

function renderPreview() {
  const canvas = $('coverCanvas');
  if (!canvas) return;
  ensurePanels();
  renderCover(canvas, {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    panels,
    size: state.size,
    showSelection: true,
    selectedPanel: state.selectedPanel,
  });
  syncZoomSlider();
  updatePanelHint();
}

// Rebuild the photo strip: one clickable thumbnail per photo. Clicking a
// thumbnail drops that photo into the selected panel.
function rebuildThumbnails() {
  const listEl = $('photoList');
  if (!listEl) return;
  listEl.innerHTML = '';
  state.photos.forEach((photo, index) => {
    const item = document.createElement('li');
    item.className = 'photo-thumb';
    item.title = `Use this photo in the selected panel`;
    const thumb = document.createElement('img');
    thumb.src = photo.url;
    thumb.alt = photo.name;
    const label = document.createElement('span');
    label.textContent = `${photo.name} — ${photo.width}×${photo.height}`;
    item.appendChild(thumb);
    item.appendChild(label);
    item.addEventListener('click', () => {
      const panel = selectedPanelState();
      if (!panel) return;
      panel.photo = photo;
      panel.zoom = 1;
      panel.dx = 0;
      panel.dy = 0;
      markSelectedThumbnail(index);
      setStatus(`Panel ${state.selectedPanel + 1} now shows ${photo.name}.`);
      renderPreview();
    });
    listEl.appendChild(item);
  });
  markSelectedThumbnail(-1);
}

function markSelectedThumbnail(photoIndex) {
  const listEl = $('photoList');
  if (!listEl) return;
  const items = listEl.querySelectorAll('.photo-thumb');
  items.forEach((item, i) => item.classList.toggle('chosen', i === photoIndex));
}

// Load photos from a file input: object URLs only, decoded here so the
// engine can draw them straight from memory.
function loadPhotos(files) {
  const list = Array.from(files ?? []).filter((f) => f && f.type.startsWith('image/'));
  if (list.length === 0) return Promise.resolve([]);
  const loaded = list.map((file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ name: file.name, url, width: img.naturalWidth, height: img.naturalHeight, img });
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  }));
  return Promise.all(loaded).then((results) => {
    const good = results.filter(Boolean);
    state.photos.push(...good);
    assignPhotosRoundRobin();
    rebuildThumbnails();
    setStatus(good.length === 1
      ? `Loaded 1 photo (${state.photos.length} total).`
      : `Loaded ${good.length} photos (${state.photos.length} total).`);
    renderPreview();
    return good;
  });
}

// Export the real cover: render offscreen, download the PNG.
function exportCoverPNG() {
  return engineExport({
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    panels,
    size: state.size,
  }).then((result) => {
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus(`Exported ${result.filename} (${result.width}×${result.height}, ${(result.blob.size / 1024).toFixed(0)} KB).`);
    return result;
  }).catch((err) => {
    setStatus(`Export failed: ${err && err.message ? err.message : err}`);
    throw err;
  });
}

function setLayout(layout) {
  if (!LAYOUTS.includes(layout)) return;
  state.layout = layout;
  state.selectedPanel = 0;
  ensurePanels();
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

// Which panel, if any, sits under a point on the displayed canvas.
function panelAtPoint(event) {
  const canvas = $('coverCanvas');
  const rect = canvas.getBoundingClientRect();
  const [w, h] = canvasSize();
  const px = (event.clientX - rect.left) * (w / rect.width);
  const py = (event.clientY - rect.top) * (h / rect.height);
  const geo = panelRects(state.layout, w, h);
  const hit = geo.panels.findIndex((r) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h);
  return { index: hit, point: [px, py], geo };
}

function wireCanvas() {
  const canvas = $('coverCanvas');
  if (!canvas) return;
  let dragging = null; // { panel, lastX, lastY }

  canvas.addEventListener('pointerdown', (event) => {
    const { index, point } = panelAtPoint(event);
    if (index < 0) return;
    state.selectedPanel = index;
    canvas.setPointerCapture(event.pointerId);
    dragging = { panel: panels[index], lastX: point[0], lastY: point[1] };
    renderPreview();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const { point } = panelAtPoint(event);
    const [w, h] = canvasSize();
    const geo = panelRects(state.layout, w, h);
    const rect = geo.panels[state.selectedPanel];
    dragging.panel.dx += point[0] - dragging.lastX;
    dragging.panel.dy += point[1] - dragging.lastY;
    dragging.lastX = point[0];
    dragging.lastY = point[1];
    clampPan(dragging.panel, dragging.panel.photo, rect);
    renderPreview();
  });

  const endDrag = () => { dragging = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Wheel zooms the selected panel between 1x and 3x.
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const panel = selectedPanelState();
    if (!panel) return;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    panel.zoom = Math.max(1, Math.min(3, (panel.zoom || 1) * factor));
    const [w, h] = canvasSize();
    clampPan(panel, panel.photo, panelRects(state.layout, w, h).panels[state.selectedPanel]);
    renderPreview();
  }, { passive: false });

  // Double-click swaps the selected panel to the next photo.
  canvas.addEventListener('dblclick', () => {
    const panel = selectedPanelState();
    if (!panel || state.photos.length < 2) return;
    const current = state.photos.indexOf(panel.photo);
    panel.photo = state.photos[(current + 1) % state.photos.length];
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = 0;
    setStatus(`Panel ${state.selectedPanel + 1} now shows ${panel.photo.name}.`);
    renderPreview();
  });
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
  if (zoomSlider) zoomSlider.addEventListener('input', () => {
    const panel = selectedPanelState();
    if (!panel) return;
    panel.zoom = Math.max(1, Math.min(3, Number(zoomSlider.value) / 100));
    state.zoom = Math.round(panel.zoom * 100);
    const [w, h] = canvasSize();
    clampPan(panel, panel.photo, panelRects(state.layout, w, h).panels[state.selectedPanel]);
    renderPreview();
  });

  const resetPanelBtn = $('resetPanelBtn');
  if (resetPanelBtn) resetPanelBtn.addEventListener('click', () => {
    const panel = selectedPanelState();
    if (panel) {
      panel.zoom = 1;
      panel.dx = 0;
      panel.dy = 0;
    }
    setStatus(`Panel ${state.selectedPanel + 1} reset to cover fit.`);
    renderPreview();
  });

  const shuffleBtn = $('shuffleBtn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
    const otherLayouts = LAYOUTS.filter((l) => l !== state.layout);
    const otherGrades = GRADES.filter((g) => g !== state.grade);
    state.layout = otherLayouts[Math.floor(Math.random() * otherLayouts.length)];
    state.grade = otherGrades[Math.floor(Math.random() * otherGrades.length)];
    state.selectedPanel = 0;
    ensurePanels();
    // Shuffle the photo order, then deal them round-robin again.
    const shuffled = [...state.photos];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    state.photos = shuffled;
    assignPhotosRoundRobin();
    rebuildThumbnails();
    markActive('layoutPicker', 'layout', state.layout);
    markActive('gradePicker', 'grade', state.grade);
    setStatus(`Shuffled: ${state.layout}, ${state.grade}.`);
    renderPreview();
  });

  const exportBtn = $('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => exportCoverPNG());
}

wireCanvas();
wireControls();
renderPreview();

// Headless test hook: same shape as chunk A, now backed by the engine.
window.__coverStudio = { state, loadPhotos, exportCoverPNG, setLayout, setGrade, setSize, renderPreview };
