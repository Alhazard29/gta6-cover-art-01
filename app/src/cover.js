// Vice City Cover Studio — cover engine (chunk 2, written fresh).
//
// Renders the multi-panel GTA-style poster onto any 2D canvas: five panel
// layouts, five Vice City colour grades, per-panel photo crop / pan / zoom,
// procedural sunset art for empty panels, and bold display lettering.
// Every drawn motif (sun, skyline, palms) is original code — no Rockstar
// logo, artwork or font. Display fonts are Anton + Pacifico, SIL OFL 1.1,
// bundled locally under app/fonts/.
//
// The engine is pure canvas: no network, no DOM beyond the canvas it is
// handed, so the exported PNG is exactly what the preview shows.

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

// Panels are fractions of the canvas (x, y, w, h in 0..1). `title` is the
// zone the caption lives in; when `overlay` is true the title sits on top
// of the panels over a dark scrim, otherwise the panels leave it clear.
export const LAYOUTS = {
  'vice-grid': {
    label: 'Vice Grid',
    panels: [
      { x: 0.03, y: 0.03, w: 0.465, h: 0.3 },
      { x: 0.515, y: 0.03, w: 0.455, h: 0.3 },
      { x: 0.03, y: 0.345, w: 0.465, h: 0.3 },
      { x: 0.515, y: 0.345, w: 0.455, h: 0.3 },
    ],
    title: { x: 0.03, y: 0.68, w: 0.94, h: 0.29, overlay: false },
  },
  'four-panel': {
    label: 'Four Panel',
    panels: [
      { x: 0, y: 0, w: 0.496, h: 0.496 },
      { x: 0.504, y: 0, w: 0.496, h: 0.496 },
      { x: 0, y: 0.504, w: 0.496, h: 0.496 },
      { x: 0.504, y: 0.504, w: 0.496, h: 0.496 },
    ],
    title: { x: 0, y: 0.78, w: 1, h: 0.22, overlay: true },
  },
  'nine-grid': {
    label: 'Nine Grid',
    panels: [
      { x: 0.03, y: 0.03, w: 0.3067, h: 0.21 },
      { x: 0.3467, y: 0.03, w: 0.3067, h: 0.21 },
      { x: 0.6633, y: 0.03, w: 0.3067, h: 0.21 },
      { x: 0.03, y: 0.255, w: 0.3067, h: 0.21 },
      { x: 0.3467, y: 0.255, w: 0.3067, h: 0.21 },
      { x: 0.6633, y: 0.255, w: 0.3067, h: 0.21 },
      { x: 0.03, y: 0.48, w: 0.3067, h: 0.21 },
      { x: 0.3467, y: 0.48, w: 0.3067, h: 0.21 },
      { x: 0.6633, y: 0.48, w: 0.3067, h: 0.21 },
    ],
    title: { x: 0.03, y: 0.72, w: 0.94, h: 0.25, overlay: false },
  },
  'full-bleed': {
    label: 'Full Bleed',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
    title: { x: 0, y: 0.76, w: 1, h: 0.24, overlay: true },
  },
  'triple-strip': {
    label: 'Triple Strip',
    panels: [
      { x: 0.03, y: 0.03, w: 0.3067, h: 0.64 },
      { x: 0.3467, y: 0.03, w: 0.3067, h: 0.64 },
      { x: 0.6633, y: 0.03, w: 0.3067, h: 0.64 },
    ],
    title: { x: 0.03, y: 0.7, w: 0.94, h: 0.27, overlay: false },
  },
};

