// Vice City Cover Studio — cover engine (chunk B).
//
// Five panel layouts, five colour grades, per-panel pan/zoom, procedural
// sunset art for empty panels, and a PNG export. Every picture on the
// cover is drawn here with original canvas code: a slit synthwave sun, a
// skyline silhouette and palm silhouettes. System fonts only, no external
// assets, nothing leaves the machine.

export const LAYOUTS = ['vice-grid', 'four-panel', 'nine-grid', 'full-bleed', 'triple-strip'];
export const GRADES = ['vice-sunset', 'neon-nights', 'palm-dusk', 'noir', 'candy-pop'];
export const SIZES = ['1080x1080', '1080x1350', '1920x1080'];

export const PANEL_COUNTS = {
  'vice-grid': 5,
  'four-panel': 4,
  'nine-grid': 9,
  'full-bleed': 1,
  'triple-strip': 3,
};

// One grade = sky gradient + photo wash + canvas filter + caption colours.
// The wash is a translucent tint laid over photos; the filter is applied
// to the photo draw itself so the grade feels baked in, not pasted on.
export const GRADE_DEFS = {
  'vice-sunset': {
    label: 'Vice Sunset',
    skyTop: '#ff9a5a', skyBottom: '#e5486f',
    wash: 'rgba(255, 107, 94, 0.16)',
    filter: 'saturate(1.35) contrast(1.06) brightness(1.02)',
    caption: '#fff7ec', subtitle: '#ffe9c9', accent: '#2ec4b6',
    bandTop: '#3a1c4d', bandBottom: '#160a24',
  },
  'neon-nights': {
    label: 'Neon Nights',
    skyTop: '#2b1055', skyBottom: '#ff2e88',
    wash: 'rgba(255, 46, 136, 0.22)',
    filter: 'saturate(1.6) contrast(1.12) brightness(1.0)',
    caption: '#ffffff', subtitle: '#ffb3d9', accent: '#00e5ff',
    bandTop: '#1c0b3d', bandBottom: '#0a0618',
  },
  'palm-dusk': {
    label: 'Palm Dusk',
    skyTop: '#7b5ea7', skyBottom: '#ff7e5f',
    wash: 'rgba(255, 126, 95, 0.16)',
    filter: 'saturate(1.3) contrast(1.04) brightness(1.02)',
    caption: '#fff3e0', subtitle: '#ffd9b0', accent: '#feb47b',
    bandTop: '#33244f', bandBottom: '#140d22',
  },
  'noir': {
    label: 'Noir',
    skyTop: '#4a4a4a', skyBottom: '#0a0a0a',
    wash: 'rgba(0, 0, 0, 0.25)',
    filter: 'grayscale(0.9) contrast(1.15) brightness(0.95)',
    caption: '#f4efe6', subtitle: '#c9c2b4', accent: '#e8e0cf',
    bandTop: '#232323', bandBottom: '#000000',
  },
  'candy-pop': {
    label: 'Candy Pop',
    skyTop: '#ff8fb1', skyBottom: '#7b61ff',
    wash: 'rgba(255, 143, 177, 0.15)',
    filter: 'saturate(1.7) contrast(1.05) brightness(1.05)',
    caption: '#ffffff', subtitle: '#fff0a8', accent: '#ffe066',
    bandTop: '#4b2a6e', bandBottom: '#1c1038',
  },
};

const TITLE_STACK = `'Arial Narrow', 'Helvetica Neue Condensed', Impact, 'sans-serif-condensed', sans-serif`;
const SUBTITLE_STACK = `Georgia, 'Times New Roman', serif`;

// Deterministic pseudo-random stream so an empty panel always draws the
// same skyline and palms for a given panel index.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fresh per-panel state: which photo it shows, and how that photo is
// cropped and positioned inside it. zoom is a multiplier (1 = cover fit).
export function createPanelStates(count) {
  const states = [];
  for (let i = 0; i < count; i++) states.push({ photo: null, zoom: 1, dx: 0, dy: 0 });
  return states;
}

