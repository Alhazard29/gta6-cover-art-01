// Vice City Cover Studio — skeleton (chunk 1).
// Holds the editor state and a placeholder preview. The cover engine
// (layouts, grades, per-panel crop/pan/zoom, PNG export of the real cover)
// lands in the next chunk; this file only wires the controls and draws a
// stand-in so the page opens and works offline in desktop Chrome.

(function () {
  'use strict';

  var state = {
    photos: [],          // { url, name, width, height } — read locally, never uploaded
    layout: 'vice-grid',
    grade: 'sunset',
    title: 'VICE CITY',
    subtitle: 'Welcome to Leonida',
  };

  var canvas = document.getElementById('cover-canvas');
  var ctx = canvas.getContext('2d');
  var statusEl = document.getElementById('status');
  var photoCountEl = document.getElementById('photo-count');

  function setStatus(text) {
    statusEl.textContent = text;
  }

  // Placeholder preview: a Vice City sunset gradient with the title, so the
  // canvas is never blank. The real cover engine replaces drawPlaceholder.
  function drawPlaceholder() {
    var w = canvas.width;
    var h = canvas.height;
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2a0f3d');
    sky.addColorStop(0.55, '#ff2e88');
    sky.addColorStop(0.8, '#ff7a3d');
    sky.addColorStop(1, '#1a0b2e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Synthwave sun.
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, w * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd166';
    ctx.fill();

    // Title band.
    ctx.fillStyle = 'rgba(13, 10, 20, 0.85)';
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.fillStyle = '#f5eefc';
    ctx.textAlign = 'center';
    ctx.font = 'bold 96px system-ui, sans-serif';
    ctx.fillText(state.title, w / 2, h * 0.88);
    ctx.font = '40px system-ui, sans-serif';
    ctx.fillStyle = '#22e6ff';
    ctx.fillText(state.subtitle, w / 2, h * 0.95);
  }

  function refresh() {
    drawPlaceholder();
    photoCountEl.textContent = state.photos.length === 0
      ? 'No photos yet — add one or more.'
      : state.photos.length + (state.photos.length === 1 ? ' photo loaded.' : ' photos loaded.');
  }

  // Photo upload: local object URLs only, never leave the machine.
  document.getElementById('photo-input').addEventListener('change', function (event) {
    var files = Array.prototype.slice.call(event.target.files || []);
    files.forEach(function (file) {
      if (!file.type || file.type.indexOf('image/') !== 0) return;
      var img = new Image();
      img.onload = function () {
        state.photos.push({ url: URL.createObjectURL(file), name: file.name, width: img.naturalWidth, height: img.naturalHeight });
        setStatus(state.photos.length + (state.photos.length === 1 ? ' photo loaded.' : ' photos loaded.'));
        refresh();
      };
      img.src = URL.createObjectURL(file);
    });
    event.target.value = '';
  });

  // Layout + grade pickers: state only in this chunk; the engine reads them.
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
      refresh();
    });
  }
  wirePicker('layout-picker', 'layout');
  wirePicker('grade-picker', 'grade');

  document.getElementById('title-input').addEventListener('input', function (event) {
    state.title = event.target.value;
    refresh();
  });
  document.getElementById('subtitle-input').addEventListener('input', function (event) {
    state.subtitle = event.target.value;
    refresh();
  });

  document.getElementById('shuffle-btn').addEventListener('click', function () {
    var layouts = ['vice-grid', 'four-panel', 'nine-grid', 'full-bleed', 'triple-strip'];
    var grades = ['sunset', 'neon', 'dusk', 'noir', 'candy'];
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    document.querySelectorAll('#layout-picker button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-layout') === state.layout);
    });
    document.querySelectorAll('#grade-picker button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-grade') === state.grade);
    });
    setStatus('Shuffled — layout ' + state.layout + ', grade ' + state.grade + '.');
    refresh();
  });

  // Export: downloads whatever is on the canvas as a PNG. The real cover
  // export (offscreen render at the chosen size) replaces this in chunk 2.
  document.getElementById('export-btn').addEventListener('click', function () {
    var size = document.getElementById('size-select').value;
    canvas.toBlob(function (blob) {
      if (!blob) { setStatus('Export failed — canvas is empty.'); return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vice-city-cover-' + size + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      setStatus('Exported placeholder PNG (' + size + '). The real cover export lands in the next chunk.');
    }, 'image/png');
  });

  // Small test hook for headless verification only.
  window.__coverStudio = { state: state, refresh: refresh };

  refresh();
})();
