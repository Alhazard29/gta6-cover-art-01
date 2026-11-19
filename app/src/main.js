/* Vice Cover Studio — app shell (round 4 chunk A).
 *
 * Skeleton only: wires the controls, draws a Vice City sunset poster with
 * the caption in system fonts, and exports the canvas as PNG. The full
 * cover engine (5 layouts, 5 grades, per-panel photos, crop/position)
 * lands in chunk B, in cover.js.
 *
 * Fonts: system fonts ONLY — the CSS display stack ("Arial Black",
 * "Impact", ...) and the serif-italic stack (Georgia, ...). No font
 * files are loaded and no webfont loading is used, no external requests.
 */

'use strict';

const DISPLAY_FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';
const SCRIPT_FONT = 'italic Georgia, "Times New Roman", serif';
const UI_FONT = '"Helvetica Neue", Arial, sans-serif';

const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

const GRADES = {
  sunset: { skyTop: '#2b0a4a', skyMid: '#ff2e88', skyLow: '#ffb347', sun: '#fff3c4', ground: '#160327' },
  neon: { skyTop: '#05021a', skyMid: '#7b2fff', skyLow: '#2de2ff', sun: '#ff2e88', ground: '#0a0212' },
  pastel: { skyTop: '#f7c8d8', skyMid: '#ffb347', skyLow: '#ffe9a8', sun: '#fff7ec', ground: '#5b2a4a' },
  mono: { skyTop: '#111111', skyMid: '#555555', skyLow: '#bbbbbb', sun: '#ffffff', ground: '#000000' },
  gold: { skyTop: '#3a1c00', skyMid: '#ff7b00', skyLow: '#ffd166', sun: '#fffbe6', ground: '#1c0d02' },
};

const state = {
  photo: null, // HTMLImageElement | null
  caption: 'VICE CITY',
  subtitle: 'Streets of Leonida',
  layout: 'poster',
  grade: 'sunset',
  size: '1080x1080',
};

const $ = (id) => document.getElementById(id);
const canvas = $('coverCanvas');
const ctx = canvas.getContext('2d');

function currentSize() {
  return SIZES[state.size] || SIZES['1080x1080'];
}

/** Draw the photo cover-fit across the whole canvas, or a plain sky. */
function drawBackdrop(w, h, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.55, grade.skyMid);
  sky.addColorStop(1, grade.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (state.photo) {
    const img = state.photo;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    // Sunset wash over the photo so it reads as poster art.
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(255,46,136,0.12)');
    wash.addColorStop(1, 'rgba(255,179,71,0.28)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Setting sun + horizon band, the poster's anchor. */
function drawSun(w, h, grade) {
  const cx = w * 0.5;
  const cy = h * 0.58;
  const r = Math.min(w, h) * 0.17;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.1);
  glow.addColorStop(0, grade.sun);
  glow.addColorStop(0.35, grade.skyLow);
  glow.addColorStop(1, 'rgba(255,46,136,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.1, cy - r * 2.1, r * 4.2, r * 4.2);
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = grade.ground;
  ctx.fillRect(0, cy + r * 0.55, w, h - cy - r * 0.55);
}

/** Fit a line of display type to the canvas width. */
function fitDisplayFont(text, maxWidth, startPx) {
  let px = startPx;
  ctx.font = `900 ${px}px ${DISPLAY_FONT}`;
  while (px > 24 && ctx.measureText(text).width > maxWidth) {
    px -= 4;
    ctx.font = `900 ${px}px ${DISPLAY_FONT}`;
  }
  return px;
}

function drawCaption(w, h, grade) {
  const margin = w * 0.06;
  const caption = (state.caption || 'VICE CITY').toUpperCase();
  const px = fitDisplayFont(caption, w - margin * 2, Math.round(w * 0.13));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const y = h * 0.2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.round(w * 0.012);
  ctx.shadowOffsetY = Math.round(w * 0.008);
  const grad = ctx.createLinearGradient(0, y - px, 0, y + px * 0.15);
  grad.addColorStop(0, '#fff7ec');
  grad.addColorStop(0.5, '#ffb347');
  grad.addColorStop(1, '#ff2e88');
  ctx.fillStyle = grad;
  ctx.fillText(caption, w / 2, y);
  ctx.restore();

  if (state.subtitle) {
    const subPx = Math.max(20, Math.round(w * 0.032));
    ctx.font = `${subPx}px ${SCRIPT_FONT}`;
    ctx.fillStyle = '#fff7ec';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = Math.round(w * 0.006);
    ctx.shadowOffsetY = Math.round(w * 0.004);
    ctx.fillText(state.subtitle, w / 2, y + subPx * 1.9);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
}

function drawCover() {
  const [w, h] = currentSize();
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const grade = GRADES[state.grade] || GRADES.sunset;
  drawBackdrop(w, h, grade);
  drawSun(w, h, grade);
  drawCaption(w, h, grade);
}

function exportPng() {
  drawCover();
  const [w, h] = currentSize();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-cover-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

function wireControls() {
  $('photoInput').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.photo = img;
      URL.revokeObjectURL(url);
      drawCover();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  });
  $('captionInput').addEventListener('input', (event) => {
    state.caption = event.target.value;
    drawCover();
  });
  $('subtitleInput').addEventListener('input', (event) => {
    state.subtitle = event.target.value;
    drawCover();
  });
  $('layoutSelect').addEventListener('change', (event) => {
    state.layout = event.target.value;
    drawCover();
  });
  $('gradeSelect').addEventListener('change', (event) => {
    state.grade = event.target.value;
    drawCover();
  });
  $('sizeSelect').addEventListener('change', (event) => {
    state.size = event.target.value;
    drawCover();
  });
  $('exportBtn').addEventListener('click', exportPng);
}

wireControls();
drawCover();
