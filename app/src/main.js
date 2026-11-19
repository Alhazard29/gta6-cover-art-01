// Vice City Cover Studio — editor wiring (chunk 2, written fresh).
//
// This module owns the editor state and the DOM: photo loading, the layout /
// grade / size pickers, caption fields, per-panel interaction on the canvas
// (click to select, drag to pan, scroll to zoom, double-click to swap the
// photo), and the PNG export button. All drawing lives in src/cover.js.
//
// The app is fully offline: photos are read with object URLs and never
// leave the machine; the only files it loads are its own, under app/.

import {
  SIZES,
  LAYOUTS,
  GRADES,
  renderCover,
  exportCoverPNG,
  panelAt,
  clampPan,
  defaultPanelState,
} from './cover.js';

const LAYOUT_KEYS = Object.keys(LAYOUTS);
const GRADE_KEYS = Object.keys(GRADES);
const SIZE_KEYS = Object.keys(SIZES);
const MAX_PANELS = 9;

const state = {
  layout: 'vice-grid',
  grade: 'vice-sunset',
  size: '1080x1080',
  title: 'VICE CITY',
  subtitle: 'My story, my streets',
  photos: [], // { name, url, image }
  panels: Array.from({ length: MAX_PANELS }, () => defaultPanelState()),
  selectedPanel: 0,
  showSelection: true,
};

const canvas = document.getElementById('cover-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const photoCountEl = document.getElementById('photo-count');
const photoStripEl = document.getElementById('photo-strip');
const exportBtn = document.getElementById('export-btn');
const zoomSlider = document.getElementById('zoom-slider');
const zoomValueEl = document.getElementById('zoom-value');
const resetPanelBtn = document.getElementById('reset-panel-btn');

// Display fonts are bundled under app/fonts/ (Anton + Pacifico, SIL OFL).
// The cover is only drawn once they are ready, so the lettering is the
// real thing in both the preview and the export.
const fontsReady = Promise.all([
  document.fonts.load('32px Anton'),
  document.fonts.load('32px Pacifico'),
]).catch(() => {
  // If a font file is missing the canvas falls back to system fonts;
  // the app still works, just with plainer lettering.
});

function setStatus(text) {
  statusEl.textContent = text;
}

function panelCount() {
  return LAYOUTS[state.layout].panels.length;
}

// Give every visible panel a photo, in order, when it has none yet.
function assignPhotos() {
  if (state.photos.length === 0) return;
  for (let i = 0; i < panelCount(); i++) {
    if (state.panels[i].photo < 0 || state.panels[i].photo >= state.photos.length) {
      state.panels[i].photo = i % state.photos.length;
      state.panels[i].zoom = 1;
      state.panels[i].dx = 0;
      state.panels[i].dy = 0;
    }
  }
}

function draw() {
  const [width, height] = SIZES[state.size];
  canvas.width = width;
  canvas.height = height;
  renderCover(ctx, width, height, state);
  syncPanelControls();
}

function drawWhenReady() {
  fontsReady.then(draw);
}

function syncPanelControls() {
  const transform = state.panels[state.selectedPanel] || defaultPanelState();
  zoomSlider.value = String(Math.round(transform.zoom * 100));
  zoomValueEl.textContent = `${Math.round(transform.zoom * 100)}%`;
  for (const thumb of photoStripEl.querySelectorAll('img')) {
    thumb.classList.toggle('selected', Number(thumb.dataset.photoIndex) === transform.photo);
  }
}

function refreshPhotoStrip() {
  photoStripEl.replaceChildren();
  state.photos.forEach((photo, index) => {
    const thumb = document.createElement('img');
    thumb.src = photo.url;
    thumb.alt = photo.name;
    thumb.title = `${photo.name} — click to put it in the selected panel`;
    thumb.dataset.photoIndex = String(index);
    thumb.addEventListener('click', () => {
      const transform = state.panels[state.selectedPanel];
      transform.photo = index;
      transform.zoom = 1;
      transform.dx = 0;
      transform.dy = 0;
      draw();
      setStatus(`Panel ${state.selectedPanel + 1} now shows ${photo.name}. Drag it to position, scroll to zoom.`);
    });
    photoStripEl.appendChild(thumb);
  });
  photoCountEl.textContent =
    state.photos.length === 0
      ? 'No photos loaded yet.'
      : `${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded — click a thumbnail, then a panel.`;
}

function loadPhotos(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith('image/'));
  if (files.length === 0) {
    setStatus('That file is not an image — pick a photo to load.');
    return;
  }
  let pending = files.length;
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      state.photos.push({ name: file.name, url, image });
      pending -= 1;
      if (pending === 0) {
        assignPhotos();
        refreshPhotoStrip();
        draw();
        setStatus(
          `${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded across ${panelCount()} panel${panelCount() > 1 ? 's' : ''}. Click a panel to select it, drag to move its photo.`,
        );
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      pending -= 1;
      setStatus(`Could not read ${file.name} — try another photo.`);
    };
    image.src = url;
  }
}

function wirePicker(pickerId, key, values) {
  const picker = document.getElementById(pickerId);
  picker.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const value = button.dataset[key];
    if (!values.includes(value)) return;
    state[key] = value;
    for (const btn of picker.querySelectorAll('button')) {
      btn.classList.toggle('active', btn === button);
    }
    if (key === 'layout') {
      state.selectedPanel = 0;
      assignPhotos();
    }
    draw();
    setStatus(`${key} set to ${button.textContent.trim()}.`);
  });
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
    rect,
    scaleX,
    scaleY,
  };
}

