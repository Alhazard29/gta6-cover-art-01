/* Vice Cover Studio — editor (round 4 chunk B).
 *
 * Full editor on top of the cover engine (src/cover.js): file-input
 * photo loading with round-robin auto-assign to panels, click/drag to
 * pan, wheel to zoom, double-click to reset a panel, thumbnails, zoom
 * slider + reset button, Shuffle, and real PNG export.
 *
 * Fonts: system fonts ONLY — all lettering is drawn by the engine with
 * the CSS system-font stacks. No font files, no webfont loading, no
 * external requests. Everything runs offline in the browser.
 */

'use strict';

var Engine = window.CoverEngine;

var MAX_PANELS = 9;

var state = {
  photos: [], // HTMLImageElement[]
  panels: [], // MAX_PANELS panel states from the engine
  layout: 'vice-grid',
  grade: 'sunset',
  size: '1080x1080',
  caption: 'VICE CITY',
  subtitle: 'Streets of Leonida',
  selected: 0,
};
for (var i = 0; i < MAX_PANELS; i++) state.panels.push(Engine.createPanelState());

var nextAssign = 0; // round-robin cursor for auto-assign
var photoUrls = []; // object URLs, one per photo, for thumbnails

function $(id) {
  return document.getElementById(id);
}

var canvas = $('coverCanvas');
var ctx = canvas.getContext('2d');

function currentSize() {
  return Engine.SIZES[state.size] || Engine.SIZES['1080x1080'];
}

function panelCount() {
  var layout = Engine.LAYOUTS[state.layout] || Engine.LAYOUTS['vice-grid'];
  return layout.panelCount;
}

function clampSelected() {
  if (state.selected >= panelCount()) state.selected = panelCount() - 1;
  if (state.selected < 0) state.selected = 0;
}

function drawCover() {
  var size = currentSize();
  var w = size[0];
  var h = size[1];
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  clampSelected();
  Engine.drawCover(ctx, w, h, state);
  syncZoomSlider();
}

function syncZoomSlider() {
  var slider = $('zoomSlider');
  if (!slider) return;
  var panel = state.panels[state.selected];
  slider.value = String(panel ? panel.zoom : 1);
}

// --- Photos ---------------------------------------------------------------

function assignPhotoToPanel(photoIndex, panelIndex) {
  // One photo per panel: clear it from any other panel first.
  for (var i = 0; i < MAX_PANELS; i++) {
    if (state.panels[i].photo === photoIndex) state.panels[i].photo = null;
  }
  state.panels[panelIndex].photo = photoIndex;
  state.panels[panelIndex].zoom = 1;
  state.panels[panelIndex].x = 0;
  state.panels[panelIndex].y = 0;
}

// Round-robin auto-assign: scan from the rotating cursor for the next
// empty panel; when every panel is full the photo stays in the pool
// (reachable from the thumbnails).
function autoAssign(photoIndex) {
  var count = panelCount();
  for (var step = 0; step < count; step++) {
    var panelIndex = (nextAssign + step) % count;
    if (state.panels[panelIndex].photo == null) {
      assignPhotoToPanel(photoIndex, panelIndex);
      nextAssign = (panelIndex + 1) % count;
      return panelIndex;
    }
  }
  nextAssign = (nextAssign + 1) % count;
  return -1;
}

function renderThumbnails() {
  var strip = $('thumbnails');
  if (!strip) return;
  strip.innerHTML = '';
  state.photos.forEach(function (img, index) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    btn.title = 'Assign photo ' + (index + 1) + ' to the selected panel';
    btn.setAttribute('aria-label', 'Assign photo ' + (index + 1) + ' to the selected panel');
    var assigned = state.panels.some(function (p) { return p.photo === index; });
    if (assigned) btn.classList.add('assigned');
    var thumb = document.createElement('img');
    thumb.src = photoUrls[index];
    thumb.alt = 'Photo ' + (index + 1);
    btn.appendChild(thumb);
    btn.addEventListener('click', function () {
      clampSelected();
      assignPhotoToPanel(index, state.selected);
      renderThumbnails();
      drawCover();
    });
    strip.appendChild(btn);
  });
}

function loadPhotos(files) {
  Array.prototype.forEach.call(files, function (file) {
    if (!file || file.type.indexOf('image/') !== 0) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    var index = state.photos.length;
    state.photos.push(img);
    photoUrls.push(url);
    img.onload = function () {
      drawCover();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
    };
    img.src = url;
    autoAssign(index);
  });
  renderThumbnails();
  drawCover();
}

// --- Panel interaction ----------------------------------------------------

function canvasPoint(event) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

var drag = null; // { panel, startX, startY, startPanX, startPanY }

