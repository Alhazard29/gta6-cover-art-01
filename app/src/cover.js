// Vice City Cover Studio — cover rendering engine (Chunk B).
// Draws multi-panel GTA-style poster covers on a 2D canvas: five layouts,
// five colour grades, per-panel photos with pan/zoom, procedural art for
// empty panels, bold Anton caption lettering, and PNG export.
// All drawing code here is original; the fonts are SIL OFL files under app/fonts.

(function (global) {
  'use strict';

  // ---------------------------------------------------------------- grades
  // Each grade carries a sky gradient, a photo colour wash, a canvas filter
  // applied to photos, caption colours, and the frame/accent colours.
  var GRADES = {
    'vice-sunset': {
      sky: ['#2b1055', '#ff6b5e', '#ffb347', '#f9d976'],
      wash: 'rgba(255, 107, 94, 0.18)',
      photoFilter: 'saturate(1.25) contrast(1.08) brightness(1.02)',
      title: '#ffffff',
      titleOutline: '#1a0b2e',
      subtitle: '#ffe9a8',
      accent: '#2ec4b6',
      frame: '#ff6b5e',
      art: { sun: '#ffd166', sunGlow: '#ff6b5e', skyline: '#1a0b2e', palm: '#0f3d33' }
    },
    'neon-nights': {
      sky: ['#0b0014', '#3d0a5e', '#ff2ea6', '#7b2fff'],
      wash: 'rgba(255, 46, 166, 0.20)',
      photoFilter: 'saturate(1.5) contrast(1.15) brightness(0.98)',
      title: '#00f5d4',
      titleOutline: '#12002b',
      subtitle: '#ff5da2',
      accent: '#fee440',
      frame: '#ff2ea6',
      art: { sun: '#fee440', sunGlow: '#ff2ea6', skyline: '#0b0014', palm: '#12002b' }
    },
    'palm-dusk': {
      sky: ['#1d3557', '#e85d75', '#ff8c42', '#f1fa8c'],
      wash: 'rgba(232, 93, 117, 0.16)',
      photoFilter: 'saturate(1.2) contrast(1.05) brightness(1.0)',
      title: '#fff3e0',
      titleOutline: '#1d3557',
      subtitle: '#ffd166',
      accent: '#ff8c42',
      frame: '#e85d75',
      art: { sun: '#ffd166', sunGlow: '#ff8c42', skyline: '#14213d', palm: '#0b3d2e' }
    },
    'noir': {
      sky: ['#000000', '#1c1c1c', '#4a4a4a', '#8a8a8a'],
      wash: 'rgba(0, 0, 0, 0.22)',
      photoFilter: 'grayscale(1) contrast(1.25) brightness(0.95)',
      title: '#f5f5f5',
      titleOutline: '#000000',
      subtitle: '#c9c9c9',
      accent: '#e8e8e8',
      frame: '#f5f5f5',
      art: { sun: '#e8e8e8', sunGlow: '#666666', skyline: '#000000', palm: '#111111' }
    },
    'candy-pop': {
      sky: ['#ff5d8f', '#ffd166', '#06d6a0', '#118ab2'],
      wash: 'rgba(255, 93, 143, 0.14)',
      photoFilter: 'saturate(1.6) contrast(1.1) brightness(1.05)',
      title: '#ffffff',
      titleOutline: '#073b4c',
      subtitle: '#ffe66d',
      accent: '#06d6a0',
      frame: '#ffd166',
      art: { sun: '#ffe66d', sunGlow: '#ff5d8f', skyline: '#073b4c', palm: '#06d6a0' }
    }
  };

  var GRADE_ORDER = ['vice-sunset', 'neon-nights', 'palm-dusk', 'noir', 'candy-pop'];
  var LAYOUT_ORDER = ['vice-grid', 'four-panel', 'nine-grid', 'full-bleed', 'triple-strip'];

  // ------------------------------------------------------------ panel maths
  // Panel rects are fractions of the cover: {x, y, w, h} in 0..1.
  // gap is a fraction of the smaller cover side, used as gutters.
  function panelRects(layout, width, height) {
    var g = 0.012; // gutter, relative to min(width, height)
    var gw = g * Math.min(width, height) / width;
    var gh = g * Math.min(width, height) / height;
    var rects = [];
    var i, j;

    if (layout === 'vice-grid') {
      // 2x2 panels on top, title band across the bottom 26%.
      var band = 0.26;
      var pw = (1 - gw * 3) / 2;
      var ph = (1 - band - gh * 3) / 2;
      for (j = 0; j < 2; j++) {
        for (i = 0; i < 2; i++) {
          rects.push({ x: gw + i * (pw + gw), y: gh + j * (ph + gh), w: pw, h: ph });
        }
      }
      return { panels: rects, titleBand: { x: 0, y: 1 - band, w: 1, h: band } };
    }

    if (layout === 'four-panel') {
      var pw4 = (1 - gw * 3) / 2;
      var ph4 = (1 - gh * 3) / 2;
      for (j = 0; j < 2; j++) {
        for (i = 0; i < 2; i++) {
          rects.push({ x: gw + i * (pw4 + gw), y: gh + j * (ph4 + gh), w: pw4, h: ph4 });
        }
      }
      return { panels: rects, titleBand: null };
    }

    if (layout === 'nine-grid') {
      var pw9 = (1 - gw * 4) / 3;
      var ph9 = (1 - gh * 4) / 3;
      for (j = 0; j < 3; j++) {
        for (i = 0; i < 3; i++) {
          rects.push({ x: gw + i * (pw9 + gw), y: gh + j * (ph9 + gh), w: pw9, h: ph9 });
        }
      }
      return { panels: rects, titleBand: null };
    }

    if (layout === 'full-bleed') {
      return { panels: [{ x: 0, y: 0, w: 1, h: 1 }], titleBand: null };
    }

    // triple-strip: three vertical strips, full height.
    var sw = (1 - gw * 4) / 3;
    for (i = 0; i < 3; i++) {
      rects.push({ x: gw + i * (sw + gw), y: gh, w: sw, h: 1 - gh * 2 });
    }
    return { panels: rects, titleBand: null };
  }

  function panelCount(layout) {
    return panelRects(layout, 100, 100).panels.length;
  }

  // Clamp a panel's pan offsets so the photo always covers the panel:
  // dx/dy are offsets from the centred position, in cover pixels.
  function clampPan(image, panelPx, zoom, dx, dy) {
    if (!image || !image.naturalWidth) return { dx: 0, dy: 0 };
    var base = Math.max(panelPx.w / image.naturalWidth, panelPx.h / image.naturalHeight);
    var dw = image.naturalWidth * base * zoom;
    var dh = image.naturalHeight * base * zoom;
    var maxDx = Math.max(0, (dw - panelPx.w) / 2);
    var maxDy = Math.max(0, (dh - panelPx.h) / 2);
    return {
      dx: Math.max(-maxDx, Math.min(maxDx, dx)),
      dy: Math.max(-maxDy, Math.min(maxDy, dy))
    };
  }

  // ------------------------------------------------------- procedural art
  // Deterministic pseudo-random from a seed, so an empty panel looks the
  // same on every draw.
  function seeded(seed) {
    var s = seed * 2654435761 % 4294967296;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  // Synthwave sun: a striped circle, glowing against the grade sky.
  function drawSun(ctx, cx, cy, r, art) {
    ctx.save();
    ctx.shadowColor = art.sunGlow;
    ctx.shadowBlur = r * 0.45;
    ctx.fillStyle = art.sun;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Cut horizontal slits through the lower half, synthwave style.
    ctx.globalCompositeOperation = 'destination-out';
    var slits = 5;
    for (var i = 0; i < slits; i++) {
      var y = cy + (i / slits) * r * 0.95;
      var half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
      var thick = r * 0.035 + i * r * 0.012;
      ctx.fillRect(cx - half, y, half * 2, thick);
    }
    ctx.restore();
  }

  // A jagged skyline silhouette along the bottom of the rect.
  function drawSkyline(ctx, rect, art, rand) {
    var base = rect.y + rect.h;
    var x = rect.x;
    ctx.fillStyle = art.skyline;
    ctx.beginPath();
    ctx.moveTo(rect.x, base);
    while (x < rect.x + rect.w) {
      var bw = rect.w * (0.08 + rand() * 0.14);
      var bh = rect.h * (0.18 + rand() * 0.42);
      ctx.lineTo(x, base - bh);
      // A rooftop antenna on some buildings.
      if (rand() > 0.6) {
        ctx.lineTo(x + bw * 0.5, base - bh - rect.h * 0.08);
        ctx.lineTo(x + bw * 0.52, base - bh);
      }
      ctx.lineTo(x + bw, base - bh);
      ctx.lineTo(x + bw, base);
      x += bw;
    }
    ctx.lineTo(rect.x + rect.w, base);
    ctx.closePath();
    ctx.fill();
    // A few lit windows.
    ctx.fillStyle = 'rgba(255, 209, 102, 0.85)';
    for (var i = 0; i < 14; i++) {
      var wx = rect.x + rand() * rect.w;
      var wy = base - rect.h * (0.1 + rand() * 0.45);
      ctx.fillRect(wx, wy, Math.max(2, rect.w * 0.012), Math.max(2, rect.h * 0.02));
    }
  }

  // A simple palm: curved trunk plus five drooping fronds, drawn with arcs.
  function drawPalm(ctx, x, y, s, art) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = art.palm;
    ctx.fillStyle = art.palm;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    // Trunk, leaning slightly.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(10, -45, 26, -78);
    ctx.stroke();
    // Fronds fanning from the crown.
    var crownX = 26;
    var crownY = -78;
    for (var i = 0; i < 5; i++) {
      var angle = -Math.PI * (0.15 + i * 0.175);
      var len = 52 - Math.abs(i - 2) * 6;
      var tipX = crownX + Math.cos(angle) * len;
      var tipY = crownY + Math.sin(angle) * len * 0.55 + 26;
      ctx.beginPath();
      ctx.moveTo(crownX, crownY);
      ctx.quadraticCurveTo(
        crownX + Math.cos(angle) * len * 0.55,
        crownY + Math.sin(angle) * len * 0.3 - 6,
        tipX, tipY
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  // Full procedural scene for a panel with no photo: sky gradient, sun,
  // skyline, and a palm in a corner. Seed varies per panel index.
  function drawProceduralPanel(ctx, rect, grade, seedIndex) {
    var rand = seeded(seedIndex + 7);
    var sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grade.sky.forEach(function (color, i) {
      sky.addColorStop(i / (grade.sky.length - 1), color);
    });
    ctx.fillStyle = sky;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    var sunR = Math.min(rect.w, rect.h) * 0.26;
    drawSun(ctx, rect.x + rect.w * 0.5, rect.y + rect.h * 0.38, sunR, grade.art);
    drawSkyline(ctx, rect, grade.art, rand);
    var palmScale = Math.min(rect.w, rect.h) / 260;
    drawPalm(ctx, rect.x + rect.w * 0.82, rect.y + rect.h * 0.98, palmScale, grade.art);
    drawPalm(ctx, rect.x + rect.w * 0.12, rect.y + rect.h * 0.98, palmScale * 0.7, grade.art);
  }

  // ------------------------------------------------------------ photo draw
  function drawPhotoPanel(ctx, rect, image, panelState, grade) {
    var zoom = panelState.zoom || 1;
    var base = Math.max(rect.w / image.naturalWidth, rect.h / image.naturalHeight);
    var dw = image.naturalWidth * base * zoom;
    var dh = image.naturalHeight * base * zoom;
    var clamped = clampPan(image, rect, zoom, panelState.dx || 0, panelState.dy || 0);
    var dx = rect.x + (rect.w - dw) / 2 + clamped.dx;
    var dy = rect.y + (rect.h - dh) / 2 + clamped.dy;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.filter = grade.photoFilter;
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.filter = 'none';
    // Colour wash unifies photos from different cameras with the grade.
    ctx.fillStyle = grade.wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  // ------------------------------------------------------------ caption
  // Title auto-fits: shrink from maxPx until it fits maxWidth, never below 12.
  function fitFontSize(ctx, text, maxPx, minPx, maxWidth, family) {
    var size = maxPx;
    while (size > minPx) {
      ctx.font = size + 'px ' + family;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    return size;
  }

  function drawTitle(ctx, state, width, height, grade, band) {
    var title = (state.title || '').toUpperCase();
    var subtitle = state.subtitle || '';
    var margin = width * 0.05;
    var maxWidth = width - margin * 2;

    if (band) {
      // Vice Grid: title sits in its own band, centred vertically.
      var bandY = band.y * height;
      var bandH = band.h * height;
      var titleSize = fitFontSize(ctx, title, Math.round(bandH * 0.52), 12, maxWidth, 'Anton, "Arial Narrow", sans-serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = titleSize + 'px Anton, "Arial Narrow", sans-serif';
      ctx.lineWidth = Math.max(2, titleSize * 0.08);
      ctx.strokeStyle = grade.titleOutline;
      ctx.strokeText(title, width / 2, bandY + bandH * 0.38);
      ctx.fillStyle = grade.title;
      ctx.fillText(title, width / 2, bandY + bandH * 0.38);
      if (subtitle) {
        var subSize = Math.round(titleSize * 0.42);
        ctx.font = subSize + 'px Pacifico, cursive';
        ctx.fillStyle = grade.subtitle;
        ctx.fillText(subtitle, width / 2, bandY + bandH * 0.78);
      }
      // Accent rule line under the band title.
      var ruleW = Math.min(maxWidth * 0.5, width * 0.4);
      ctx.fillStyle = grade.accent;
      ctx.fillRect((width - ruleW) / 2, bandY + bandH - Math.max(3, height * 0.006), ruleW, Math.max(3, height * 0.006));
      return;
    }

    // Overlay layouts: title anchored near the bottom over a scrim.
    var scrimH = height * 0.26;
    var scrim = ctx.createLinearGradient(0, height - scrimH, 0, height);
    scrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
    scrim.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, height - scrimH, width, scrimH);

    var base = Math.min(width, height);
    var overlaySize = fitFontSize(ctx, title, Math.round(base * 0.115), 12, maxWidth, 'Anton, "Arial Narrow", sans-serif');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = overlaySize + 'px Anton, "Arial Narrow", sans-serif';
    ctx.lineWidth = Math.max(2, overlaySize * 0.09);
    ctx.strokeStyle = grade.titleOutline;
    ctx.lineJoin = 'round';
    var titleY = height - height * 0.085;
    ctx.strokeText(title, width / 2, titleY);
    ctx.fillStyle = grade.title;
    ctx.fillText(title, width / 2, titleY);
    if (subtitle) {
      var overlaySub = Math.round(overlaySize * 0.38);
      ctx.font = overlaySub + 'px Pacifico, cursive';
      ctx.fillStyle = grade.subtitle;
      ctx.fillText(subtitle, width / 2, height - height * 0.028);
    }
    // Accent rule above the title.
    var oRuleW = Math.min(maxWidth * 0.4, width * 0.34);
    ctx.fillStyle = grade.accent;
    ctx.fillRect((width - oRuleW) / 2, titleY - overlaySize - height * 0.018, oRuleW, Math.max(3, height * 0.005));
  }

  // ------------------------------------------------------------ main render
  // state: { layout, grade, title, subtitle, photos: [{image}], panels:
  //   [{ photo, zoom, dx, dy }] } — photo is an index into state.photos, -1
  //   for an empty panel. opts: { selectedPanel, showSelection }.
  function renderCover(ctx, state, width, height, opts) {
    opts = opts || {};
    var grade = GRADES[state.grade] || GRADES['vice-sunset'];
    var layout = panelRects(state.layout || 'vice-grid', width, height);

    // Backdrop: grade sky across the whole cover (shows in gutters/band).
    var backdrop = ctx.createLinearGradient(0, 0, 0, height);
    grade.sky.forEach(function (color, i) {
      backdrop.addColorStop(i / (grade.sky.length - 1), color);
    });
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    var panels = state.panels || [];
    layout.panels.forEach(function (frac, i) {
      var rect = {
        x: frac.x * width,
        y: frac.y * height,
        w: frac.w * width,
        h: frac.h * height
      };
      var panelState = panels[i] || { photo: -1, zoom: 1, dx: 0, dy: 0 };
      var photo = null;
      if (panelState.photo >= 0 && state.photos && state.photos[panelState.photo]) {
        photo = state.photos[panelState.photo].image;
      }
      if (photo && photo.naturalWidth) {
        drawPhotoPanel(ctx, rect, photo, panelState, grade);
      } else {
        drawProceduralPanel(ctx, rect, grade, i);
      }
      // Thin inner edge so panels read as separate frames.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = Math.max(1, width * 0.0015);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      // Selection outline: editor only, never in exports.
      if (opts.showSelection && opts.selectedPanel === i) {
        ctx.save();
        ctx.strokeStyle = grade.accent;
        ctx.lineWidth = Math.max(3, width * 0.006);
        ctx.setLineDash([Math.max(10, width * 0.02), Math.max(8, width * 0.012)]);
        ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
        ctx.restore();
      }
    });

    drawTitle(ctx, state, width, height, grade,
      layout.titleBand
        ? { x: layout.titleBand.x, y: layout.titleBand.y, w: layout.titleBand.w, h: layout.titleBand.h }
        : null);

    // Outer frame.
    ctx.strokeStyle = grade.frame;
    ctx.lineWidth = Math.max(4, width * 0.008);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
  }

  // Render to an offscreen canvas and resolve with a PNG Blob. The
  // selection outline is never included in an export.
  function exportCoverPNG(state, width, height) {
    return new Promise(function (resolve, reject) {
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      renderCover(ctx, state, width, height, { showSelection: false });
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('PNG export failed'));
      }, 'image/png');
    });
  }

  global.__viceCover = {
    GRADES: GRADES,
    GRADE_ORDER: GRADE_ORDER,
    LAYOUT_ORDER: LAYOUT_ORDER,
    panelRects: panelRects,
    panelCount: panelCount,
    clampPan: clampPan,
    renderCover: renderCover,
    exportCoverPNG: exportCoverPNG
  };
})(typeof window !== 'undefined' ? window : this);
