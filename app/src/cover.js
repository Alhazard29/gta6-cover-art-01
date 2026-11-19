/* Vice Cover Studio — cover engine (round 4 chunk B).
 *
 * Written fresh from the design description. Five layouts, five colour
 * grades, per-panel photo placement with pan/zoom/clamp, procedural
 * empty-panel art (gradient + shapes, no external images), and title /
 * subtitle rendering using ONLY the CSS system-font stacks from
 * style.css: the heavy display stack ("Arial Black", Impact, ...) for
 * titles and the serif-italic stack (Georgia, ...) for subtitles.
 *
 * Fonts: system fonts ONLY. No font files are shipped, no webfont
 * loading is used, and there is no reference to any font file anywhere
 * in this file. No network requests of any kind.
 *
 * Classic script: defines window.CoverEngine; main.js consumes it.
 */

'use strict';

(function (global) {
  // Canvas font strings matching the CSS stacks in style.css.
  var DISPLAY_FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';
  var SCRIPT_FONT = 'Georgia, "Times New Roman", "Nimbus Roman", serif';

  var SIZES = {
    '1080x1080': [1080, 1080],
    '1080x1350': [1080, 1350],
    '1920x1080': [1920, 1080],
  };

  // Five colour grades. Each grade is a full palette: sky, sun, ground,
  // accent, ink, photo wash, and the three title-gradient stops.
  var GRADES = {
    classic: {
      name: 'Classic Vice',
      skyTop: '#7b2fff', skyMid: '#ff2e88', skyLow: '#ffb347',
      sun: '#fffbe6', ground: '#0b1035', accent: '#2de2ff', ink: '#fff7ec',
      wash: 'rgba(255,46,136,0.10)',
      titleTop: '#fff7ec', titleMid: '#ffb347', titleBot: '#ff2e88',
    },
    neon: {
      name: 'Neon Nights',
      skyTop: '#05021a', skyMid: '#7b2fff', skyLow: '#2de2ff',
      sun: '#ff2e88', ground: '#0a0212', accent: '#ff9a3d', ink: '#f4f0ff',
      wash: 'rgba(123,47,255,0.12)',
      titleTop: '#ffffff', titleMid: '#2de2ff', titleBot: '#ff2e88',
    },
    sunset: {
      name: 'Vice Sunset',
      skyTop: '#2b0a4a', skyMid: '#ff5e3a', skyLow: '#ffd166',
      sun: '#fff3c4', ground: '#160327', accent: '#2de2ff', ink: '#fff7ec',
      wash: 'rgba(255,46,136,0.10)',
      titleTop: '#fff7ec', titleMid: '#ffb347', titleBot: '#ff2e88',
    },
    noir: {
      name: 'Noir',
      skyTop: '#111111', skyMid: '#555555', skyLow: '#bbbbbb',
      sun: '#ffffff', ground: '#000000', accent: '#e8e8e8', ink: '#ffffff',
      wash: 'rgba(0,0,0,0.10)',
      titleTop: '#ffffff', titleMid: '#d8d8d8', titleBot: '#666666',
    },
    pastel: {
      name: 'Pastel Dusk',
      skyTop: '#f7c8d8', skyMid: '#ffb347', skyLow: '#ffe9a8',
      sun: '#fff7ec', ground: '#5b2a4a', accent: '#ff7bac', ink: '#4a1030',
      wash: 'rgba(255,123,172,0.08)',
      titleTop: '#4a1030', titleMid: '#c2185b', titleBot: '#ff7bac',
    },
  };

  // Five layouts. rects(w, h) returns the panel rectangles in canvas
  // pixels; titleZone says where the caption sits: 'top' (own band or
  // top scrim) or 'bottom' (overlaid on a bottom scrim).
  var LAYOUTS = {
    'vice-grid': {
      name: 'Vice Grid',
      panelCount: 4,
      titleZone: 'top',
      rects: function (w, h) {
        var m = w * 0.03;
        var g = w * 0.02;
        var top = h * 0.17;
        var pw = (w - m * 2 - g) / 2;
        var ph = (h - top - m - g) / 2;
        return [
          { x: m, y: top, w: pw, h: ph },
          { x: m + pw + g, y: top, w: pw, h: ph },
          { x: m, y: top + ph + g, w: pw, h: ph },
          { x: m + pw + g, y: top + ph + g, w: pw, h: ph },
        ];
      },
    },
    'four-panel': {
      name: 'Four Panel',
      panelCount: 4,
      titleZone: 'bottom',
      rects: function (w, h) {
        var g = Math.max(3, w * 0.008);
        var pw = (w - g) / 2;
        var ph = (h - g) / 2;
        return [
          { x: 0, y: 0, w: pw, h: ph },
          { x: pw + g, y: 0, w: pw, h: ph },
          { x: 0, y: ph + g, w: pw, h: ph },
          { x: pw + g, y: ph + g, w: pw, h: ph },
        ];
      },
    },
    'nine-grid': {
      name: 'Nine Grid',
      panelCount: 9,
      titleZone: 'bottom',
      rects: function (w, h) {
        var g = Math.max(3, w * 0.008);
        var pw = (w - g * 2) / 3;
        var ph = (h - g * 2) / 3;
        var rects = [];
        for (var row = 0; row < 3; row++) {
          for (var col = 0; col < 3; col++) {
            rects.push({ x: col * (pw + g), y: row * (ph + g), w: pw, h: ph });
          }
        }
        return rects;
      },
    },
    'single-hero': {
      name: 'Single Hero',
      panelCount: 1,
      titleZone: 'top',
      rects: function (w, h) {
        return [{ x: 0, y: 0, w: w, h: h }];
      },
    },
    'duo-split': {
      name: 'Duo Split',
      panelCount: 2,
      titleZone: 'bottom',
      rects: function (w, h) {
        var g = Math.max(3, w * 0.008);
        var pw = (w - g) / 2;
        return [
          { x: 0, y: 0, w: pw, h: h },
          { x: pw + g, y: 0, w: pw, h: h },
        ];
      },
    },
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // Deterministic pseudo-random generator so empty-panel art is stable
  // per panel index across redraws.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createPanelState() {
    // photo: index into state.photos, or null. zoom: 1..3. x/y: pan in
    // [-1, 1], where 0 is centred and +/-1 pushes the photo to the edge.
    return { photo: null, zoom: 1, x: 0, y: 0 };
  }

  function resetPanelState(p) {
    p.zoom = 1;
    p.x = 0;
    p.y = 0;
  }

  function clampPanelState(p) {
    p.zoom = clamp(p.zoom, 1, 3);
    p.x = clamp(p.x, -1, 1);
    p.y = clamp(p.y, -1, 1);
  }

  function panelRects(layoutId, w, h) {
    var layout = LAYOUTS[layoutId] || LAYOUTS['vice-grid'];
    return layout.rects(w, h);
  }

  // Index of the panel containing canvas point (x, y), or -1.
  function panelAt(layoutId, w, h, x, y) {
    var rects = panelRects(layoutId, w, h);
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }

  // Half of the overhang (in canvas px) of a zoomed cover-fit photo
  // beyond its panel on each axis. Zero when the photo exactly fits.
  function excess(img, rect, zoom) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return { ex: 0, ey: 0 };
    var base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    var scale = base * clamp(zoom, 1, 3);
    return {
      ex: Math.max(0, (img.naturalWidth * scale - rect.w) / 2),
      ey: Math.max(0, (img.naturalHeight * scale - rect.h) / 2),
    };
  }

  // Procedural art for a panel with no photo: gradient sky, setting sun
  // with glow, ground band, accent horizon line, diagonal stripes and
  // one large geometric shape. No external images.
  function drawEmptyPanel(ctx, rect, grade, seed) {
    var rnd = mulberry32(seed * 2654435761 + 11);
    var sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    sky.addColorStop(0, grade.skyTop);
    sky.addColorStop(0.55, grade.skyMid);
    sky.addColorStop(1, grade.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    var sx = rect.x + rect.w * (0.25 + rnd() * 0.5);
    var sy = rect.y + rect.h * (0.22 + rnd() * 0.25);
    var sr = Math.min(rect.w, rect.h) * (0.14 + rnd() * 0.08);
    var glow = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 2.4);
    glow.addColorStop(0, grade.sun);
    glow.addColorStop(0.4, grade.skyLow);
    glow.addColorStop(1, 'rgba(255,46,136,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - sr * 2.4, sy - sr * 2.4, sr * 4.8, sr * 4.8);
    ctx.fillStyle = grade.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();

    var gy = rect.y + rect.h * (0.62 + rnd() * 0.1);
    ctx.fillStyle = grade.ground;
    ctx.fillRect(rect.x, gy, rect.w, rect.y + rect.h - gy);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(rect.x, gy, rect.w, Math.max(2, rect.h * 0.008));

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = grade.accent;
    for (var i = 0; i < 2; i++) {
      var off = rect.w * (0.15 + rnd() * 0.5);
      var sw = rect.w * (0.06 + rnd() * 0.05);
      ctx.beginPath();
      ctx.moveTo(rect.x + off, rect.y + rect.h);
      ctx.lineTo(rect.x + off + rect.w * 0.35, rect.y);
      ctx.lineTo(rect.x + off + rect.w * 0.35 + sw, rect.y);
      ctx.lineTo(rect.x + off + sw, rect.y + rect.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (rnd() > 0.5) {
      ctx.strokeStyle = grade.accent;
      ctx.lineWidth = Math.max(2, rect.w * 0.012);
      ctx.beginPath();
      ctx.arc(
        rect.x + rect.w * (0.2 + rnd() * 0.6),
        rect.y + rect.h * (0.3 + rnd() * 0.3),
        Math.min(rect.w, rect.h) * (0.1 + rnd() * 0.08),
        0, Math.PI * 2
      );
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      var tx = rect.x + rect.w * (0.2 + rnd() * 0.5);
      var ty = rect.y + rect.h * (0.25 + rnd() * 0.3);
      var ts = Math.min(rect.w, rect.h) * (0.12 + rnd() * 0.08);
      ctx.beginPath();
      ctx.moveTo(tx, ty - ts);
      ctx.lineTo(tx + ts * 0.9, ty + ts * 0.7);
      ctx.lineTo(tx - ts * 0.9, ty + ts * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw a photo cover-fit inside its panel, honouring zoom and pan,
  // clamped so the photo always covers the panel. Returns false when
  // the image is not loaded yet.
  function drawPhoto(ctx, img, rect, panel, grade) {
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return false;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    var base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    var scale = base * clamp(panel.zoom, 1, 3);
    var dw = img.naturalWidth * scale;
    var dh = img.naturalHeight * scale;
    var ex = Math.max(0, (dw - rect.w) / 2);
    var ey = Math.max(0, (dh - rect.h) / 2);
    var dx = rect.x + (rect.w - dw) / 2 + clamp(panel.x, -1, 1) * ex;
    var dy = rect.y + (rect.h - dh) / 2 + clamp(panel.y, -1, 1) * ey;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.fillStyle = grade.wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    return true;
  }

  // Fit a display-type line to maxWidth, shrinking from startPx.
  function fitDisplayFont(ctx, text, maxWidth, startPx) {
    var px = startPx;
    ctx.font = '900 ' + px + 'px ' + DISPLAY_FONT;
    while (px > 24 && ctx.measureText(text).width > maxWidth) {
      px -= 4;
      ctx.font = '900 ' + px + 'px ' + DISPLAY_FONT;
    }
    return px;
  }

  function drawTitle(ctx, w, h, grade, layout, caption, subtitle) {
    var title = (caption || 'VICE CITY').toUpperCase();
    var top = layout.titleZone === 'top';

    if (top) {
      // Single Hero gets a top scrim so the title reads over the photo.
      var scrim = ctx.createLinearGradient(0, 0, 0, h * 0.3);
      scrim.addColorStop(0, 'rgba(0,0,0,0.5)');
      scrim.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, w, h * 0.3);
    } else {
      var band = ctx.createLinearGradient(0, h * 0.68, 0, h);
      band.addColorStop(0, 'rgba(0,0,0,0)');
      band.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = band;
      ctx.fillRect(0, h * 0.68, w, h * 0.32);
    }

    var margin = w * 0.06;
    var px = fitDisplayFont(ctx, title, w - margin * 2, Math.round(w * 0.115));
    var baseline = top ? h * 0.115 : h * 0.885;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.round(w * 0.012);
    ctx.shadowOffsetY = Math.round(w * 0.008);
    var grad = ctx.createLinearGradient(0, baseline - px, 0, baseline + px * 0.15);
    grad.addColorStop(0, grade.titleTop);
    grad.addColorStop(0.5, grade.titleMid);
    grad.addColorStop(1, grade.titleBot);
    ctx.fillStyle = grad;
    ctx.fillText(title, w / 2, baseline);
    ctx.restore();

    if (subtitle) {
      var subPx = Math.max(18, Math.round(w * 0.03));
      ctx.font = 'italic ' + subPx + 'px ' + SCRIPT_FONT;
      ctx.fillStyle = grade.ink;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = Math.round(w * 0.006);
      ctx.shadowOffsetY = Math.round(w * 0.004);
      ctx.fillText(subtitle, w / 2, baseline + subPx * 1.9);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  }

  // Draw the whole cover onto ctx at size w x h.
  // state: { photos, panels, layout, grade, caption, subtitle, selected }
  function drawCover(ctx, w, h, state) {
    var grade = GRADES[state.grade] || GRADES.sunset;
    var layout = LAYOUTS[state.layout] || LAYOUTS['vice-grid'];

    // Full-canvas sky so gutters and title bands share the grade.
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, grade.skyTop);
    sky.addColorStop(0.55, grade.skyMid);
    sky.addColorStop(1, grade.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    var rects = layout.rects(w, h);
    for (var i = 0; i < rects.length; i++) {
      var panel = state.panels[i] || createPanelState();
      var img = panel.photo != null ? state.photos[panel.photo] : null;
      if (!drawPhoto(ctx, img, rects[i], panel, grade)) {
        drawEmptyPanel(ctx, rects[i], grade, i + 1);
      }
      ctx.strokeStyle = 'rgba(255,247,236,0.55)';
      ctx.lineWidth = Math.max(2, w * 0.0025);
      ctx.strokeRect(rects[i].x, rects[i].y, rects[i].w, rects[i].h);
      if (i === state.selected) {
        ctx.strokeStyle = grade.accent;
        ctx.lineWidth = Math.max(3, w * 0.005);
        ctx.strokeRect(rects[i].x, rects[i].y, rects[i].w, rects[i].h);
      }
    }

    drawTitle(ctx, w, h, grade, layout, state.caption, state.subtitle);
  }

  global.CoverEngine = {
    DISPLAY_FONT: DISPLAY_FONT,
    SCRIPT_FONT: SCRIPT_FONT,
    SIZES: SIZES,
    GRADES: GRADES,
    LAYOUTS: LAYOUTS,
    createPanelState: createPanelState,
    resetPanelState: resetPanelState,
    clampPanelState: clampPanelState,
    panelRects: panelRects,
    panelAt: panelAt,
    excess: excess,
    drawCover: drawCover,
  };
})(typeof window !== 'undefined' ? window : globalThis);
