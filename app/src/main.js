// Vice City Cover Studio — editor skeleton (chunk 1).
//
// This module wires the editor chrome: photo loading, the layout / grade /
// size pickers, the caption fields, and a placeholder preview on the canvas.
// The real cover engine (multi-panel layout, per-panel crop/pan/zoom, colour
// grades, PNG export) is a separate module, src/cover.js, and lands in the
// next build step. Until then the preview draws a simple sunset placeholder
// so the skeleton can be opened and checked in a browser as-is.

const LAYOUTS = ['vice-grid', 'four-panel', 'nine-grid', 'full-bleed', 'triple-strip'];
const GRADES = ['vice-sunset', 'neon-nights', 'palm-dusk', 'noir', 'candy-pop'];
const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

// Placeholder grade palettes (top, middle, bottom) used only by the
// skeleton preview; the engine re-uses these names with full grading.
const GRADE_COLORS = {
  'vice-sunset': ['#ff9a3d', '#ff4d6d', '#7a1e6e'],
  'neon-nights': ['#00e5ff', '#7b2ff7', '#ff2e88'],
  'palm-dusk': ['#ffd166', '#ef476f', '#2a1a5e'],
  'noir': ['#3a3a3a', '#1c1c1c', '#000000'],
  'candy-pop': ['#ff6b9d', '#c084fc', '#38bdf8'],
};

const state = {
  layout: 'vice-grid',
  grade: 'vice-sunset',
  size: '1080x1080',
  title: 'VICE CITY',
  subtitle: 'My story, my streets',
  photos: [], // { name, url, image }
};

const canvas = document.getElementById('cover-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const photoCountEl = document.getElementById('photo-count');
const photoStripEl = document.getElementById('photo-strip');
const exportBtn = document.getElementById('export-btn');

function setStatus(text) {
  statusEl.textContent = text;
}

// Draw the skeleton placeholder: a vertical grade gradient, the title in
// big letters and the subtitle underneath. No photos, no panels yet.
function drawPlaceholder() {
  const [width, height] = SIZES[state.size];
  canvas.width = width;
  canvas.height = height;
  const [top, mid, bottom] = GRADE_COLORS[state.grade];
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.55, mid);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.textAlign = 'center';
  ctx.font = `900 ${Math.round(width * 0.09)}px "Arial Black", Arial, sans-serif`;
  ctx.fillText(state.title.toUpperCase(), width / 2, height * 0.52);
  ctx.font = `italic ${Math.round(width * 0.032)}px Georgia, serif`;
  ctx.fillText(state.subtitle, width / 2, height * 0.58);

  ctx.font = `${Math.round(width * 0.02)}px Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText('Skeleton preview — cover engine coming next', width / 2, height * 0.94);
}

function refreshPhotoStrip() {
  photoStripEl.replaceChildren();
  for (const photo of state.photos) {
    const thumb = document.createElement('img');
    thumb.src = photo.url;
    thumb.alt = photo.name;
    thumb.title = photo.name;
    photoStripEl.appendChild(thumb);
  }
  photoCountEl.textContent =
    state.photos.length === 0
      ? 'No photos loaded yet.'
      : `${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded.`;
}

function loadPhotos(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith('image/'));
  if (files.length === 0) {
    setStatus('That file is not an image — pick a photo to load.');
    return;
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      state.photos.push({ name: file.name, url, image });
      refreshPhotoStrip();
      setStatus(`${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded. Cover engine lands next — panels and export after that.`);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
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
    drawPlaceholder();
    setStatus(`${key} set to ${button.textContent.trim()}.`);
  });
}

document.getElementById('photo-input').addEventListener('change', (event) => {
  loadPhotos(event.target.files);
  event.target.value = '';
});

document.getElementById('title-input').addEventListener('input', (event) => {
  state.title = event.target.value;
  drawPlaceholder();
});

document.getElementById('subtitle-input').addEventListener('input', (event) => {
  state.subtitle = event.target.value;
  drawPlaceholder();
});

document.getElementById('shuffle-btn').addEventListener('click', () => {
  const layouts = LAYOUTS.filter((layout) => layout !== state.layout);
  const grades = GRADES.filter((grade) => grade !== state.grade);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  document.querySelectorAll('#layout-picker button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grade-picker button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.grade === state.grade);
  });
  drawPlaceholder();
  setStatus(`Shuffled to ${state.layout} / ${state.grade}.`);
});

exportBtn.addEventListener('click', () => {
  setStatus('Export is not wired yet — the cover engine (chunk 2) adds PNG export in 1080×1080, 1080×1350 and 1920×1080.');
});

wirePicker('layout-picker', 'layout', LAYOUTS);
wirePicker('grade-picker', 'grade', GRADES);
wirePicker('size-picker', 'size', Object.keys(SIZES));

drawPlaceholder();