// A grade is a sky gradient, a wash colour painted over photos, the
// canvas filter applied to photos, and the caption colours.
export const GRADES = {
  'vice-sunset': {
    label: 'Vice Sunset',
    sky: ['#ffd166', '#ff7a3d', '#ff4d6d', '#7a1e6e'],
    wash: '#ff5e78',
    washMode: 'overlay',
    washAlpha: 0.32,
    photoFilter: 'saturate(1.25) contrast(1.08)',
    title: '#fff3d6',
    titleStroke: '#2a0a4a',
    subtitle: '#ffe9d6',
    accent: '#ffb347',
    frame: '#ff7a3d',
  },
  'neon-nights': {
    label: 'Neon Nights',
    sky: ['#0b1035', '#3b1d7a', '#7b2ff7', '#ff2e88'],
    wash: '#00e5ff',
    washMode: 'overlay',
    washAlpha: 0.3,
    photoFilter: 'saturate(1.35) contrast(1.12)',
    title: '#e8fbff',
    titleStroke: '#12083a',
    subtitle: '#c9f6ff',
    accent: '#00e5ff',
    frame: '#ff2e88',
  },
  'palm-dusk': {
    label: 'Palm Dusk',
    sky: ['#ffe29a', '#ef8354', '#ef476f', '#2a1a5e'],
    wash: '#b388ff',
    washMode: 'soft-light',
    washAlpha: 0.4,
    photoFilter: 'saturate(1.15) contrast(1.05)',
    title: '#fff8e7',
    titleStroke: '#241040',
    subtitle: '#ffe9c9',
    accent: '#ffd166',
    frame: '#ef476f',
  },
  noir: {
    label: 'Noir',
    sky: ['#5a5a5a', '#2e2e2e', '#141414', '#000000'],
    wash: '#ffffff',
    washMode: 'soft-light',
    washAlpha: 0.25,
    photoFilter: 'grayscale(1) contrast(1.18) brightness(0.96)',
    title: '#f2f2f2',
    titleStroke: '#000000',
    subtitle: '#d8d8d8',
    accent: '#e8e8e8',
    frame: '#8a8a8a',
  },
  'candy-pop': {
    label: 'Candy Pop',
    sky: ['#a5f3fc', '#f9a8d4', '#c084fc', '#38bdf8'],
    wash: '#ff6b9d',
    washMode: 'overlay',
    washAlpha: 0.28,
    photoFilter: 'saturate(1.7) contrast(1.06)',
    title: '#ffffff',
    titleStroke: '#3b0764',
    subtitle: '#fdf2ff',
    accent: '#fde047',
    frame: '#ff6b9d',
  },
};

// Per-panel photo state: which photo (index into state.photos, -1 = none),
// zoom (1 = cover-fit) and pan offsets as fractions of the panel size.
export function defaultPanelState() {
  return { photo: -1, zoom: 1, dx: 0, dy: 0 };
}

// Keep a pan offset inside the photo so the panel never shows a gap.
export function clampPan(panel, image, transform) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  // Cover-fit scale relative to the panel: the drawn image is at least as
  // big as the panel on both axes; zoom enlarges it further. Slack is the
  // fraction of the panel the image can slide before an edge shows.
  const drawnW = panel.w * Math.max(1, (panel.h * imageRatio) / panel.w) * transform.zoom;
  const drawnH = panel.h * Math.max(1, panel.w / (panel.h * imageRatio)) * transform.zoom;
  const maxDx = Math.max(0, (drawnW - panel.w) / 2 / panel.w);
  const maxDy = Math.max(0, (drawnH - panel.h) / 2 / panel.h);
  transform.dx = Math.max(-maxDx, Math.min(maxDx, transform.dx));
  transform.dy = Math.max(-maxDy, Math.min(maxDy, transform.dy));
  return transform;
}

// Which panel (index) contains the point (x, y) in canvas pixels, or -1.
export function panelAt(state, x, y, width, height) {
  const layout = LAYOUTS[state.layout];
  for (let i = 0; i < layout.panels.length; i++) {
    const p = layout.panels[i];
    if (
      x >= p.x * width &&
      x < (p.x + p.w) * width &&
      y >= p.y * height &&
      y < (p.y + p.h) * height
    ) {
      return i;
    }
  }
  return -1;
}

// ---- procedural Vice City art for empty panels (original, drawn in code) ----

