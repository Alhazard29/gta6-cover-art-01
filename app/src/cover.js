// Vice City Cover Studio — the cover engine.
//
// Pure canvas: given the user's photos and a state (layout, grade, caption,
// per-panel crop), it draws one GTA-poster-style cover on any 2D context.
// Nothing here touches the network; photos are drawn from memory only.

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080 · Square post' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350 · Portrait post' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080 · Wide post' },
};

// A layout is a list of panels, each a fraction of the cover (x, y, w, h)
// plus an optional tilt in degrees. The title block is drawn over the
// bottom of the cover on a scrim, whatever the layout.
export const LAYOUTS = [
  {
    id: 'vice-grid',
    name: 'Vice Grid',
    hint: 'Hero panel + three stacked scenes',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.34 },
      { x: 0.62, y: 0.34, w: 0.38, h: 0.33 },
      { x: 0.62, y: 0.67, w: 0.38, h: 0.33 },
    ],
  },
  {
    id: 'four-panel',
    name: 'Four Panel',
    hint: 'Classic 2 × 2 poster grid',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'nine-grid',
    name: 'Nine Grid',
    hint: 'Nine snapshots, one story',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
    ],
  },
  {
    id: 'full-bleed',
    name: 'Full Bleed',
    hint: 'One hero shot + a tilted snapshot',
    panels: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.58, y: 0.52, w: 0.36, h: 0.34, tilt: -6 },
    ],
  },
  {
    id: 'triple-strip',
    name: 'Triple Strip',
    hint: 'Three cinematic bands',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.4 },
      { x: 0, y: 0.4, w: 1, h: 0.3 },
      { x: 0, y: 0.7, w: 1, h: 0.3 },
    ],
  },
];

// A grade is a photo filter plus a tint gradient washed over the panels
// and the colours the title block is painted in.
export const GRADES = [
  {
    id: 'sunset',
    name: 'Vice City Sunset',
    filter: 'saturate(1.35) contrast(1.06) brightness(1.02)',
    tint: ['rgba(255,122,26,0.20)', 'rgba(255,46,136,0.22)'],
    title: ['#ffe259', '#ffa751', '#ff2e88'],
    scrim: 'rgba(20,4,32,0.72)',
  },
  {
    id: 'neon',
    name: 'Neon Nights',
    filter: 'saturate(1.5) contrast(1.12) brightness(0.96)',
    tint: ['rgba(0,229,255,0.20)', 'rgba(255,0,153,0.24)'],
    title: ['#7df9ff', '#b967ff', '#ff2e88'],
    scrim: 'rgba(2,8,32,0.72)',
  },
  {
    id: 'palm',
    name: 'Palm Dusk',
    filter: 'saturate(1.25) contrast(1.04) brightness(1.04)',
    tint: ['rgba(0,200,150,0.16)', 'rgba(255,170,40,0.20)'],
    title: ['#d4fc79', '#96e6a1', '#1f9d6b'],
    scrim: 'rgba(4,26,18,0.72)',
  },
  {
    id: 'noir',
    name: 'Noir',
    filter: 'saturate(0.25) contrast(1.18) brightness(0.98)',
    tint: ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.18)'],
    title: ['#ffffff', '#d8d8d8', '#8a8a8a'],
    scrim: 'rgba(0,0,0,0.78)',
  },
  {
    id: 'candy',
    name: 'Candy Pop',
    filter: 'saturate(1.8) contrast(1.08) brightness(1.05)',
    tint: ['rgba(255,0,128,0.18)', 'rgba(120,0,255,0.20)'],
    title: ['#ff9a9e', '#fecfef', '#a18cd1'],
    scrim: 'rgba(40,0,60,0.70)',
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

// A fresh state for a set of photos: hero panel takes photo 0, the rest
// cycle through the photos so one photo can fill every panel.
export function defaultState(photos) {
  const layout = layoutById('vice-grid');
  return {
    layoutId: 'vice-grid',
    gradeId: 'sunset',
    sizeKey: 'square',
    title: 'NEON SHORE',
    subtitle: 'sunset drive',
    badge: 'VICE CITY · 2026',
    panels: layout.panels.map((_, i) => ({
      photo: photos.length ? i % photos.length : -1,
      cx: 0.5,
      cy: 0.5,
      zoom: 1,
    })),
  };
}

// Retarget the panel list when the layout changes, keeping each panel's
// photo and crop where the panel counts still line up.
export function retargetPanels(state, photos) {
  const layout = layoutById(state.layoutId);
  const old = state.panels ?? [];
  state.panels = layout.panels.map((_, i) => {
    const prev = old[i] ?? old[0] ?? { photo: 0, cx: 0.5, cy: 0.5, zoom: 1 };
    return {
      photo: prev.photo >= 0 && prev.photo < photos.length ? prev.photo : photos.length ? i % photos.length : -1,
      cx: prev.cx ?? 0.5,
      cy: prev.cy ?? 0.5,
      zoom: prev.zoom ?? 1,
    };
  });
}

// Fill every panel with the same photo, keeping each panel's own crop.
export function fillAllPanelsWith(state, photoIndex) {
  for (const p of state.panels) p.photo = photoIndex;
}

// ---------------------------------------------------------------- drawing

let grainTile = null;
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 128;
  t.height = 128;
  const c = t.getContext('2d');
  const img = c.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 64);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  grainTile = ctx.createPattern(t, 'repeat');
  return grainTile;
}