// Geometry for a layout at an export size. Panels sit inside an outer
// frame; band layouts reserve the bottom strip for the caption, overlay
// layouts paint the caption over the bottom of the panels instead.
export function panelRects(layout, W, H) {
  const frame = Math.max(10, Math.round(W * 0.016));
  const gap = Math.max(6, Math.round(W * 0.012));
  const x0 = frame;
  const y0 = frame;
  const cw = W - 2 * frame;
  const ch = H - 2 * frame;
  const bandH = Math.round(ch * 0.26);
  const paH = ch - bandH - gap; // panel-area height for band layouts
  const bandZone = { x: x0, y: y0 + paH + gap, w: cw, h: bandH, overlay: false };
  const overlayZone = { x: x0, y: y0 + ch - bandH, w: cw, h: bandH, overlay: true };

  let panels;
  let titleZone = bandZone;
  if (layout === 'vice-grid') {
    // Left column: two stacked panels. Right column: one wide panel on
    // top, two half-width panels below it. Five panels in all.
    const leftW = Math.round(cw * 0.52);
    const rightX = x0 + leftW + gap;
    const rightW = cw - leftW - gap;
    const halfH = Math.round(paH * 0.5);
    const topH = Math.round(paH * 0.48);
    const botY = y0 + topH + gap;
    const botH = paH - topH - gap;
    const halfW = Math.round((rightW - gap) / 2);
    panels = [
      { x: x0, y: y0, w: leftW, h: halfH - gap / 2 },
      { x: x0, y: y0 + halfH + gap / 2, w: leftW, h: paH - halfH - gap / 2 },
      { x: rightX, y: y0, w: rightW, h: topH },
      { x: rightX, y: botY, w: halfW, h: botH },
      { x: rightX + halfW + gap, y: botY, w: rightW - halfW - gap, h: botH },
    ];
  } else if (layout === 'four-panel') {
    // Full-bleed 2x2; the caption floats over the bottom of the panels.
    const halfW = Math.round((cw - gap) / 2);
    const halfH = Math.round((ch - gap) / 2);
    panels = [
      { x: x0, y: y0, w: halfW, h: halfH },
      { x: x0 + halfW + gap, y: y0, w: cw - halfW - gap, h: halfH },
      { x: x0, y: y0 + halfH + gap, w: halfW, h: ch - halfH - gap },
      { x: x0 + halfW + gap, y: y0 + halfH + gap, w: cw - halfW - gap, h: ch - halfH - gap },
    ];
    titleZone = overlayZone;
  } else if (layout === 'nine-grid') {
    const cellW = Math.round((cw - 2 * gap) / 3);
    const cellH = Math.round((paH - 2 * gap) / 3);
    panels = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        panels.push({
          x: x0 + col * (cellW + gap),
          y: y0 + row * (cellH + gap),
          w: col === 2 ? cw - 2 * (cellW + gap) : cellW,
          h: row === 2 ? paH - 2 * (cellH + gap) : cellH,
        });
      }
    }
  } else if (layout === 'full-bleed') {
    panels = [{ x: x0, y: y0, w: cw, h: ch }];
    titleZone = overlayZone;
  } else {
    // triple-strip: three vertical strips under one caption band.
    const stripW = Math.round((cw - 2 * gap) / 3);
    panels = [];
    for (let col = 0; col < 3; col++) {
      panels.push({
        x: x0 + col * (stripW + gap),
        y: y0,
        w: col === 2 ? cw - 2 * (stripW + gap) : stripW,
        h: paH,
      });
    }
  }
  return { panels, titleZone, frame, gap };
}

