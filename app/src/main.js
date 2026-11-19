// Vice City Cover Studio — the editor.
//
// Wires the cover engine to the page: photo loading, panel picking and
// dragging, layout / grade / caption controls, PNG export in the three post
// sizes, and the ?shot= and ?selftest= modes the screenshots and the
// verification run use. Photos are read with FileReader / <img> on this
// machine only and are never sent anywhere.

import { SIZES, LAYOUTS, GRADES, layoutById, gradeById, defaultState, retargetPanels, fillAllPanelsWith, drawCover, renderCoverPNG } from './cover.js';

const $ = (sel) => document.querySelector(sel);
const preview = $('#preview');
const previewCtx = preview.getContext('2d');

let photos = []; // { name, img, url }
let state = defaultState([]);
let selectedPanel = 0;
let lastRects = [];
let drag = null; // { panel, x, y, cx, cy } while a panel is dragged

const SAMPLES = [
  { name: 'Boulevard', url: 'samples/boulevard.jpg' },
  { name: 'Pier', url: 'samples/pier.jpg' },
];

function loadImage(url, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ name, img, url });
    img.onerror = () => reject(new Error(`could not load ${name}`));
    img.src = url;
  });
}

async function loadSamples() {
  for (const s of SAMPLES) {
    try {
      photos.push(await loadImage(s.url, s.name));
    } catch (err) {
      console.warn(err.message);
    }
  }
  if (photos.length && state.panels.every((p) => p.photo < 0)) {
    state = defaultState(photos);
  }
}

function previewSize() {
  const size = SIZES[state.sizeKey] ?? SIZES.square;
  const maxW = 620;
  const scale = Math.min(1, maxW / size.w);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function renderPreview() {
  const { w, h } = previewSize();
  preview.width = w;
  preview.height = h;
  preview.style.aspectRatio = `${w} / ${h}`;
  const imgs = photos.map((p) => p.img);
  lastRects = drawCover(previewCtx, w, h, state, imgs);
  highlightSelectedPanel();
  $('#photoCount').textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} loaded`;
}

function highlightSelectedPanel() {
  const r = lastRects[selectedPanel];
  if (!r) return;
  previewCtx.save();
  previewCtx.strokeStyle = '#ffe259';
  previewCtx.lineWidth = 3;
  previewCtx.setLineDash([10, 6]);
  previewCtx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  previewCtx.setLineDash([]);
  previewCtx.restore();
}

// ---------------------------------------------------------------- controls

function buildPickers() {
  const layoutBox = $('#layoutPicker');
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.id = l.id;
    b.innerHTML = `<strong>${l.name}</strong><span>${l.hint}</span>`;
    b.addEventListener('click', () => {
      state.layoutId = l.id;
      retargetPanels(state, photos);
      selectedPanel = 0;
      syncControls();
      renderPreview();
    });
    layoutBox.appendChild(b);
  }

  const gradeBox = $('#gradePicker');
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick grade';
    b.dataset.id = g.id;
    b.innerHTML = `<i style="background:linear-gradient(135deg,${g.title[0]},${g.title[1]} 55%,${g.title[2]})"></i><strong>${g.name}</strong>`;
    b.addEventListener('click', () => {
      state.gradeId = g.id;
      syncControls();
      renderPreview();
    });
    gradeBox.appendChild(b);
  }

  const sizeBox = $('#sizePicker');
  for (const [key, s] of Object.entries(SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.id = key;
    b.innerHTML = `<strong>${s.label.split(' · ')[0]}</strong><span>${s.label.split(' · ')[1] ?? ''}</span>`;
    b.addEventListener('click', () => {
      state.sizeKey = key;
      syncControls();
      renderPreview();
    });
    sizeBox.appendChild(b);
  }
}

function syncControls() {
  for (const [box, value] of [
    ['#layoutPicker', state.layoutId],
    ['#gradePicker', state.gradeId],
    ['#sizePicker', state.sizeKey],
  ]) {
    for (const b of document.querySelectorAll(`${box} .pick`)) {
      b.classList.toggle('active', b.dataset.id === value);
    }
  }
  $('#titleInput').value = state.title;
  $('#subtitleInput').value = state.subtitle;
  $('#badgeInput').value = state.badge;
  syncPanelControls();
}

function syncPanelControls() {
  const p = state.panels[selectedPanel];
  const photoBox = $('#panelPhoto');
  photoBox.innerHTML = '';
  if (!p) return;
  const none = document.createElement('option');
  none.value = '-1';
  none.textContent = 'Empty panel';
  photoBox.appendChild(none);
  photos.forEach((ph, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `Photo ${i + 1} — ${ph.name}`;
    photoBox.appendChild(o);
  });
  photoBox.value = String(p.photo);
  $('#zoomRange').value = String(p.zoom);
  $('#zoomValue').textContent = `${Math.round(p.zoom * 100)}%`;
  $('#panelLabel').textContent = `Panel ${selectedPanel + 1} of ${state.panels.length}`;
}

function buildPhotoList() {
  const list = $('#photoList');
  list.innerHTML = '';
  photos.forEach((ph, i) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    const img = document.createElement('img');
    img.src = ph.url;
    img.alt = ph.name;
    const cap = document.createElement('span');
    cap.textContent = `Photo ${i + 1} · ${ph.name}`;
    const fill = document.createElement('button');
    fill.type = 'button';
    fill.textContent = 'Fill all panels';
    fill.addEventListener('click', () => {
      fillAllPanelsWith(state, i);
      renderPreview();
    });
    d.append(img, cap, fill);
    list.appendChild(d);
  });
}

async function addFiles(files) {
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    try {
      photos.push(await loadImage(url, file.name.replace(/\.[^.]+$/, '')));
      added++;
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  if (added) {
    retargetPanels(state, photos);
    buildPhotoList();
    syncPanelControls();
    renderPreview();
  }
  return added;
}

// ---------------------------------------------------------------- export

async function exportPNG(sizeKey) {
  const btn = $('#exportBtn');
  btn.disabled = true;
  btn.textContent = 'Exporting…';
  try {
    const blob = await renderCoverPNG(state, photos.map((p) => p.img), sizeKey);
    const size = SIZES[sizeKey];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-cover-${size.w}x${size.h}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    $('#exportNote').textContent = `Saved ${size.w} × ${size.h} PNG · ${Math.round(blob.size / 1024)} KB`;
  } catch (err) {
    $('#exportNote').textContent = `Export failed: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Export PNG';
  }
}