canvas.addEventListener('pointerdown', function (event) {
  var point = canvasPoint(event);
  var index = Engine.panelAt(state.layout, canvas.width, canvas.height, point.x, point.y);
  if (index < 0) return;
  state.selected = index;
  var panel = state.panels[index];
  drag = {
    panel: index,
    startX: event.clientX,
    startY: event.clientY,
    startPanX: panel.x,
    startPanY: panel.y,
  };
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (err) {
    // Pointer capture is best-effort; dragging still works without it.
  }
  drawCover();
});

canvas.addEventListener('pointermove', function (event) {
  if (!drag) return;
  var panel = state.panels[drag.panel];
  var rect = canvas.getBoundingClientRect();
  var scale = canvas.width / rect.width;
  var img = panel.photo != null ? state.photos[panel.photo] : null;
  var rects = Engine.panelRects(state.layout, canvas.width, canvas.height);
  var ex = Engine.excess(img, rects[drag.panel], panel.zoom);
  var dx = (event.clientX - drag.startX) * scale;
  var dy = (event.clientY - drag.startY) * scale;
  if (ex.ex > 0) panel.x = Math.max(-1, Math.min(1, drag.startPanX + dx / ex.ex));
  if (ex.ey > 0) panel.y = Math.max(-1, Math.min(1, drag.startPanY + dy / ex.ey));
  drawCover();
});

function endDrag() {
  drag = null;
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('wheel', function (event) {
  event.preventDefault();
  clampSelected();
  var panel = state.panels[state.selected];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-event.deltaY * 0.001)));
  Engine.clampPanelState(panel);
  drawCover();
}, { passive: false });

canvas.addEventListener('dblclick', function (event) {
  var point = canvasPoint(event);
  var index = Engine.panelAt(state.layout, canvas.width, canvas.height, point.x, point.y);
  if (index < 0) return;
  resetPanel(index);
});

function resetPanel(index) {
  Engine.resetPanelState(state.panels[index]);
  state.selected = index;
  drawCover();
}

// --- Export ---------------------------------------------------------------

function exportPng() {
  drawCover();
  canvas.toBlob(function (blob) {
    if (!blob) return;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'vice-cover-' + state.layout + '-' + state.grade + '-' + state.size + '.png';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }, 'image/png');
}

function exportDataURL() {
  drawCover();
  return canvas.toDataURL('image/png');
}

// --- Shuffle ---------------------------------------------------------------

function shuffle() {
  var layoutIds = Object.keys(Engine.LAYOUTS);
  var gradeIds = Object.keys(Engine.GRADES);
  var pick = function (ids, current) {
    var next = current;
    while (ids.length > 1 && next === current) {
      next = ids[Math.floor(Math.random() * ids.length)];
    }
    return next;
  };
  state.layout = pick(layoutIds, state.layout);
  state.grade = pick(gradeIds, state.grade);
  $('layoutSelect').value = state.layout;
  $('gradeSelect').value = state.grade;

  // Shuffle the assigned photos across the panels.
  var count = panelCount();
  var assigned = [];
  for (var i = 0; i < count; i++) {
    if (state.panels[i].photo != null) assigned.push(state.panels[i].photo);
    state.panels[i].photo = null;
  }
  for (var j = assigned.length - 1; j > 0; j--) {
    var k = Math.floor(Math.random() * (j + 1));
    var tmp = assigned[j];
    assigned[j] = assigned[k];
    assigned[k] = tmp;
  }
  assigned.forEach(function (photoIndex, slot) {
    state.panels[slot].photo = photoIndex;
  });
  clampSelected();
  renderThumbnails();
  drawCover();
}

// --- Controls ---------------------------------------------------------------

function wireControls() {
  $('photoInput').addEventListener('change', function (event) {
    loadPhotos(event.target.files || []);
    event.target.value = '';
  });
  $('captionInput').addEventListener('input', function (event) {
    state.caption = event.target.value;
    drawCover();
  });
  $('subtitleInput').addEventListener('input', function (event) {
    state.subtitle = event.target.value;
    drawCover();
  });
  $('layoutSelect').addEventListener('change', function (event) {
    state.layout = event.target.value;
    drawCover();
  });
  $('gradeSelect').addEventListener('change', function (event) {
    state.grade = event.target.value;
    drawCover();
  });
  $('sizeSelect').addEventListener('change', function (event) {
    state.size = event.target.value;
    drawCover();
  });
  $('exportBtn').addEventListener('click', exportPng);
  $('shuffleBtn').addEventListener('click', shuffle);
  $('zoomSlider').addEventListener('input', function (event) {
    clampSelected();
    var panel = state.panels[state.selected];
    panel.zoom = parseFloat(event.target.value) || 1;
    Engine.clampPanelState(panel);
    drawCover();
  });
  $('resetBtn').addEventListener('click', function () {
    clampSelected();
    resetPanel(state.selected);
  });
}

wireControls();
drawCover();

// Test/verification hook: read-only state plus the real export path.
window.__viceCover = {
  state: state,
  drawCover: drawCover,
  exportDataURL: exportDataURL,
  resetPanel: resetPanel,
  engine: Engine,
};