function drawSun(ctx, cx, cy, r, grade) {
  const sunGrad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  sunGrad.addColorStop(0, grade.sky[0]);
  sunGrad.addColorStop(0.6, grade.sky[1]);
  sunGrad.addColorStop(1, grade.sky[2]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sunGrad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Synthwave slits across the lower half of the sun.
  ctx.fillStyle = grade.sky[3];
  let slitY = cy + r * 0.08;
  let slitH = r * 0.045;
  while (slitY < cy + r) {
    ctx.fillRect(cx - r, slitY, r * 2, slitH);
    slitY += slitH + r * 0.16;
    slitH *= 1.5;
  }
  ctx.restore();
}

function drawPalm(ctx, x, baseY, h, lean, colour) {
  // A simple original palm silhouette: curved trunk + seven fronds.
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, h * 0.03);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * h * 0.25, baseY - h * 0.55, x + lean * h * 0.3, baseY - h);
  ctx.stroke();
  const topX = x + lean * h * 0.3;
  const topY = baseY - h;
  for (let i = 0; i < 7; i++) {
    const angle = -Math.PI * (0.08 + (i / 6) * 0.84) + lean * 0.25;
    const len = h * (0.42 - Math.abs(i - 3) * 0.035);
    const endX = topX + Math.cos(angle) * len;
    const endY = topY + Math.sin(angle) * len * 0.9 + h * 0.12;
    ctx.lineWidth = Math.max(1.5, h * 0.018);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(angle) * len * 0.5,
      topY + Math.sin(angle) * len * 0.5 + h * 0.1,
      endX,
      endY,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkyline(ctx, x, y, w, h, colour) {
  // Blocky low-rise skyline, deterministic per panel from a tiny hash.
  ctx.fillStyle = colour;
  let bx = x;
  let seed = Math.floor(x * 7 + y * 13 + w) || 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  while (bx < x + w) {
    const bw = w * (0.09 + rand() * 0.12);
    const bh = h * (0.25 + rand() * 0.55);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    bx += bw + w * 0.015;
  }
}

function drawEmptyPanel(ctx, px, py, pw, ph, grade, seedIndex) {
  const sky = ctx.createLinearGradient(0, py, 0, py + ph);
  grade.sky.forEach((colour, i) => {
    sky.addColorStop(i / (grade.sky.length - 1), colour);
  });
  ctx.fillStyle = sky;
  ctx.fillRect(px, py, pw, ph);

  const sunR = Math.min(pw, ph) * 0.26;
  const sunX = px + pw * (0.3 + (seedIndex % 3) * 0.2);
  const sunY = py + ph * 0.42;
  drawSun(ctx, sunX, sunY, sunR, grade);

  // Distant skyline + near palms, silhouetted in the darkest sky colour.
  drawSkyline(ctx, px, py + ph * 0.62, pw, ph * 0.38, grade.sky[3]);
  const palmH = ph * (0.34 + (seedIndex % 2) * 0.1);
  drawPalm(ctx, px + pw * 0.12, py + ph, palmH, seedIndex % 2 === 0 ? -0.4 : 0.4, grade.sky[3]);
  drawPalm(ctx, px + pw * 0.88, py + ph, palmH * 0.8, seedIndex % 2 === 0 ? 0.35 : -0.35, grade.sky[3]);
}

// ---- photo panels ----

function drawPhotoPanel(ctx, px, py, pw, ph, image, transform, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  const imageRatio = image.naturalWidth / image.naturalHeight;
  const panelRatio = pw / ph;
  let drawW;
  let drawH;
  if (imageRatio > panelRatio) {
    drawH = ph;
    drawW = ph * imageRatio;
  } else {
    drawW = pw;
    drawH = pw / imageRatio;
  }
  drawW *= transform.zoom;
  drawH *= transform.zoom;
  const dx = px + (pw - drawW) / 2 + transform.dx * pw;
  const dy = py + (ph - drawH) / 2 + transform.dy * ph;

  ctx.filter = grade.photoFilter;
  ctx.drawImage(image, dx, dy, drawW, drawH);
  ctx.filter = 'none';

  // Grade wash over the photo, then a bottom vignette for caption legibility.
  ctx.globalCompositeOperation = grade.washMode;
  ctx.globalAlpha = grade.washAlpha;
  ctx.fillStyle = grade.wash;
  ctx.fillRect(px, py, pw, ph);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const vignette = ctx.createLinearGradient(0, py + ph * 0.55, 0, py + ph);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(px, py + ph * 0.55, pw, ph * 0.45);
  ctx.restore();
}

// ---- caption ----

function fitLines(ctx, text, maxWidth, startSize, fontFamily) {
  const words = text.split(/\s+/).filter(Boolean);
  let size = startSize;
  while (size > 12) {
    ctx.font = `${size}px "${fontFamily}", sans-serif`;
    const lines = [];
    let line = '';
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width <= maxWidth || !line) {
        line = trial;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= maxWidth || lines.length === 1) return { lines, size };
    size = Math.floor(size * 0.92);
  }
  ctx.font = `${size}px "${fontFamily}", sans-serif`;
  return { lines: [text], size };
}

