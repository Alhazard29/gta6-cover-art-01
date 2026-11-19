// Vice City Cover Studio — editor (chunk 2, written fresh).
//
// Owns the editor state and wires every control to the cover engine
// (app/src/cover.js): photo upload with round-robin auto-assign, canvas
// interaction (click to select a panel, drag to pan, wheel to zoom toward
// the cursor, double-click to swap the photo), a thumbnail strip, a zoom
// slider, Shuffle, and a real PNG export at the chosen size. Photos are
// read locally via object URLs and never leave the machine.

(function () {
  'use strict';

  var state = {
    photos: [],          // { img, url, name, width, height } — local only
    layout: 'vice-grid',
    grade: 'sunset',
    title: 'VICE CITY',
    subtitle: 'Welcome to Leonida',
    panels: [],          // { photoIdx, zoom, dx, dy } — kept by CoverEngine
    selected: 0
  };

  var canvas = document.getElementById('cover-canvas');
  var ctx = canvas.getContext('2d');
  var statusEl = document.getElementById('status');
  var photoCountEl = document.getElementById('photo-count');
  var thumbsEl = document.getElementById('thumbnails');
  var zoomSlider = document.getElementById('zoom-slider');
  var zoomLabel = document.getElementById('zoom-value');
  var panelHintEl = document.getElementById('panel-hint');
  var sizeSelect = document.getElementById('size-select');

  function setStatus(text) { statusEl.textContent = text; }

  // The preview canvas matches the export size so what you see is what
  // you get (CSS scales it down for display).
  function syncCanvasSize() {
    var parts = sizeSelect.value.split('x');
    canvas.width = parseInt(parts[0], 10);
    canvas.height = parseInt(parts[1], 10);
  }

  function render() {
    CoverEngine.ensurePanels(state);
    CoverEngine.renderCover(ctx, canvas.width, canvas.height, state, { showSelection: true });
    syncPanelControls();
  }

  function syncPanelControls() {
    CoverEngine.ensurePanels(state);
    var panel = state.panels[state.selected];
    var n = CoverEngine.panelCount(state.layout);
    panelHintEl.textContent = 'Panel ' + (state.selected + 1) + ' of ' + n +
      (panel && panel.photoIdx >= 0 ? ' — ' + state.photos[panel.photoIdx].name : ' — empty, click a thumbnail to fill it.');
    if (panel) {
      zoomSlider.value = Math.round(panel.zoom * 100);
      zoomLabel.textContent = Math.round(panel.zoom * 100) + '%';
    }
    Array.prototype.forEach.call(thumbsEl.querySelectorAll('img'), function (img, i) {
      img.classList.toggle('selected', !!(panel && panel.photoIdx === i));
    });
  }

  // ------------------------------------------------------------ thumbnails
  function rebuildThumbs() {
    thumbsEl.innerHTML = '';
    state.photos.forEach(function (photo, i) {
      var img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name;
      img.title = photo.name + ' — click to place on the selected panel';
      img.addEventListener('click', function () { assignPhoto(i); });
      thumbsEl.appendChild(img);
    });
    photoCountEl.textContent = state.photos.length === 0
      ? 'No photos yet — add one or more.'
      : state.photos.length + (state.photos.length === 1 ? ' photo loaded.' : ' photos loaded.');
  }

  function assignPhoto(photoIdx) {
    CoverEngine.ensurePanels(state);
    var panel = state.panels[state.selected];
    panel.photoIdx = photoIdx;
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = 0;
    panel.manual = true;
    setStatus('Placed "' + state.photos[photoIdx].name + '" on panel ' + (state.selected + 1) + '.');
    render();
  }

  // Auto-assign a newly loaded photo: first empty panel, else the first
  // panel the user did not place by hand (round-robin, wrapping). Manual
  // placements are never overwritten by auto-assign.
  function autoAssign() {
    CoverEngine.ensurePanels(state);
    var idx = state.photos.length - 1;
    var target = -1;
    for (var i = 0; i < state.panels.length; i++) {
      if (state.panels[i].photoIdx < 0) { target = i; break; }
    }
    if (target < 0) {
      for (var j = 0; j < state.panels.length; j++) {
        if (!state.panels[j].manual) { target = j; break; }
      }
    }
    if (target < 0) return;
    var panel = state.panels[target];
    panel.photoIdx = idx;
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = 0;
    panel.manual = false;
    state.selected = target;
  }

  // After a batch of photos loads, wrap-fill any panels still empty so the
  // cover is never half-empty once photos exist (round-robin: panel i shows
  // photo i % photos.length). Manual placements are left alone.
  function fillRemaining() {
    CoverEngine.ensurePanels(state);
    if (state.photos.length === 0) return;
    for (var i = 0; i < state.panels.length; i++) {
      var panel = state.panels[i];
      if (panel.photoIdx < 0) {
        panel.photoIdx = i % state.photos.length;
        panel.zoom = 1;
        panel.dx = 0;
        panel.dy = 0;
        panel.manual = false;
      }
    }
  }

  // ------------------------------------------------------------- photo load
  document.getElementById('photo-input').addEventListener('change', function (event) {
    var files = Array.prototype.slice.call(event.target.files || []).filter(function (f) {
      return f.type && f.type.indexOf('image/') === 0;
    });
    var loaded = 0;
    files.forEach(function (file) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        state.photos.push({ img: img, url: url, name: file.name, width: img.naturalWidth, height: img.naturalHeight });
        autoAssign();
        loaded++;
        setStatus(state.photos.length + (state.photos.length === 1 ? ' photo loaded.' : ' photos loaded.'));
        if (loaded === files.length) fillRemaining();
        rebuildThumbs();
        render();
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        loaded++;
        setStatus('Could not read "' + file.name + '" — try another image.');
        if (loaded === files.length) fillRemaining();
      };
      img.src = url;
    });
    event.target.value = '';
  });

  // ------------------------------------------------------- canvas interaction
  function canvasPoint(event) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function panelAt(x, y) {
    var geo = CoverEngine.LAYOUTS[state.layout](canvas.width, canvas.height);
    for (var i = 0; i < geo.panels.length; i++) {
      var r = geo.panels[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }

  function panelRect(i) {
    var geo = CoverEngine.LAYOUTS[state.layout](canvas.width, canvas.height);
    return geo.panels[i];
  }

  var drag = null; // { panel, startX, startY, dx, dy, moved }

  canvas.addEventListener('mousedown', function (event) {
    var p = canvasPoint(event);
    var i = panelAt(p.x, p.y);
    if (i < 0) return;
    state.selected = i;
    var panel = state.panels[i];
    drag = { panel: i, startX: p.x, startY: p.y, dx: panel.dx, dy: panel.dy, moved: false };
    render();
  });

  canvas.addEventListener('mousemove', function (event) {
    if (!drag) return;
    var p = canvasPoint(event);
    var dx = p.x - drag.startX;
    var dy = p.y - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    var panel = state.panels[drag.panel];
    if (panel.photoIdx < 0) return; // empty panels ignore drags
    var photo = state.photos[panel.photoIdx];
    panel.dx = drag.dx + dx;
    panel.dy = drag.dy + dy;
    CoverEngine.clampPan(panel, photo.width, photo.height, panelRect(drag.panel));
    render();
  });

  window.addEventListener('mouseup', function () { drag = null; });

  // Wheel: zoom toward the cursor, 1x–3x.
  canvas.addEventListener('wheel', function (event) {
    event.preventDefault();
    var p = canvasPoint(event);
    var i = panelAt(p.x, p.y);
    if (i < 0) return;
    state.selected = i;
    var panel = state.panels[i];
    if (panel.photoIdx < 0) return;
    var photo = state.photos[panel.photoIdx];
    var rect = panelRect(i);
    var base = Math.max(rect.w / photo.width, rect.h / photo.height);
    var scale = base * panel.zoom;
    // Image point under the cursor stays under the cursor after zooming.
    var ix = (p.x - (rect.x + rect.w / 2 + panel.dx)) / scale;
    var iy = (p.y - (rect.y + rect.h / 2 + panel.dy)) / scale;
    var factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    panel.zoom = Math.max(1, Math.min(3, panel.zoom * factor));
    var newScale = base * panel.zoom;
    panel.dx = p.x - (rect.x + rect.w / 2) - ix * newScale;
    panel.dy = p.y - (rect.y + rect.h / 2) - iy * newScale;
    CoverEngine.clampPan(panel, photo.width, photo.height, rect);
    render();
  }, { passive: false });

  // Double-click: swap the panel's photo for the next loaded one.
  canvas.addEventListener('dblclick', function (event) {
    var p = canvasPoint(event);
    var i = panelAt(p.x, p.y);
    if (i < 0 || state.photos.length === 0) return;
    state.selected = i;
    var panel = state.panels[i];
    panel.photoIdx = panel.photoIdx < 0 ? 0 : (panel.photoIdx + 1) % state.photos.length;
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = 0;
    panel.manual = true;
    setStatus('Panel ' + (i + 1) + ' now shows "' + state.photos[panel.photoIdx].name + '".');
    render();
  });

  // ------------------------------------------------------------- panel tools
  zoomSlider.addEventListener('input', function () {
    CoverEngine.ensurePanels(state);
    var panel = state.panels[state.selected];
    if (panel.photoIdx < 0) { setStatus('Panel ' + (state.selected + 1) + ' is empty — add a photo first.'); return; }
    panel.zoom = zoomSlider.value / 100;
    var photo = state.photos[panel.photoIdx];
    CoverEngine.clampPan(panel, photo.width, photo.height, panelRect(state.selected));
    render();
  });

  document.getElementById('reset-panel-btn').addEventListener('click', function () {
    CoverEngine.ensurePanels(state);
    var panel = state.panels[state.selected];
    panel.zoom = 1;
    panel.dx = 0;
    panel.dy = 0;
    setStatus('Panel ' + (state.selected + 1) + ' reset (zoom 100%, centred).');
    render();
  });

  // ------------------------------------------------------------ pickers etc.
  function wirePicker(id, key) {
    var picker = document.getElementById(id);
    picker.addEventListener('click', function (event) {
      var btn = event.target.closest('button[data-' + key + ']');
      if (!btn) return;
      state[key] = btn.getAttribute('data-' + key);
      Array.prototype.forEach.call(picker.querySelectorAll('button'), function (b) {
        b.classList.toggle('active', b === btn);
      });
      setStatus('Layout ' + state.layout + ' · grade ' + state.grade + '.');
      render();
    });
  }
  wirePicker('layout-picker', 'layout');
  wirePicker('grade-picker', 'grade');

  document.getElementById('title-input').addEventListener('input', function (event) {
    state.title = event.target.value;
    render();
  });
  document.getElementById('subtitle-input').addEventListener('input', function (event) {
    state.subtitle = event.target.value;
    render();
  });

  sizeSelect.addEventListener('change', function () {
    syncCanvasSize();
    setStatus('Preview size ' + sizeSelect.value + '.');
    render();
  });

  document.getElementById('shuffle-btn').addEventListener('click', function () {
    var layouts = Object.keys(CoverEngine.LAYOUTS);
    var grades = Object.keys(CoverEngine.GRADES);
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    document.querySelectorAll('#layout-picker button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-layout') === state.layout);
    });
    document.querySelectorAll('#grade-picker button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-grade') === state.grade);
    });
    // Shuffle the photo assignment too.
    CoverEngine.ensurePanels(state);
    var order = state.photos.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    state.panels.forEach(function (panel, pi) {
      panel.photoIdx = order.length === 0 ? -1 : order[pi % order.length];
      panel.zoom = 1;
      panel.dx = 0;
      panel.dy = 0;
      panel.manual = false;
    });
    setStatus('Shuffled — layout ' + state.layout + ', grade ' + state.grade + ', new photo order.');
    render();
  });

  // Export: a real PNG of the cover at the chosen size (no selection outline).
  document.getElementById('export-btn').addEventListener('click', function () {
    var size = sizeSelect.value;
    var parts = size.split('x');
    var W = parseInt(parts[0], 10);
    var H = parseInt(parts[1], 10);
    setStatus('Exporting PNG (' + size + ')…');
    CoverEngine.exportCoverPNG(W, H, state).then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vice-city-cover-' + size + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      setStatus('Exported vice-city-cover-' + size + '.png (' + Math.round(blob.size / 1024) + ' KiB).');
    }).catch(function (err) {
      setStatus('Export failed — ' + err.message);
    });
  });

  // ------------------------------------------------------------ test hook
  window.__coverStudio = {
    state: state,
    render: render,
    exportCoverPNG: function (W, H) { return CoverEngine.exportCoverPNG(W, H, state); },
    selectPanel: function (i) { state.selected = i; render(); },
    loadPhotos: function (files) {
      // For headless verification: load File/Blob objects as photos.
      var promises = Array.prototype.slice.call(files).map(function (file) {
        return new Promise(function (resolve) {
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            state.photos.push({ img: img, url: url, name: file.name || 'photo', width: img.naturalWidth, height: img.naturalHeight });
            autoAssign();
            resolve();
          };
          img.src = url;
        });
      });
      return Promise.all(promises).then(function () { fillRemaining(); rebuildThumbs(); render(); });
    }
  };

  // Fonts first, then the first render — the canvas must use Anton/Pacifico.
  syncCanvasSize();
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load('16px Anton'),
      document.fonts.load('16px Pacifico')
    ]).then(function () { render(); }).catch(function () { render(); });
  }
  render();
})();