// Draw one photo into a panel rect, cover-fit, panned by (cx, cy) and
// zoomed. Tilt rotates the panel around its own centre.
function drawPhotoPanel(ctx, img, rect, crop, filter) {
  const { x, y, w, h, tilt } = rect;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (tilt) ctx.rotate((tilt * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * crop.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = -(dw - w) * crop.cx;
  const dy = -(dh - h) * crop.cy;
  ctx.filter = filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  // A faint inner edge so panels read as separate shots.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();
}

function drawTint(ctx, W, H, grade) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, grade.tint[0]);
  g.addColorStop(1, grade.tint[1]);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawGrainAndVignette(ctx, W, H) {
  const pattern = grainPattern(ctx);
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawTitleBlock(ctx, W, H, state, grade) {
  const bandH = H * 0.24;
  const bandY = H - bandH;
  // Scrim so the lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, bandY - H * 0.06, 0, H);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(0.35, grade.scrim);
  scrim.addColorStop(1, grade.scrim);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY - H * 0.06, W, H * 0.06 + bandH);

  const pad = W * 0.045;
  const titleSize = Math.min(W * 0.115, bandH * 0.48);
  const subSize = Math.max(14, W * 0.032);

  ctx.save();
  ctx.translate(pad, bandY + bandH * 0.56);
  ctx.rotate(-0.02);
  // Subtitle in script, clearly above the title's cap height.
  ctx.font = `${subSize}px Pacifico, cursive`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = subSize * 0.3;
  ctx.shadowOffsetY = subSize * 0.06;
  ctx.fillText(state.subtitle || '', 0, -titleSize * 0.95);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // The big title: gradient fill, dark outline, slight lean.
  const grad = ctx.createLinearGradient(0, -titleSize * 0.8, 0, titleSize * 0.2);
  grad.addColorStop(0, grade.title[0]);
  grad.addColorStop(0.55, grade.title[1]);
  grad.addColorStop(1, grade.title[2]);
  ctx.font = `${titleSize}px Anton, "Arial Black", sans-serif`;
  try {
    ctx.letterSpacing = `${Math.max(1, titleSize * 0.02)}px`;
  } catch {
    // letterSpacing is Chrome-only; the title still draws without it.
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(16,2,28,0.92)';
  ctx.lineWidth = titleSize * 0.09;
  ctx.strokeText(state.title || '', 0, 0);
  ctx.fillStyle = grad;
  ctx.fillText(state.title || '', 0, 0);
  ctx.restore();

  // Badge ribbon, top-left, like a sticker on the poster.
  if (state.badge) {
    const badgeSize = Math.max(12, W * 0.02);
    ctx.save();
    ctx.font = `bold ${badgeSize}px Anton, "Arial Black", sans-serif`;
    const textW = ctx.measureText(state.badge).width;
    const bw = textW + badgeSize * 1.6;
    const bh = badgeSize * 2.1;
    const bx = W * 0.035;
    const by = H * 0.035;
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.rotate(-0.03);
    ctx.translate(-bw / 2, -bh / 2);
    ctx.fillStyle = 'rgba(10,2,24,0.82)';
    ctx.beginPath();
    ctx.roundRect(0, 0, bw, bh, bh / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, badgeSize * 0.08);
    ctx.stroke();
    ctx.fillStyle = '#ffe259';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.badge, badgeSize * 0.8, bh / 2 + badgeSize * 0.06);
    ctx.restore();
  }
}

// Draw the whole cover. Returns the panel rects in canvas pixels, for
// hit-testing in the editor. `photos` is an array of loaded images.
export function drawCover(ctx, W, H, state, photos) {
  const layout = layoutById(state.layoutId);
  const grade = gradeById(state.gradeId);
  const gutter = Math.max(2, Math.round(Math.min(W, H) * 0.008));

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0618';
  ctx.fillRect(0, 0, W, H);

  const rects = [];
  layout.panels.forEach((p, i) => {
    const rect = {
      x: p.x * W + (p.x > 0 ? gutter / 2 : 0),
      y: p.y * H + (p.y > 0 ? gutter / 2 : 0),
      w: p.w * W - (p.x > 0 ? gutter / 2 : 0) - (p.x + p.w < 1 ? gutter / 2 : 0),
      h: p.h * H - (p.y > 0 ? gutter / 2 : 0) - (p.y + p.h < 1 ? gutter / 2 : 0),
      tilt: p.tilt ?? 0,
    };
    rects.push({ index: i, ...rect });
    const crop = state.panels[i] ?? { photo: -1, cx: 0.5, cy: 0.5, zoom: 1 };
    const img = crop.photo >= 0 ? photos[crop.photo] : null;
    if (img) {
      drawPhotoPanel(ctx, img, rect, crop, grade.filter);
    } else {
      // Empty panel: a painted sunset placeholder, never a broken image.
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      g.addColorStop(0, '#ff7a3d');
      g.addColorStop(1, '#ff2e88');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `${Math.max(12, rect.w * 0.06)}px Anton, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  });

  drawTint(ctx, W, H, grade);
  drawGrainAndVignette(ctx, W, H);
  drawTitleBlock(ctx, W, H, state, grade);
  ctx.restore();
  return rects;
}

// Render a cover at one of the post sizes and hand back a PNG blob.
export async function renderCoverPNG(state, photos, sizeKey) {
  const size = SIZES[sizeKey] ?? SIZES.square;
  await document.fonts.load('80px Anton');
  await document.fonts.load('40px Pacifico');
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas.getContext('2d'), size.w, size.h, state, photos);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png');
  });
}