function drawCaption(ctx, zone, width, height, state, grade) {
  const zx = zone.x * width;
  const zy = zone.y * height;
  const zw = zone.w * width;
  const zh = zone.h * height;

  if (zone.overlay) {
    const scrim = ctx.createLinearGradient(0, zy - zh * 0.35, 0, zy + zh);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(0.45, 'rgba(0,0,0,0.55)');
    scrim.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, zy - zh * 0.35, width, zh * 1.35);
  }

  const title = (state.title || '').trim();
  const subtitle = (state.subtitle || '').trim();
  const cx = zx + zw / 2;

  if (title) {
    const startSize = Math.round(Math.min(zw * 0.16, zh * (subtitle ? 0.42 : 0.58)));
    const { lines, size } = fitLines(ctx, title.toUpperCase(), zw * 0.96, startSize, 'Anton');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try {
      ctx.letterSpacing = '0.03em';
    } catch {
      // letterSpacing is Chrome-only; harmless to skip elsewhere.
    }
    const lineHeight = size * 1.04;
    const totalHeight = lineHeight * lines.length;
    let lineY = zy + (zh - totalHeight) / 2 + lineHeight / 2 - (subtitle ? size * 0.28 : 0);
    ctx.font = `${size}px "Anton", "Arial Black", sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = grade.titleStroke;
    ctx.fillStyle = grade.title;
    for (const line of lines) {
      ctx.strokeText(line, cx, lineY);
      ctx.fillText(line, cx, lineY);
      lineY += lineHeight;
    }
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // ignore
    }
    // Accent rule under the title.
    const ruleW = Math.min(zw * 0.4, size * 6);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(cx - ruleW / 2, zy + zh * (subtitle ? 0.68 : 0.78), ruleW, Math.max(3, height * 0.004));
  }

  if (subtitle) {
    const subSize = Math.round(Math.min(zw * 0.045, zh * 0.16));
    ctx.font = `${subSize}px "Pacifico", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grade.subtitle;
    ctx.fillText(subtitle, cx, zy + zh * 0.86);
  }
}

// ---- main render ----

// Draw the whole cover onto `ctx` at the given pixel size.
// `state`: { layout, grade, title, subtitle, photos: [{image}], panels:
// [{ photo, zoom, dx, dy }], selectedPanel }.
export function renderCover(ctx, width, height, state) {
  const layout = LAYOUTS[state.layout];
  const grade = GRADES[state.grade];

  // Backdrop: grade sky, so gutters and title bands are never bare.
  const backdrop = ctx.createLinearGradient(0, 0, 0, height);
  grade.sky.forEach((colour, i) => {
    backdrop.addColorStop(i / (grade.sky.length - 1), colour);
  });
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  const panels = layout.panels;
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    const px = p.x * width;
    const py = p.y * height;
    const pw = p.w * width;
    const ph = p.h * height;
    const transform = state.panels[i] || defaultPanelState();
    const photo = transform.photo >= 0 ? state.photos[transform.photo] : null;
    if (photo && photo.image) {
      drawPhotoPanel(ctx, px, py, pw, ph, photo.image, transform, grade);
    } else {
      drawEmptyPanel(ctx, px, py, pw, ph, grade, i);
    }
    // White poster border around each panel.
    ctx.lineWidth = Math.max(2, width * 0.003);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeRect(px, py, pw, ph);
    // Selected panel gets an accent outline (preview only, not export).
    if (state.selectedPanel === i && state.showSelection) {
      ctx.lineWidth = Math.max(3, width * 0.006);
      ctx.strokeStyle = grade.accent;
      ctx.strokeRect(px - 2, py - 2, pw + 4, ph + 4);
    }
  }

  drawCaption(ctx, layout.title, width, height, state, grade);

  // Outer frame.
  ctx.lineWidth = Math.max(3, width * 0.006);
  ctx.strokeStyle = grade.frame;
  ctx.strokeRect(
    ctx.lineWidth / 2,
    ctx.lineWidth / 2,
    width - ctx.lineWidth,
    height - ctx.lineWidth,
  );
}

// Render the cover at an export size and return a PNG Blob.
export async function exportCoverPNG(state, sizeKey) {
  const [width, height] = SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const cleanState = { ...state, selectedPanel: -1, showSelection: false };
  renderCover(ctx, width, height, cleanState);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))),
      'image/png',
    );
  });
}