function shuffleCover() {
  state.layoutId = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)].id;
  state.gradeId = GRADES[Math.floor(Math.random() * GRADES.length)].id;
  retargetPanels(state, photos);
  selectedPanel = 0;
  syncControls();
  renderPreview();
}

// ---------------------------------------------------------------- panel dragging

function panelAt(cx, cy) {
  const rect = preview.getBoundingClientRect();
  const x = ((cx - rect.left) / rect.width) * preview.width;
  const y = ((cy - rect.top) / rect.height) * preview.height;
  for (let i = lastRects.length - 1; i >= 0; i--) {
    const r = lastRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function bindPointer() {
  preview.addEventListener('pointerdown', (e) => {
    const i = panelAt(e.clientX, e.clientY);
    if (i < 0) return;
    selectedPanel = i;
    const p = state.panels[i];
    drag = { panel: i, x: e.clientX, y: e.clientY, cx: p.cx, cy: p.cy };
    preview.setPointerCapture(e.pointerId);
    syncPanelControls();
    renderPreview();
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = lastRects[drag.panel];
    const p = state.panels[drag.panel];
    if (!r || !p || p.photo < 0) return;
    const rect = preview.getBoundingClientRect();
    const dxPx = ((e.clientX - drag.x) / rect.width) * preview.width;
    const dyPx = ((e.clientY - drag.y) / rect.height) * preview.height;
    const img = photos[p.photo].img;
    const scale = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight) * p.zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    p.cx = Math.min(1, Math.max(0, drag.cx - dxPx / Math.max(1, dw - r.w)));
    p.cy = Math.min(1, Math.max(0, drag.cy - dyPx / Math.max(1, dh - r.h)));
    renderPreview();
  });
  const endDrag = () => {
    drag = null;
  };
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);
  preview.addEventListener('wheel', (e) => {
    const i = panelAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    const p = state.panels[i];
    p.zoom = Math.min(3, Math.max(1, p.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    selectedPanel = i;
    syncPanelControls();
    renderPreview();
  }, { passive: false });
}

// ---------------------------------------------------------------- shot modes

function applyQuery() {
  const q = new URLSearchParams(location.search);
  if (q.get('layout') && layoutById(q.get('layout'))) state.layoutId = q.get('layout');
  if (q.get('grade') && gradeById(q.get('grade'))) state.gradeId = q.get('grade');
  if (q.get('size') && SIZES[q.get('size')]) state.sizeKey = q.get('size');
  if (q.get('title')) state.title = q.get('title').slice(0, 24).toUpperCase();
  if (q.get('subtitle')) state.subtitle = q.get('subtitle').slice(0, 40);
  retargetPanels(state, photos);
}

// Full-window cover render, used for the exported-cover screenshots:
// the app draws the cover itself, at the window's size.
async function shotCoverMode() {
  const q = new URLSearchParams(location.search);
  const sizeKey = q.get('size') || 'wide';
  const size = SIZES[sizeKey] ?? SIZES.wide;
  document.body.classList.add('shot');
  const canvas = $('#shotCanvas');
  canvas.width = size.w > size.h ? 1280 : 1024;
  canvas.height = size.w > size.h ? 720 : 1280;
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  await document.fonts.load('80px Anton');
  await document.fonts.load('40px Pacifico');
  await document.fonts.ready;
  drawCover(canvas.getContext('2d'), canvas.width, canvas.height, state, photos.map((p) => p.img));
  document.title = `Cover ${size.w}x${size.h} ready`;
}

// Self-test: export all three post sizes, check each blob is a real PNG
// of the right dimensions, and report into the page for the verifier.
async function selfTest() {
  const out = $('#selftest');
  const lines = [];
  for (const [key, size] of Object.entries(SIZES)) {
    try {
      const blob = await renderCoverPNG(state, photos.map((p) => p.img), key);
      const buf = new Uint8Array(await blob.arrayBuffer());
      const pngMagic = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      const w = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
      const h = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23];
      const ok = pngMagic && w === size.w && h === size.h;
      lines.push(`${key}: ${ok ? 'OK' : 'FAIL'} png=${pngMagic} ${w}x${h} bytes=${blob.size}`);
    } catch (err) {
      lines.push(`${key}: FAIL ${err.message}`);
    }
  }
  out.textContent = lines.join('\n');
  document.title = lines.every((l) => l.includes('OK')) ? 'SELFTEST PASS' : 'SELFTEST FAIL';
}

// ---------------------------------------------------------------- boot

async function boot() {
  buildPickers();
  await loadSamples();
  state = defaultState(photos);
  applyQuery();
  syncControls();
  buildPhotoList();
  renderPreview();

  $('#fileInput').addEventListener('change', (e) => addFiles([...e.target.files]));
  $('#dropZone').addEventListener('click', () => $('#fileInput').click());
  $('#titleInput').addEventListener('input', (e) => {
    state.title = e.target.value.toUpperCase();
    renderPreview();
  });
  $('#subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    renderPreview();
  });
  $('#badgeInput').addEventListener('input', (e) => {
    state.badge = e.target.value.toUpperCase();
    renderPreview();
  });
  $('#panelPhoto').addEventListener('change', (e) => {
    state.panels[selectedPanel].photo = Number(e.target.value);
    renderPreview();
  });
  $('#zoomRange').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value);
    $('#zoomValue').textContent = `${Math.round(Number(e.target.value) * 100)}%`;
    renderPreview();
  });
  $('#exportBtn').addEventListener('click', () => exportPNG(state.sizeKey));
  $('#shuffleBtn').addEventListener('click', shuffleCover);
  bindPointer();

  const q = new URLSearchParams(location.search);
  if (q.get('shot') === 'cover') {
    await shotCoverMode();
  } else if (q.get('selftest') === '1') {
    await selfTest();
  }
}

boot();
