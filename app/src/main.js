// Vice City Cover Studio — editor wiring (Chunk B).
// Loads the user's photos locally, keeps the per-panel cover state, and
// wires the canvas interactions: click to select a panel, drag to pan its
// photo, wheel to zoom, double-click to swap the photo, plus thumbnails,
// shuffle and a real PNG export. Nothing leaves the machine.

(function () {
  'use strict';

  var cover = window.__viceCover;

  var LAYOUTS = cover.LAYOUT_ORDER;
  var GRADES = cover.GRADE_ORDER;

  var state = {
    layout: 'vice-grid',
    grade: 'vice-sunset',
    title: 'VICE CITY',
    subtitle: 'Welcome back',
    size: '1080x1080',
    photos: [], // { url, image } entries, loaded from local files only
    panels: [], // { photo, zoom, dx, dy } per panel; photo is an index or -1
    selectedPanel: 0
  };

  function ensurePanels() {
    var count = cover.panelCount(state.layout);
    while (state.panels.length < count) {
      state.panels.push({ photo: -1, zoom: 1, dx: 0, dy: 0 });
    }
    state.panels.length = count;
    if (state.selectedPanel >= count) state.selectedPanel = 0;
  }

  // Assign photos to panels round-robin, starting from panel 0.
  function autoAssignPhotos() {
    if (!state.photos.length) return;
    state.panels.forEach(function (panel, i) {
      panel.photo = i % state.photos.length;
      panel.zoom = 1;
      panel.dx = 0;
      panel.dy = 0;
    });
  }

  // Fill panels that have no photo yet, continuing the round-robin order.
  function fillEmptyPanels() {
    if (!state.photos.length) return;
    var next = 0;
    state.panels.forEach(function (panel) {
      if (panel.photo >= 0) next++;
    });
    state.panels.forEach(function (panel) {
      if (panel.photo < 0) {
        panel.photo = next % state.photos.length;
        next++;
      }
    });
  }

  var canvas = document.getElementById('coverCanvas');
  var ctx = canvas.getContext('2d');
  var hintEl = document.getElementById('hintText');
  var zoomSlider = document.getElementById('zoomSlider');
  var zoomLabel = document.getElementById('zoomValue');
  var thumbsEl = document.getElementById('thumbs');

  function currentSize() {
    var parts = state.size.split('x');
    return { width: parseInt(parts[0], 10), height: parseInt(parts[1], 10) };
  }

  function fontsReady() {
    if (document.fonts && document.fonts.ready) return document.fonts.ready;
    return Promise.resolve();
  }

  function draw() {
    var size = currentSize();
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    ensurePanels();
    cover.renderCover(ctx, state, size.width, size.height, {
      selectedPanel: state.selectedPanel,
      showSelection: true
    });
    updateStatus();
    syncZoomSlider();
  }

  function drawWhenFontsReady() {
    fontsReady().then(draw);
  }

  function updateStatus() {
    var count = cover.panelCount(state.layout);
    var panel = state.panels[state.selectedPanel];
    var photoName = panel && panel.photo >= 0
      ? 'photo ' + (panel.photo + 1) + ' of ' + state.photos.length
      : 'empty — procedural art';
    hintEl.textContent = 'Panel ' + (state.selectedPanel + 1) + ' of ' + count +
      ' selected (' + photoName + '). Click a panel to select it, drag to pan, scroll to zoom, double-click to swap the photo.';
  }

  function syncZoomSlider() {
    var panel = state.panels[state.selectedPanel];
    if (!panel) return;
    zoomSlider.value = String(panel.zoom);
    zoomLabel.textContent = panel.zoom.toFixed(2) + 'x';
  }

  // ------------------------------------------------------------ thumbnails
  function renderThumbs() {
    thumbsEl.innerHTML = '';
    state.photos.forEach(function (photo, i) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'thumb';
      button.title = 'Assign photo ' + (i + 1) + ' to the selected panel';
      var img = document.createElement('img');
      img.src = photo.url;
      img.alt = 'Photo ' + (i + 1);
      button.appendChild(img);
      button.addEventListener('click', function () {
        ensurePanels();
        var panel = state.panels[state.selectedPanel];
        panel.photo = i;
        panel.zoom = 1;
        panel.dx = 0;
        panel.dy = 0;
        draw();
      });
      thumbsEl.appendChild(button);
    });
    markSelectedThumb();
  }

  function markSelectedThumb() {
    var panel = state.panels[state.selectedPanel];
    var buttons = thumbsEl.querySelectorAll('.thumb');
    buttons.forEach(function (button, i) {
      button.classList.toggle('selected', !!panel && panel.photo === i);
    });
  }

  // ------------------------------------------------------------ photo load
  function loadPhotos(files) {
    var list = Array.prototype.slice.call(files);
    if (!list.length) return Promise.resolve();
    var loaded = 0;
    return new Promise(function (resolve) {
      list.forEach(function (file) {
        var url = URL.createObjectURL(file);
        var image = new Image();
        image.onload = function () {
          state.photos.push({ url: url, image: image });
          loaded++;
          if (loaded === list.length) {
            autoAssignPhotos();
            renderThumbs();
            draw();
            resolve();
          }
        };
        image.onerror = function () {
          URL.revokeObjectURL(url);
          loaded++;
          if (loaded === list.length) {
            autoAssignPhotos();
            renderThumbs();
            draw();
            resolve();
          }
        };
        image.src = url;
      });
    });
  }

  document.getElementById('photoInput').addEventListener('change', function (event) {
    loadPhotos(event.target.files);
  });

  // ------------------------------------------------------------ pickers
  function bindPicker(elementId, key, values) {
    var picker = document.getElementById(elementId);
    picker.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button) return;
      var buttons = picker.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove('active');
      button.classList.add('active');
      state[key] = button.getAttribute('data-' + key);
      if (key === 'layout') {
        ensurePanels();
        fillEmptyPanels();
      }
      draw();
    });
  }

  function syncPicker(elementId, key, value) {
    document.querySelectorAll('#' + elementId + ' button').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-' + key) === value);
    });
  }

  bindPicker('layoutPicker', 'layout', LAYOUTS);
  bindPicker('gradePicker', 'grade', GRADES);

  document.getElementById('titleInput').addEventListener('input', function (event) {
    state.title = event.target.value;
    draw();
  });

  document.getElementById('subtitleInput').addEventListener('input', function (event) {
    state.subtitle = event.target.value;
    draw();
  });

  document.getElementById('sizeSelect').addEventListener('change', function (event) {
    state.size = event.target.value;
    draw();
  });

  // ------------------------------------------------------- canvas pointer
  function canvasPoint(event) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function panelAt(point) {
    var size = currentSize();
    var rects = cover.panelRects(state.layout, size.width, size.height).panels;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (point.x >= r.x * size.width && point.x < (r.x + r.w) * size.width &&
          point.y >= r.y * size.height && point.y < (r.y + r.h) * size.height) {
        return i;
      }
    }
    return -1;
  }

  var drag = null;

  canvas.addEventListener('pointerdown', function (event) {
    var point = canvasPoint(event);
    var index = panelAt(point);
    if (index < 0) return;
    state.selectedPanel = index;
    var panel = state.panels[index];
    drag = { x: point.x, y: point.y, dx: panel.dx, dy: panel.dy, moved: false };
    canvas.setPointerCapture(event.pointerId);
    draw();
  });

  canvas.addEventListener('pointermove', function (event) {
    if (!drag) return;
    var point = canvasPoint(event);
    var panel = state.panels[state.selectedPanel];
    if (!panel || panel.photo < 0) return;
    var size = currentSize();
    var rects = cover.panelRects(state.layout, size.width, size.height).panels;
    var r = rects[state.selectedPanel];
    var rectPx = { x: r.x * size.width, y: r.y * size.height, w: r.w * size.width, h: r.h * size.height };
    var image = state.photos[panel.photo] && state.photos[panel.photo].image;
    var clamped = cover.clampPan(image, rectPx, panel.zoom,
      drag.dx + (point.x - drag.x), drag.dy + (point.y - drag.y));
    panel.dx = clamped.dx;
    panel.dy = clamped.dy;
    if (Math.abs(point.x - drag.x) + Math.abs(point.y - drag.y) > 2) drag.moved = true;
    draw();
  });

  function endDrag() {
    drag = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', function (event) {
    event.preventDefault();
    var panel = state.panels[state.selectedPanel];
    if (!panel || panel.photo < 0) return;
    var factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    panel.zoom = Math.max(1, Math.min(3, panel.zoom * factor));
    var size = currentSize();
    var rects = cover.panelRects(state.layout, size.width, size.height).panels;
    var r = rects[state.selectedPanel];
    var rectPx = { x: r.x * size.width, y: r.y * size.height, w: r.w * size.width, h: r.h * size.height };
    var image = state.photos[panel.photo] && state.photos[panel.photo].image;
    var clamped = cover.clampPan(image, rectPx, panel.zoom, panel.dx, panel.dy);
    panel.dx = clamped.dx;
    panel.dy = clamped.dy;
    draw();
  }, { passive: false });

  canvas.addEventListener('dblclick', function (event) {
    var point = canvasPoint(event);
    var index = panelAt(point);
    if (index < 0 || !state.photos.length) return;
    state.selectedPanel = index;
    var panel = state.panels[index];
    var next = panel.photo < 0 ? 0 : (panel.photo + 1) % state.photos.length;
    panel.photo = next;
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = 0;
    draw();
  });

  // ------------------------------------------------------- selected panel
  zoomSlider.addEventListener('input', function () {
    var panel = state.panels[state.selectedPanel];
    if (!panel || panel.photo < 0) return;
    panel.zoom = parseFloat(zoomSlider.value);
    var size = currentSize();
    var rects = cover.panelRects(state.layout, size.width, size.height).panels;
    var r = rects[state.selectedPanel];
    var rectPx = { x: r.x * size.width, y: r.y * size.height, w: r.w * size.width, h: r.h * size.height };
    var image = state.photos[panel.photo] && state.photos[panel.photo].image;
    var clamped = cover.clampPan(image, rectPx, panel.zoom, panel.dx, panel.dy);
    panel.dx = clamped.dx;
    panel.dy = clamped.dy;
    draw();
  });

  document.getElementById('resetPanelBtn').addEventListener('click', function () {
    var panel = state.panels[state.selectedPanel];
    if (!panel) return;
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = 0;
    draw();
  });

  // ------------------------------------------------------------ shuffle
  document.getElementById('shuffleBtn').addEventListener('click', function () {
    state.layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
    state.grade = GRADES[Math.floor(Math.random() * GRADES.length)];
    syncPicker('layoutPicker', 'layout', state.layout);
    syncPicker('gradePicker', 'grade', state.grade);
    ensurePanels();
    // Random photo assignment: shuffle the photo order, then round-robin.
    var order = state.photos.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    state.panels.forEach(function (panel, k) {
      panel.photo = order.length ? order[k % order.length] : -1;
      panel.zoom = 1;
      panel.dx = 0;
      panel.dy = 0;
    });
    draw();
  });

  // ------------------------------------------------------------ export
  document.getElementById('exportBtn').addEventListener('click', function () {
    var size = currentSize();
    cover.exportCoverPNG(state, size.width, size.height).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.download = 'vice-city-cover-' + size.width + 'x' + size.height + '.png';
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    });
  });

  // ------------------------------------------------------------ test hook
  // Headless verification only: exposes the live state, a redraw, the photo
  // loader and the PNG exporter.
  window.__coverStudio = {
    state: state,
    draw: draw,
    loadPhotos: loadPhotos,
    exportCoverPNG: function () {
      var size = currentSize();
      return cover.exportCoverPNG(state, size.width, size.height);
    }
  };

  ensurePanels();
  drawWhenFontsReady();
})();