function clampSelectedPan() {
  const layout = LAYOUTS[state.layout];
  const panel = layout.panels[state.selectedPanel];
  const transform = state.panels[state.selectedPanel];
  const photo = state.photos[transform.photo];
  if (panel && photo) clampPan(panel, photo.image, transform);
}

// --- canvas interaction: select / pan / zoom / swap ---

let drag = null; // { panel, lastX, lastY }

canvas.addEventListener('pointerdown', (event) => {
  const { x, y } = canvasPoint(event);
  const panel = panelAt(state, x, y, canvas.width, canvas.height);
  if (panel < 0) return;
  state.selectedPanel = panel;
  drag = { panel, lastX: x, lastY: y, moved: false };
  canvas.setPointerCapture(event.pointerId);
  draw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const { x, y, rect, scaleX } = canvasPoint(event);
  const layout = LAYOUTS[state.layout];
  const panel = layout.panels[drag.panel];
  const transform = state.panels[drag.panel];
  const photo = state.photos[transform.photo];
  if (!panel || !photo) {
    drag = null;
    return;
  }
  const dxPixels = x - drag.lastX;
  const dyPixels = y - drag.lastY;
  if (Math.abs(dxPixels) + Math.abs(dyPixels) > 0.5) drag.moved = true;
  transform.dx += dxPixels / (panel.w * canvas.width);
  transform.dy += dyPixels / (panel.h * canvas.height);
  clampPan(panel, photo.image, transform);
  drag.lastX = x;
  drag.lastY = y;
  void rect;
  void scaleX;
  draw();
});

canvas.addEventListener('pointerup', () => {
  drag = null;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const { x, y } = canvasPoint(event);
  const panel = panelAt(state, x, y, canvas.width, canvas.height);
  if (panel >= 0) state.selectedPanel = panel;
  const transform = state.panels[state.selectedPanel];
  const layout = LAYOUTS[state.layout];
  const photo = state.photos[transform.photo];
  if (!photo) return;
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  transform.zoom = Math.max(1, Math.min(3, transform.zoom * factor));
  clampPan(layout.panels[state.selectedPanel], photo.image, transform);
  draw();
}, { passive: false });

canvas.addEventListener('dblclick', (event) => {
  const { x, y } = canvasPoint(event);
  const panel = panelAt(state, x, y, canvas.width, canvas.height);
  if (panel < 0 || state.photos.length < 2) return;
  const transform = state.panels[panel];
  transform.photo = (transform.photo + 1) % state.photos.length;
  transform.zoom = 1;
  transform.dx = 0;
  transform.dy = 0;
  state.selectedPanel = panel;
  draw();
  setStatus(`Panel ${panel + 1} now shows ${state.photos[transform.photo].name}.`);
});

// --- controls ---

document.getElementById('photo-input').addEventListener('change', (event) => {
  loadPhotos(event.target.files);
  event.target.value = '';
});

document.getElementById('title-input').addEventListener('input', (event) => {
  state.title = event.target.value;
  draw();
});

document.getElementById('subtitle-input').addEventListener('input', (event) => {
  state.subtitle = event.target.value;
  draw();
});

zoomSlider.addEventListener('input', () => {
  const transform = state.panels[state.selectedPanel];
  const photo = state.photos[transform.photo];
  transform.zoom = Number(zoomSlider.value) / 100;
  if (photo) clampSelectedPan();
  draw();
});

resetPanelBtn.addEventListener('click', () => {
  const transform = state.panels[state.selectedPanel];
  const photoIndex = transform.photo;
  state.panels[state.selectedPanel] = { ...defaultPanelState(), photo: photoIndex };
  draw();
  setStatus(`Panel ${state.selectedPanel + 1} reset to cover-fit.`);
});

document.getElementById('shuffle-btn').addEventListener('click', () => {
  const layouts = LAYOUT_KEYS.filter((layout) => layout !== state.layout);
  const grades = GRADE_KEYS.filter((grade) => grade !== state.grade);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  // Shuffle which photo sits in each panel, too.
  if (state.photos.length > 0) {
    for (let i = 0; i < panelCount(); i++) {
      state.panels[i].photo = Math.floor(Math.random() * state.photos.length);
      state.panels[i].zoom = 1;
      state.panels[i].dx = 0;
      state.panels[i].dy = 0;
    }
  }
  state.selectedPanel = 0;
  document.querySelectorAll('#layout-picker button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grade-picker button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.grade === state.grade);
  });
  draw();
  setStatus(`Shuffled to ${LAYOUTS[state.layout].label} / ${GRADES[state.grade].label}.`);
});

exportBtn.addEventListener('click', async () => {
  exportBtn.disabled = true;
  setStatus(`Exporting ${state.size} PNG…`);
  try {
    await fontsReady;
    const blob = await exportCoverPNG(state, state.size);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vice-city-cover-${state.size}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    const kb = Math.round(blob.size / 1024);
    setStatus(`Exported vice-city-cover-${state.size}.png (${blob.size.toLocaleString()} bytes, ${kb} KB). Saved to your downloads.`);
  } catch (error) {
    setStatus(`Export failed: ${error.message} — try again.`);
  } finally {
    exportBtn.disabled = false;
  }
});

wirePicker('layout-picker', 'layout', LAYOUT_KEYS);
wirePicker('grade-picker', 'grade', GRADE_KEYS);
wirePicker('size-picker', 'size', SIZE_KEYS);

drawWhenReady();

// Small test hook for the headless verification runs (chunk 2/3): lets a
// script load photos and trigger an export without a real file picker.
// It exposes no network access and changes nothing about the app itself.
window.__coverStudio = { state, draw, loadPhotos, exportCoverPNG };
