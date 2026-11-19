// Vice City Cover Studio — minimal working shell (Chunk A).
// Loads photos from the user's machine, keeps the editor state, and draws a
// simple placeholder preview. The cover engine (Chunk B) adds cover.js and
// extends this file with the real multi-panel rendering and PNG export.

(function () {
  'use strict';

  var state = {
    layout: 'vice-grid',
    grade: 'vice-sunset',
    title: 'VICE CITY',
    subtitle: 'Welcome back',
    size: '1080x1080',
    photos: [] // { url, image } entries, loaded from local files only
  };

  var GRADES = {
    'vice-sunset': ['#ff6b5e', '#ffb347', '#2ec4b6'],
    'neon-nights': ['#ff2ea6', '#2ec4b6', '#7b2fff'],
    'palm-dusk': ['#ff8c42', '#e85d75', '#3a506b'],
    'noir': ['#e8e8e8', '#888888', '#111111'],
    'candy-pop': ['#ff5d8f', '#ffd166', '#06d6a0']
  };

  var canvas = document.getElementById('coverCanvas');
  var ctx = canvas.getContext('2d');

  function currentSize() {
    var parts = state.size.split('x');
    return { width: parseInt(parts[0], 10), height: parseInt(parts[1], 10) };
  }

  function drawPreview() {
    var size = currentSize();
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    var palette = GRADES[state.grade] || GRADES['vice-sunset'];
    var w = size.width;
    var h = size.height;

    // Sunset gradient backdrop.
    var gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.55, palette[1]);
    gradient.addColorStop(1, palette[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // First photo fills the frame when one is loaded, dimmed under the grade.
    if (state.photos.length > 0 && state.photos[0].image) {
      var img = state.photos[0].image;
      var scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      var dw = img.naturalWidth * scale;
      var dh = img.naturalHeight * scale;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(15, 32, 39, 0.25)';
      ctx.fillRect(0, 0, w, h);
    } else {
      // Placeholder sun and palm silhouette when no photo is loaded yet.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.38, w * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(15, 32, 39, 0.85)';
      ctx.font = 'bold ' + Math.round(w * 0.04) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ADD YOUR PHOTOS TO BEGIN', w / 2, h * 0.62);
    }

    // Bold caption lettering.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.round(w * 0.012);
    ctx.shadowOffsetY = Math.round(w * 0.006);
    ctx.font = Math.round(w * 0.11) + 'px Anton, "Arial Narrow", sans-serif';
    ctx.fillText(state.title.toUpperCase(), w / 2, h * 0.86);
    ctx.font = Math.round(w * 0.045) + 'px Pacifico, cursive';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(state.subtitle, w / 2, h * 0.93);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  function bindPicker(elementId, key) {
    var picker = document.getElementById(elementId);
    picker.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button) return;
      var buttons = picker.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove('active');
      button.classList.add('active');
      state[key] = button.getAttribute('data-' + key);
      drawPreview();
    });
  }

  function loadPhotos(files) {
    state.photos = [];
    var list = Array.prototype.slice.call(files);
    list.forEach(function (file) {
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        drawPreview();
      };
      image.src = url;
      state.photos.push({ url: url, image: image });
    });
    drawPreview();
  }

  document.getElementById('photoInput').addEventListener('change', function (event) {
    loadPhotos(event.target.files);
  });

  bindPicker('layoutPicker', 'layout');
  bindPicker('gradePicker', 'grade');

  document.getElementById('titleInput').addEventListener('input', function (event) {
    state.title = event.target.value;
    drawPreview();
  });

  document.getElementById('subtitleInput').addEventListener('input', function (event) {
    state.subtitle = event.target.value;
    drawPreview();
  });

  document.getElementById('sizeSelect').addEventListener('change', function (event) {
    state.size = event.target.value;
    drawPreview();
  });

  document.getElementById('shuffleBtn').addEventListener('click', function () {
    var layouts = ['vice-grid', 'four-panel', 'nine-grid', 'full-bleed', 'triple-strip'];
    var grades = Object.keys(GRADES);
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    document.querySelectorAll('#layoutPicker button').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-layout') === state.layout);
    });
    document.querySelectorAll('#gradePicker button').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-grade') === state.grade);
    });
    drawPreview();
  });

  document.getElementById('exportBtn').addEventListener('click', function () {
    // Placeholder export until Chunk B wires the real cover engine.
    var link = document.createElement('a');
    link.download = 'vice-city-cover.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // Expose the editor state for the cover engine (Chunk B) to extend.
  window.coverStudio = { state: state, drawPreview: drawPreview };

  drawPreview();
})();
