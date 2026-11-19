// Vice City Cover Studio — cover engine (chunk 2, written fresh).
//
// Renders a GTA 6-style Vice City poster onto any 2D canvas: five
// multi-panel layouts, five sunset/neon colour grades, per-panel photo
// crop/pan/zoom, procedural art for empty panels, and an Anton title with
// a Pacifico subtitle. All art and lettering is original code; the only
// outside assets are the two OFL fonts (Anton, Pacifico) vendored under
// app/fonts/. No network is used at render time.
//
// State shape (owned by main.js, read here):
//   state.photos  — [{ img, url, name, width, height }] (img: HTMLImageElement)
//   state.layout  — one of the LAYOUTS keys
//   state.grade   — one of the GRADES keys
//   state.title, state.subtitle — caption strings
//   state.panels  — [{ photoIdx, zoom, dx, dy }] per panel; photoIdx -1 = empty
//   state.selected — index of the selected panel (for the editor outline)

(function () {
  'use strict';

  // ---------------------------------------------------------------- grades
  // Each grade: a sky gradient, a translucent wash laid over photos, a
  // canvas filter for photos, caption colours, and the palette the
  // procedural empty-panel art draws from.
  var GRADES = {
    sunset: {
      name: 'Vice Sunset',
      sky: [[0, '#2a0f3d'], [0.45, '#7a1e6e'], [0.7, '#ff2e88'], [0.88, '#ff7a3d'], [1, '#1a0b2e']],
      wash: { color: '#ff5e3a', alpha: 0.16 },
      filter: 'saturate(1.25) contrast(1.06)',
      title: '#fff3e0',
      subtitle: '#22e6ff',
      accent: '#ff2e88',
      frame: '#12081f',
      proc: { sun: '#ffd166', sunCore: '#fff3c4', skyline: '#1c0b2e', palm: '#140a24', glow: '#ff7a3d' }
    },
    neon: {
      name: 'Neon Nights',
      sky: [[0, '#050a2e'], [0.4, '#1b0f5e'], [0.68, '#c4008f'], [0.88, '#00c2ff'], [1, '#03071a']],
      wash: { color: '#b400ff', alpha: 0.18 },
      filter: 'saturate(1.45) contrast(1.12)',
      title: '#7df9ff',
      subtitle: '#ff5ad1',
      accent: '#00e5ff',
      frame: '#050a2e',
      proc: { sun: '#00e5ff', sunCore: '#c8fbff', skyline: '#0a0626', palm: '#070418', glow: '#ff2ec4' }
    },
    dusk: {
      name: 'Palm Dusk',
      sky: [[0, '#241433'], [0.45, '#5b2a52'], [0.7, '#c65a3c'], [0.88, '#e8a34c'], [1, '#101d26']],
      wash: { color: '#e07b39', alpha: 0.14 },
      filter: 'sepia(0.18) saturate(1.12) contrast(1.04)',
      title: '#ffedd6',
      subtitle: '#ffb347',
      accent: '#ff8a3d',
      frame: '#1a1226',
      proc: { sun: '#ffb347', sunCore: '#ffedbe', skyline: '#221029', palm: '#160d1e', glow: '#e8a34c' }
    },
    noir: {
      name: 'Noir',
      sky: [[0, '#0a0a0f'], [0.5, '#23232e'], [0.8, '#4a4a58'], [1, '#050507']],
      wash: { color: '#8a8a9a', alpha: 0.10 },
      filter: 'grayscale(0.92) contrast(1.18) brightness(0.96)',
      title: '#f5f5f5',
      subtitle: '#c9c9d6',
      accent: '#e63946',
      frame: '#000000',
      proc: { sun: '#e8e8e8', sunCore: '#ffffff', skyline: '#0d0d12', palm: '#08080c', glow: '#5a5a6a' }
    },
    candy: {
      name: 'Candy Pop',
      sky: [[0, '#3d0f5e'], [0.35, '#ff2e88'], [0.6, '#ffb347'], [0.82, '#22e6ff'], [1, '#12082e']],
      wash: { color: '#ff2e88', alpha: 0.12 },
      filter: 'saturate(1.6) contrast(1.05) brightness(1.06)',
      title: '#ffe45e',
      subtitle: '#ffffff',
      accent: '#ff2e88',
      frame: '#2a0f3d',
      proc: { sun: '#ffe45e', sunCore: '#fffbe0', skyline: '#2a0b45', palm: '#1c0733', glow: '#22e6ff' }
    }
  };

  // --------------------------------------------------------------- layouts
  // Each layout maps (W, H) to panel rects and a title area. Title mode
  // "band" paints a solid caption band; "overlay" paints a bottom scrim
  // the caption sits on. Gaps are a small fraction of the short side so
  // the grid reads at any export size.
  function gapFor(W, H) { return Math.max(2, Math.round(Math.min(W, H) * 0.008)); }

  var LAYOUTS = {
    'vice-grid': function (W, H) {
      var g = gapFor(W, H);
      var bandH = Math.round(H * 0.26);
      var areaH = H - bandH - g;
      var pw = (W - g) / 2;
      var ph = (areaH - g) / 2;
      return {
        panels: [
          { x: 0, y: 0, w: pw, h: ph },
          { x: pw + g, y: 0, w: pw, h: ph },
          { x: 0, y: ph + g, w: pw, h: ph },
          { x: pw + g, y: ph + g, w: pw, h: ph }
        ],
        title: { x: 0, y: H - bandH, w: W, h: bandH, mode: 'band' }
      };
    },
    'four-panel': function (W, H) {
      var g = gapFor(W, H);
      var pw = (W - g) / 2;
      var ph = (H - g) / 2;
      return {
        panels: [
          { x: 0, y: 0, w: pw, h: ph },
          { x: pw + g, y: 0, w: pw, h: ph },
          { x: 0, y: ph + g, w: pw, h: ph },
          { x: pw + g, y: ph + g, w: pw, h: ph }
        ],
        title: { x: 0, y: H * 0.74, w: W, h: H * 0.26, mode: 'overlay' }
      };
    },
    'nine-grid': function (W, H) {
      var g = gapFor(W, H);
      var pw = (W - 2 * g) / 3;
      var ph = (H - 2 * g) / 3;
      var panels = [];
      for (var r = 0; r < 3; r++) {
        for (var c = 0; c < 3; c++) {
          panels.push({ x: c * (pw + g), y: r * (ph + g), w: pw, h: ph });
        }
      }
      return {
        panels: panels,
        title: { x: 0, y: H * 0.78, w: W, h: H * 0.22, mode: 'overlay' }
      };
    },
    'full-bleed': function (W, H) {
      return {
        panels: [{ x: 0, y: 0, w: W, h: H }],
        title: { x: 0, y: H * 0.72, w: W, h: H * 0.28, mode: 'overlay' }
      };
    },
    'triple-strip': function (W, H) {
      var g = gapFor(W, H);
      var bandH = Math.round(H * 0.22);
      var areaH = H - bandH - g;
      var pw = (W - 2 * g) / 3;
      return {
        panels: [
          { x: 0, y: 0, w: pw, h: areaH },
          { x: pw + g, y: 0, w: pw, h: areaH },
          { x: 2 * (pw + g), y: 0, w: pw, h: areaH }
        ],
        title: { x: 0, y: H - bandH, w: W, h: bandH, mode: 'band' }
      };
    }
  };

  function panelCount(layout) {
    var fn = LAYOUTS[layout] || LAYOUTS['vice-grid'];
    return fn(100, 100).panels.length;
  }

  // Keep state.panels the right length for the current layout, preserving
  // assignments where the panel index still exists.
  function ensurePanels(state) {
    var n = panelCount(state.layout);
    while (state.panels.length < n) {
      state.panels.push({ photoIdx: -1, zoom: 1, dx: 0, dy: 0, manual: false });
    }
    if (state.panels.length > n) state.panels.length = n;
    if (state.selected >= n) state.selected = 0;
  }

  // ------------------------------------------------------------ photo math
  // Cover-fit an image into a rect at a zoom, then clamp the pan so the
  // image always covers the rect (no gap ever shows).
  function fitPhoto(imgW, imgH, rect, zoom) {
    var base = Math.max(rect.w / imgW, rect.h / imgH);
    var s = base * zoom;
    return { w: imgW * s, h: imgH * s };
  }

  function clampPan(panel, imgW, imgH, rect) {
    var d = fitPhoto(imgW, imgH, rect, panel.zoom);
    var maxDx = Math.max(0, (d.w - rect.w) / 2);
    var maxDy = Math.max(0, (d.h - rect.h) / 2);
    panel.dx = Math.max(-maxDx, Math.min(maxDx, panel.dx));
    panel.dy = Math.max(-maxDy, Math.min(maxDy, panel.dy));
    return d;
  }

  function drawPhotoPanel(ctx, rect, photo, panel, grade) {
    var d = clampPan(panel, photo.width, photo.height, rect);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    // Grade filter (Chrome supports ctx.filter; guard elsewhere).
    if (typeof ctx.filter === 'string') ctx.filter = grade.filter || 'none';
    ctx.drawImage(
      photo.img,
      rect.x + (rect.w - d.w) / 2 + panel.dx,
      rect.y + (rect.h - d.h) / 2 + panel.dy,
      d.w, d.h
    );
    if (typeof ctx.filter === 'string') ctx.filter = 'none';
    // Warm/cool wash over the photo so the grade reads on every picture.
    ctx.globalAlpha = grade.wash.alpha;
    ctx.fillStyle = grade.wash.color;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ------------------------------------------------------ procedural panels
  // Deterministic little PRNG so a panel's art is stable across renders.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function skyGradient(ctx, rect, grade) {
    var g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grade.sky.forEach(function (stop) { g.addColorStop(stop[0], stop[1]); });
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  // Synthwave sun: a disc with horizontal slits cut out of its lower half.
  function drawSun(ctx, cx, cy, r, grade) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    var g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, grade.proc.sunCore);
    g.addColorStop(0.55, grade.proc.sun);
    g.addColorStop(1, grade.proc.glow);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Slits widen toward the bottom.
    ctx.fillStyle = grade.proc.glow;
    var y = cy + r * 0.05;
    var h = r * 0.03;
    while (y < cy + r) {
      ctx.fillRect(cx - r, y, r * 2, h);
      y += h * 2.4;
      h *= 1.5;
    }
    ctx.restore();
  }

  // Building silhouettes with a few lit windows.
  function drawSkyline(ctx, rect, grade, rand) {
    var base = rect.y + rect.h;
    var x = rect.x;
    ctx.fillStyle = grade.proc.skyline;
    while (x < rect.x + rect.w) {
      var bw = rect.w * (0.08 + rand() * 0.14);
      var bh = rect.h * (0.25 + rand() * 0.45);
      ctx.fillRect(x, base - bh, bw, bh);
      // Antenna on some towers.
      if (rand() > 0.6) ctx.fillRect(x + bw / 2 - 1, base - bh - rect.h * 0.08, 2, rect.h * 0.08);
      // Lit windows.
      ctx.fillStyle = grade.proc.glow;
      var cols = Math.max(1, Math.floor(bw / (rect.w * 0.045)));
      var rows = Math.max(1, Math.floor(bh / (rect.h * 0.09)));
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < rows; r++) {
          if (rand() > 0.72) {
            ctx.fillRect(x + 3 + c * (bw / cols), base - bh + 4 + r * (bh / rows), 2, 3);
          }
        }
      }
      ctx.fillStyle = grade.proc.skyline;
      x += bw + rect.w * 0.015;
    }
  }

  // Palm silhouettes: a curved trunk and a crown of fronds.
  function drawPalm(ctx, x, base, h, lean, grade) {
    ctx.save();
    ctx.strokeStyle = grade.proc.palm;
    ctx.fillStyle = grade.proc.palm;
    ctx.lineWidth = Math.max(2, h * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * h * 0.2, base - h * 0.6, x + lean * h * 0.35, base - h);
    ctx.stroke();
    var tx = x + lean * h * 0.35;
    var ty = base - h;
    // Fronds: arcs drooping from the crown.
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI * 0.15 - (i / 6) * Math.PI * 0.7;
      var len = h * (0.32 + (i % 2) * 0.08);
      ctx.lineWidth = Math.max(1.5, h * 0.018);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(
        tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.4 - h * 0.08,
        tx + Math.cos(a) * len, ty + Math.sin(a) * len * 0.7 + h * 0.12
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawProceduralPanel(ctx, rect, index, grade) {
    var rand = rng(index * 2654435761 + 97);
    skyGradient(ctx, rect, grade);
    var variant = index % 3;
    if (variant === 0) {
      // Sun over a low skyline.
      drawSun(ctx, rect.x + rect.w / 2, rect.y + rect.h * 0.42, Math.min(rect.w, rect.h) * 0.26, grade);
      drawSkyline(ctx, { x: rect.x, y: rect.y + rect.h * 0.62, w: rect.w, h: rect.h * 0.38 }, grade, rand);
    } else if (variant === 1) {
      // Skyline under a small high sun.
      drawSun(ctx, rect.x + rect.w * 0.72, rect.y + rect.h * 0.2, Math.min(rect.w, rect.h) * 0.14, grade);
      drawSkyline(ctx, { x: rect.x, y: rect.y + rect.h * 0.35, w: rect.w, h: rect.h * 0.65 }, grade, rand);
    } else {
      // Palms at sunset.
      drawSun(ctx, rect.x + rect.w / 2, rect.y + rect.h * 0.45, Math.min(rect.w, rect.h) * 0.22, grade);
      drawPalm(ctx, rect.x + rect.w * 0.16, rect.y + rect.h, rect.h * 0.55, -0.4, grade);
      drawPalm(ctx, rect.x + rect.w * 0.84, rect.y + rect.h, rect.h * 0.62, 0.4, grade);
      drawSkyline(ctx, { x: rect.x, y: rect.y + rect.h * 0.8, w: rect.w, h: rect.h * 0.2 }, grade, rand);
    }
  }

  // ---------------------------------------------------------------- caption
  function fitFont(ctx, text, fontFamily, startPx, maxWidth, minPx) {
    var px = startPx;
    ctx.font = px + 'px ' + fontFamily;
    while (px > minPx && ctx.measureText(text).width > maxWidth) {
      px = Math.max(minPx, Math.floor(px * 0.92));
      ctx.font = px + 'px ' + fontFamily;
    }
    return px;
  }

  function drawCaption(ctx, W, H, titleArea, state, grade) {
    var mode = titleArea.mode;
    var cx = titleArea.x + titleArea.w / 2;
    if (mode === 'band') {
      ctx.fillStyle = 'rgba(13, 10, 20, 0.88)';
      ctx.fillRect(titleArea.x, titleArea.y, titleArea.w, titleArea.h);
      // Accent rule across the top of the band.
      ctx.fillStyle = grade.accent;
      ctx.fillRect(titleArea.x, titleArea.y, titleArea.w, Math.max(2, H * 0.004));
    } else {
      // Bottom scrim: transparent at the top, dark at the bottom.
      var scrim = ctx.createLinearGradient(0, titleArea.y, 0, titleArea.y + titleArea.h);
      scrim.addColorStop(0, 'rgba(10, 8, 16, 0)');
      scrim.addColorStop(0.45, 'rgba(10, 8, 16, 0.55)');
      scrim.addColorStop(1, 'rgba(10, 8, 16, 0.88)');
      ctx.fillStyle = scrim;
      ctx.fillRect(titleArea.x, titleArea.y, titleArea.w, titleArea.h);
    }

    var title = (state.title || '').toUpperCase();
    var titlePx = fitFont(
      ctx, title || 'VICE CITY', 'Anton, "Arial Narrow", sans-serif',
      Math.round(titleArea.h * 0.42), titleArea.w * 0.92, Math.max(12, Math.round(H * 0.02))
    );
    var titleY = titleArea.y + titleArea.h * 0.52;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Outline + fill so the title reads over any photo.
    ctx.lineWidth = Math.max(2, titlePx / 10);
    ctx.strokeStyle = 'rgba(10, 6, 16, 0.9)';
    ctx.lineJoin = 'round';
    ctx.strokeText(title, cx, titleY);
    ctx.fillStyle = grade.title;
    ctx.fillText(title, cx, titleY);

    // Accent rule under the title (band mode only; overlay keeps the scrim clean).
    // It sits just below the title's baseline so it never touches the subtitle.
    if (mode === 'band') {
      var ruleW = Math.min(titleArea.w * 0.3, ctx.measureText(title).width * 0.5);
      ctx.fillStyle = grade.accent;
      ctx.fillRect(cx - ruleW / 2, titleY + titlePx * 0.58, ruleW, Math.max(2, titlePx * 0.05));
    }

    var sub = state.subtitle || '';
    if (sub) {
      var subPx = Math.max(12, Math.round(titlePx * 0.42));
      ctx.font = subPx + 'px Pacifico, cursive, sans-serif';
      // Shrink the subtitle too if it is very long.
      while (subPx > 12 && ctx.measureText(sub).width > titleArea.w * 0.9) {
        subPx = Math.max(12, Math.floor(subPx * 0.92));
        ctx.font = subPx + 'px Pacifico, cursive, sans-serif';
      }
      ctx.lineWidth = Math.max(1.5, subPx / 10);
      ctx.strokeStyle = 'rgba(10, 6, 16, 0.85)';
      // Band mode leaves room for the accent rule above the subtitle;
      // overlay mode tucks the subtitle closer to the title.
      var subY = titleY + titlePx * (mode === 'band' ? 0.88 : 0.72);
      ctx.strokeText(sub, cx, subY);
      ctx.fillStyle = grade.subtitle;
      ctx.fillText(sub, cx, subY);
    }
  }

  // ---------------------------------------------------------------- render
  function renderCover(ctx, W, H, state, opts) {
    opts = opts || {};
    ensurePanels(state);
    var grade = GRADES[state.grade] || GRADES.sunset;
    var layoutFn = LAYOUTS[state.layout] || LAYOUTS['vice-grid'];
    var geo = layoutFn(W, H);

    // Backdrop: the grade sky fills any gap between panels.
    skyGradient(ctx, { x: 0, y: 0, w: W, h: H }, grade);

    for (var i = 0; i < geo.panels.length; i++) {
      var rect = geo.panels[i];
      var panel = state.panels[i];
      var photo = panel && panel.photoIdx >= 0 ? state.photos[panel.photoIdx] : null;
      if (photo && photo.img && photo.img.naturalWidth > 0) {
        drawPhotoPanel(ctx, rect, photo, panel, grade);
      } else {
        drawProceduralPanel(ctx, rect, i, grade);
      }
      // Thin inner edge so panels read as separate frames.
      ctx.strokeStyle = 'rgba(10, 6, 16, 0.55)';
      ctx.lineWidth = Math.max(1, Math.min(W, H) * 0.002);
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    }

    drawCaption(ctx, W, H, geo.title, state, grade);

    // Outer frame.
    var fw = Math.max(3, Math.round(Math.min(W, H) * 0.006));
    ctx.strokeStyle = grade.frame;
    ctx.lineWidth = fw;
    ctx.strokeRect(fw / 2, fw / 2, W - fw, H - fw);
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(1, fw / 3);
    ctx.strokeRect(fw + 1, fw + 1, W - 2 * fw - 2, H - 2 * fw - 2);

    // Editor selection outline — never in exports.
    if (opts.showSelection && state.panels.length > 0) {
      var sel = geo.panels[state.selected] || geo.panels[0];
      ctx.save();
      ctx.strokeStyle = '#22e6ff';
      ctx.lineWidth = Math.max(3, Math.min(W, H) * 0.006);
      ctx.setLineDash([Math.max(8, W * 0.012), Math.max(6, W * 0.008)]);
      ctx.strokeRect(sel.x + 2, sel.y + 2, sel.w - 4, sel.h - 4);
      ctx.restore();
    }
  }

  // Export a real PNG at the chosen size. Returns a Promise<Blob>.
  function exportCoverPNG(W, H, state) {
    var off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    var octx = off.getContext('2d');
    renderCover(octx, W, H, state, { showSelection: false });
    return new Promise(function (resolve, reject) {
      off.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('canvas.toBlob returned null'));
      }, 'image/png');
    });
  }

  window.CoverEngine = {
    GRADES: GRADES,
    LAYOUTS: LAYOUTS,
    panelCount: panelCount,
    ensurePanels: ensurePanels,
    clampPan: clampPan,
    renderCover: renderCover,
    exportCoverPNG: exportCoverPNG
  };
})();