// Keep a panel's pan inside the photo: at any zoom the photo must cover
// the whole panel, never show a gap at an edge.
export function clampPan(panel, photo, rect) {
  if (!panel) return panel;
  if (!photo || !photo.width || !photo.height || !rect) {
    panel.dx = 0;
    panel.dy = 0;
    return panel;
  }
  const scale = Math.max(rect.w / photo.width, rect.h / photo.height) * (panel.zoom || 1);
  const shownW = photo.width * scale;
  const shownH = photo.height * scale;
  const maxDx = Math.max(0, (shownW - rect.w) / 2);
  const maxDy = Math.max(0, (shownH - rect.h) / 2);
  panel.dx = Math.max(-maxDx, Math.min(maxDx, panel.dx || 0));
  panel.dy = Math.max(-maxDy, Math.min(maxDy, panel.dy || 0));
  return panel;
}

// Draw one photo into its panel: cover-fit, scaled by the panel zoom and
// shifted by its pan, then the grade wash on top.
function drawPhotoPanel(ctx, photo, rect, panel, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (photo.img) {
    ctx.filter = grade.filter;
    const scale = Math.max(rect.w / photo.width, rect.h / photo.height) * (panel.zoom || 1);
    const shownW = photo.width * scale;
    const shownH = photo.height * scale;
    const cx = rect.x + rect.w / 2 + (panel.dx || 0);
    const cy = rect.y + rect.h / 2 + (panel.dy || 0);
    ctx.drawImage(photo.img, cx - shownW / 2, cy - shownH / 2, shownW, shownH);
    ctx.filter = 'none';
    ctx.fillStyle = grade.wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

// One palm silhouette: a curved trunk with a fan of drooping fronds.
function drawPalm(ctx, baseX, baseY, size, lean) {
  ctx.save();
  ctx.strokeStyle = '#120a1e';
  ctx.fillStyle = '#120a1e';
  ctx.lineCap = 'round';
  const topX = baseX + lean * size;
  const topY = baseY - size * 1.15;
  ctx.lineWidth = Math.max(2, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + lean * size * 0.4, baseY - size * 0.6, topX, topY);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, size * 0.028);
  for (let k = 0; k < 6; k++) {
    const angle = -Math.PI * (0.08 + k * 0.17);
    const endX = topX + Math.cos(angle) * size * 0.55;
    const endY = topY + Math.sin(angle) * size * 0.5;
    const midX = topX + Math.cos(angle) * size * 0.3;
    const midY = topY + Math.sin(angle) * size * 0.28 + size * 0.16;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(midX, midY, endX, endY + size * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

// Procedural art for a panel with no photo: grade sky, slit synthwave
// sun, horizon glow, skyline with lit windows, ground, palms and birds.
function drawProceduralPanel(ctx, rect, grade, seed) {
  const rnd = mulberry32(seed * 7919 + 13);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(1, grade.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Slit sun: a warm disc whose lower half is cut by sky-coloured bars
  // that grow thicker toward the bottom, the synthwave look.
  const sunX = rect.x + rect.w * (0.32 + rnd() * 0.36);
  const sunY = rect.y + rect.h * (0.30 + rnd() * 0.12);
  const sunR = Math.min(rect.w, rect.h) * (0.20 + rnd() * 0.08);
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, '#ffd319');
  sun.addColorStop(0.55, '#ff7b3d');
  sun.addColorStop(1, '#ff2975');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  let slitY = sunY + sunR * 0.08;
  let slitH = Math.max(2, sunR * 0.05);
  while (slitY < sunY + sunR) {
    ctx.fillStyle = sky;
    ctx.fillRect(sunX - sunR - 1, slitY, sunR * 2 + 2, slitH);
    slitY += slitH + Math.max(3, sunR * 0.13);
    slitH *= 1.4;
  }

  // Horizon glow where the sun meets the city.
  const horizon = rect.y + rect.h * 0.72;
  const glow = ctx.createLinearGradient(0, horizon - rect.h * 0.10, 0, horizon + rect.h * 0.06);
  glow.addColorStop(0, 'rgba(255, 211, 25, 0)');
  glow.addColorStop(0.5, 'rgba(255, 211, 25, 0.35)');
  glow.addColorStop(1, 'rgba(255, 211, 25, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(rect.x, horizon - rect.h * 0.10, rect.w, rect.h * 0.16);

  // Skyline: dark blocks of varied height with a few lit windows.
  const groundTop = rect.y + rect.h * 0.78;
  ctx.fillStyle = '#1d0f2e';
  let bx = rect.x;
  while (bx < rect.x + rect.w) {
    const bw = rect.w * (0.08 + rnd() * 0.12);
    const bh = rect.h * (0.10 + rnd() * 0.22);
    ctx.fillRect(bx, rect.y + rect.h - bh, bw, bh);
    if (rnd() < 0.7) {
      ctx.fillStyle = '#ffd166';
      const wins = 1 + Math.floor(rnd() * 3);
      for (let wi = 0; wi < wins; wi++) {
        const wx = bx + bw * (0.2 + rnd() * 0.6);
        const wy = rect.y + rect.h - bh + bh * (0.2 + rnd() * 0.5);
        ctx.fillRect(wx, wy, Math.max(2, bw * 0.08), Math.max(2, bh * 0.07));
      }
      ctx.fillStyle = '#1d0f2e';
    }
    bx += bw + rect.w * 0.015;
  }

  // Ground strip the buildings rise from.
  ctx.fillStyle = '#160a24';
  ctx.fillRect(rect.x, groundTop, rect.w, rect.y + rect.h - groundTop);

  // Palms in the lower corners, only where the panel is big enough to
  // carry them without clutter.
  if (Math.min(rect.w, rect.h) >= 110) {
    drawPalm(ctx, rect.x + rect.w * 0.07, rect.y + rect.h * 0.99, rect.h * 0.34, 0.25);
    drawPalm(ctx, rect.x + rect.w * 0.93, rect.y + rect.h * 0.99, rect.h * 0.30, -0.25);
  }

  // A few birds high in the sky.
  if (Math.min(rect.w, rect.h) >= 140) {
    ctx.strokeStyle = 'rgba(24, 10, 32, 0.8)';
    ctx.lineWidth = Math.max(1.5, rect.w * 0.004);
    for (let b = 0; b < 3; b++) {
      const birdX = rect.x + rect.w * (0.15 + rnd() * 0.7);
      const birdY = rect.y + rect.h * (0.10 + rnd() * 0.14);
      const span = rect.w * 0.03;
      ctx.beginPath();
      ctx.moveTo(birdX - span, birdY);
      ctx.quadraticCurveTo(birdX - span * 0.4, birdY - span * 0.5, birdX, birdY);
      ctx.quadraticCurveTo(birdX + span * 0.4, birdY - span * 0.5, birdX + span, birdY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Shrink the title until it fits the caption width. It never goes below
// 12px, and the final fillText squeezes rather than truncates.
function fitTitleFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  while (size > 12) {
    ctx.font = `900 ${size}px ${TITLE_STACK}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  size = Math.max(12, size);
  ctx.font = `900 ${size}px ${TITLE_STACK}`;
  return size;
}

// The caption: title with outline and accent rule, then the subtitle.
// Band layouts paint a solid band; overlay layouts paint a scrim that
// fades in over the bottom of the panels.
function drawCaption(ctx, zone, grade, title, subtitle, W) {
  if (!zone.overlay) {
    const band = ctx.createLinearGradient(0, zone.y, 0, zone.y + zone.h);
    band.addColorStop(0, grade.bandTop);
    band.addColorStop(1, grade.bandBottom);
    ctx.fillStyle = band;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(zone.x, zone.y, zone.w, Math.max(3, Math.round(W * 0.004)));
  } else {
    const scrim = ctx.createLinearGradient(0, zone.y, 0, zone.y + zone.h);
    scrim.addColorStop(0, 'rgba(10, 8, 20, 0)');
    scrim.addColorStop(0.45, 'rgba(10, 8, 20, 0.55)');
    scrim.addColorStop(1, 'rgba(10, 8, 20, 0.85)');
    ctx.fillStyle = scrim;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  }

  const text = (title || 'VICE CITY').trim().toUpperCase() || 'VICE CITY';
  const maxWidth = zone.w * 0.92;
  const startSize = Math.min(Math.round(W * 0.10), Math.round(zone.h * 0.42));
  const titleSize = fitTitleFont(ctx, text, maxWidth, startSize);
  const titleBaseline = zone.y + zone.h * 0.52;
  try { ctx.letterSpacing = '0.04em'; } catch (err) { /* older canvas: ignore */ }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = Math.round(W * 0.008);
  ctx.shadowOffsetY = Math.round(W * 0.004);
  ctx.lineWidth = Math.max(2, Math.round(titleSize * 0.07));
  ctx.strokeStyle = 'rgba(20, 8, 24, 0.85)';
  ctx.strokeText(text, zone.x + zone.w / 2, titleBaseline, maxWidth);
  ctx.fillStyle = grade.caption;
  ctx.fillText(text, zone.x + zone.w / 2, titleBaseline, maxWidth);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Accent rule under the title, then the subtitle in italic serif.
  const ruleW = Math.min(zone.w * 0.26, ctx.measureText(text).width * 0.6);
  const ruleY = titleBaseline + Math.round(titleSize * 0.30);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(zone.x + (zone.w - ruleW) / 2, ruleY, ruleW, Math.max(3, Math.round(W * 0.005)));

  const sub = (subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(14, Math.round(titleSize * 0.30));
    ctx.font = `italic ${subSize}px ${SUBTITLE_STACK}`;
    ctx.fillStyle = grade.subtitle;
    ctx.fillText(sub, zone.x + zone.w / 2, ruleY + Math.round(subSize * 1.5), zone.w * 0.88);
  }
  try { ctx.letterSpacing = '0px'; } catch (err) { /* older canvas: ignore */ }
}

// Draw the whole cover onto a 2d context at W x H. showSelection adds a
// dashed outline around the selected panel; exports always pass false.
export function drawCover(ctx, W, H, opts) {
  const grade = GRADE_DEFS[opts.grade] || GRADE_DEFS['vice-sunset'];
  const geo = panelRects(opts.layout || 'vice-grid', W, H);
  const panels = opts.panels || [];

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(1, grade.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  geo.panels.forEach((rect, i) => {
    const panel = panels[i] || { photo: null, zoom: 1, dx: 0, dy: 0 };
    if (panel.photo && panel.photo.img) {
      drawPhotoPanel(ctx, panel.photo, rect, panel, grade);
    } else {
      drawProceduralPanel(ctx, rect, grade, i + 1);
    }
    ctx.strokeStyle = 'rgba(12, 20, 26, 0.9)';
    ctx.lineWidth = Math.max(2, Math.round(W * 0.003));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (opts.showSelection && i === (opts.selectedPanel || 0)) {
      ctx.save();
      ctx.strokeStyle = grade.accent;
      ctx.lineWidth = Math.max(4, Math.round(W * 0.006));
      ctx.setLineDash([Math.round(W * 0.02), Math.round(W * 0.012)]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  });

  drawCaption(ctx, geo.titleZone, grade, opts.title, opts.subtitle, W);

  // Outer frame in the grade accent.
  const frameW = Math.max(4, Math.round(W * 0.008));
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = frameW;
  ctx.strokeRect(frameW / 2, frameW / 2, W - frameW, H - frameW);
  return geo;
}

// Paint the cover into a canvas sized to the chosen export size.
export function renderCover(canvas, opts) {
  const [W, H] = (opts.size || '1080x1080').split('x').map(Number);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, W, H, opts);
  return canvas;
}

// Render the cover offscreen and hand back a PNG blob. The selection
// outline is never part of an export.
export async function exportCoverPNG(opts) {
  const [W, H] = (opts.size || '1080x1080').split('x').map(Number);
  const canvas = document.createElement('canvas');
  renderCover(canvas, { ...opts, showSelection: false });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG export failed');
  return { blob, width: W, height: H, filename: `vice-city-cover-${W}x${H}.png` };
}
