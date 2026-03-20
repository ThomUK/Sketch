(function () {
  var CANVAS_W = 1280;
  var CANVAS_H = 720;
  var CAPTION_H = 48;
  var CAPTION_TOP = CANVAS_H - CAPTION_H; // 672

  var ERASER_DIAMETER = 30; // display pixels

  // Pre-build the SVG cursor: dotted circle sized to ERASER_DIAMETER
  var ERASER_CURSOR = (function () {
    var pad  = 2;
    var size = ERASER_DIAMETER + pad * 2;
    var c    = size / 2;
    var r    = ERASER_DIAMETER / 2;
    var svg  = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" ' +
      'fill="none" stroke="rgba(0,0,0,0.75)" stroke-width="1.5" stroke-dasharray="3 3"/>' +
      '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + c + ' ' + c + ', crosshair';
  })();

  var isDrawing  = false;
  var eraserMode = 0; // 0 = off, 1 = erase selected colour, 2 = erase all colours
  var lastX = 0, lastY = 0;
  var currentColour = '#222222';
  var currentSize = 4;

  function formatDateTime(d) {
    var p = function(n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function getCanvasCoords(canvas, clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (canvas.width  / r.width),
      y: (clientY - r.top)  * (canvas.height / r.height)
    };
  }

  // Draw a segment, clamping to the caption boundary
  function drawSegment(ctx, x, y) {
    var targetY = Math.min(y, CAPTION_TOP - 1);
    ctx.beginPath();
    ctx.strokeStyle = currentColour;
    ctx.lineWidth = currentSize;
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, targetY);
    ctx.stroke();
    lastX = x;
    lastY = targetY;
    if (y >= CAPTION_TOP) { isDrawing = false; }
  }

  // Erase pixels in a circular brush.
  // Mode 1: colour-selective — only pixels that look like a blend of currentColour on white.
  // Mode 2: erase all — every pixel in the circle becomes white.
  function erase(ctx, canvas, x, y) {
    var scale  = canvas.width / canvas.getBoundingClientRect().width;
    var radius = (ERASER_DIAMETER / 2) * scale;
    var x0 = Math.max(0,            Math.floor(x - radius));
    var y0 = Math.max(0,            Math.floor(y - radius));
    var x1 = Math.min(canvas.width, Math.ceil(x  + radius));
    var y1 = Math.min(CAPTION_TOP,  Math.ceil(y  + radius));
    var w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    var imageData = ctx.getImageData(x0, y0, w, h);
    var data = imageData.data;
    var rSq  = radius * radius;

    if (eraserMode === 2) {
      for (var i = 0; i < data.length; i += 4) {
        var idx = i / 4;
        var px = x0 + (idx % w);
        var py = y0 + Math.floor(idx / w);
        if ((px - x) * (px - x) + (py - y) * (py - y) > rSq) continue;
        data[i] = data[i + 1] = data[i + 2] = 255;
      }
    } else {
      // Direction vector from white to the target colour (the "colour ray")
      var tr = parseInt(currentColour.slice(1, 3), 16);
      var tg = parseInt(currentColour.slice(3, 5), 16);
      var tb = parseInt(currentColour.slice(5, 7), 16);
      var dwr = 255 - tr, dwg = 255 - tg, dwb = 255 - tb;
      var magSq = dwr*dwr + dwg*dwg + dwb*dwb;
      if (magSq < 1) return; // target is white — nothing to erase
      var TOLERANCE = 28;

      for (var i = 0; i < data.length; i += 4) {
        var idx = i / 4;
        var px = x0 + (idx % w);
        var py = y0 + Math.floor(idx / w);
        if ((px - x) * (px - x) + (py - y) * (py - y) > rSq) continue;

        var pr = data[i], pg = data[i + 1], pb = data[i + 2];
        var alpha = ((255-pr)*dwr + (255-pg)*dwg + (255-pb)*dwb) / magSq;
        if (alpha <= 0.02 || alpha > 1.2) continue;

        var a = Math.min(alpha, 1);
        var er = Math.round(255 - a * dwr) - pr;
        var eg = Math.round(255 - a * dwg) - pg;
        var eb = Math.round(255 - a * dwb) - pb;
        if (er*er + eg*eg + eb*eb <= TOLERANCE * TOLERANCE) {
          data[i] = data[i + 1] = data[i + 2] = 255;
        }
      }
    }
    ctx.putImageData(imageData, x0, y0);
  }

  function initCanvas() {
    var canvas = document.getElementById('drawCanvas');
    if (!canvas) { setTimeout(initCanvas, 100); return; }
    var ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Mouse events
    canvas.addEventListener('mousedown', function(e) {
      var coords = getCanvasCoords(canvas, e.clientX, e.clientY);
      if (coords.y >= CAPTION_TOP) return;
      isDrawing = true;
      lastX = coords.x;
      lastY = coords.y;
      if (eraserMode > 0) {
        erase(ctx, canvas, coords.x, coords.y);
      } else {
        ctx.beginPath();
        ctx.fillStyle = currentColour;
        ctx.arc(coords.x, coords.y, currentSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    canvas.addEventListener('mousemove', function(e) {
      if (!isDrawing) return;
      var coords = getCanvasCoords(canvas, e.clientX, e.clientY);
      if (eraserMode > 0) {
        if (coords.y < CAPTION_TOP) { erase(ctx, canvas, coords.x, coords.y); }
      } else {
        drawSegment(ctx, coords.x, coords.y);
      }
    });
    canvas.addEventListener('mouseup',    function() { isDrawing = false; });
    canvas.addEventListener('mouseleave', function() { isDrawing = false; });

    // Touch events
    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      var coords = getCanvasCoords(canvas, e.touches[0].clientX, e.touches[0].clientY);
      if (coords.y >= CAPTION_TOP) return;
      isDrawing = true;
      lastX = coords.x;
      lastY = coords.y;
      if (eraserMode > 0) {
        erase(ctx, canvas, coords.x, coords.y);
      } else {
        ctx.beginPath();
        ctx.fillStyle = currentColour;
        ctx.arc(coords.x, coords.y, currentSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (!isDrawing) return;
      var coords = getCanvasCoords(canvas, e.touches[0].clientX, e.touches[0].clientY);
      if (eraserMode > 0) {
        if (coords.y < CAPTION_TOP) { erase(ctx, canvas, coords.x, coords.y); }
      } else {
        drawSegment(ctx, coords.x, coords.y);
      }
    }, { passive: false });
    canvas.addEventListener('touchend', function() { isDrawing = false; });

    var captionInput = document.getElementById('imageCaption');
    if (captionInput) {
      captionInput.addEventListener('input', updateCaptionPreview);
    }

    setInterval(function() {
      var el = document.querySelector('#captionPreview .caption-datetime');
      if (el) { el.textContent = formatDateTime(new Date()); }
    }, 1000);

    updateCaptionPreview();
  }

  function updateCaptionPreview() {
    var preview = document.getElementById('captionPreview');
    if (!preview) return;
    var left = preview.querySelector('.caption-text');
    var right = preview.querySelector('.caption-datetime');
    if (!left) {
      left  = document.createElement('span');
      left.className = 'caption-text';
      right = document.createElement('span');
      right.className = 'caption-datetime';
      preview.appendChild(left);
      preview.appendChild(right);
    }
    left.textContent  = getCaption();
    right.textContent = formatDateTime(new Date());
  }

  function updateEraserToggle() {
    var toggle = document.getElementById('eraserToggle');
    var canvas = document.getElementById('drawCanvas');
    if (!toggle) return;

    if (eraserMode === 1) {
      var hatch = 'repeating-linear-gradient(45deg,  ' + currentColour + ' 0, ' + currentColour + ' 3px, transparent 3px, transparent 8px),' +
                  'repeating-linear-gradient(-45deg, ' + currentColour + ' 0, ' + currentColour + ' 3px, transparent 3px, transparent 8px),' +
                  '#fff';
      toggle.textContent = '';
      toggle.style.background  = hatch;
      toggle.style.borderStyle = 'solid';
      toggle.style.borderColor = currentColour;
      toggle.style.boxShadow   = '0 0 0 2px #f0f0f0, 0 0 0 4px ' + currentColour;
      toggle.style.color       = '';
      if (canvas) { canvas.style.cursor = ERASER_CURSOR; }
    } else if (eraserMode === 2) {
      toggle.textContent = 'all';
      toggle.style.background  = '#fff';
      toggle.style.borderStyle = 'solid';
      toggle.style.borderColor = '#444';
      toggle.style.boxShadow   = '0 0 0 2px #f0f0f0, 0 0 0 4px #444';
      toggle.style.color       = '#444';
      if (canvas) { canvas.style.cursor = ERASER_CURSOR; }
    } else {
      toggle.textContent = '';
      toggle.style.background  = '#fff';
      toggle.style.borderStyle = 'dotted';
      toggle.style.borderColor = '';
      toggle.style.boxShadow   = '';
      toggle.style.color       = '';
      if (canvas) { canvas.style.cursor = 'crosshair'; }
    }
  }

  function toggleEraser() {
    eraserMode = (eraserMode + 1) % 3;
    updateEraserToggle();
  }

  function setColour(col, el) {
    currentColour = col;
    if (eraserMode === 1) { updateEraserToggle(); } // refresh crosshatch colour
    document.querySelectorAll('.colour-swatch').forEach(function(s) {
      s.classList.remove('active');
    });
    el.classList.add('active');
  }

  function setSize(val) { currentSize = parseInt(val); }

  function clearCanvas() {
    var canvas = document.getElementById('drawCanvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  function setStatus(msg) {
    document.getElementById('copyStatus').textContent = msg;
  }

  function getCaption() {
    var el = document.getElementById('imageCaption');
    return el ? el.value.trim() : '';
  }

  function slugify(text) {
    if (!text) return 'sketch';
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sketch';
  }

  function buildFlat() {
    var canvas  = document.getElementById('drawCanvas');
    var caption = getCaption();
    var datetime = formatDateTime(new Date());
    var padding = 20;

    var flat = document.createElement('canvas');
    flat.width  = CANVAS_W;
    flat.height = CANVAS_H;
    var ctx = flat.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);

    ctx.fillStyle = '#80CBC4';
    ctx.fillRect(0, CAPTION_TOP, flat.width, CAPTION_H);

    ctx.fillStyle = '#000';
    ctx.font = 'bold 18px monospace';
    ctx.textBaseline = 'middle';
    var midY = CAPTION_TOP + CAPTION_H / 2;

    ctx.textAlign = 'left';
    ctx.fillText(caption, padding, midY);

    ctx.textAlign = 'right';
    ctx.fillText(datetime, flat.width - padding, midY);

    return flat;
  }

  function openInNewWindow() {
    var flat     = buildFlat();
    var filename = slugify(getCaption()) + '.png';
    flat.toBlob(function(blob) {
      var blobUrl = URL.createObjectURL(blob);
      var win = window.open('', '_blank');
      if (!win) {
        setStatus('Popup blocked - please allow popups and try again');
        URL.revokeObjectURL(blobUrl);
        return;
      }
      var d = win.document;
      d.title = filename;
      d.body.style.cssText = 'margin:0;background:#eee;display:flex;flex-direction:column;align-items:center;padding:20px;gap:14px;font-family:monospace;color:#333;';
      var p = d.createElement('p');
      p.style.fontSize = '13px';
      p.innerHTML = 'Right-click the image \u2192 <strong>Copy Image</strong> to place it on the clipboard, or use the link below to save.';
      d.body.appendChild(p);
      var a = d.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.cssText = 'font-family:monospace;font-size:13px;color:#222;';
      a.textContent = '\u2193 Save as ' + filename;
      d.body.appendChild(a);
      var img = d.createElement('img');
      img.src = blobUrl;
      img.style.cssText = 'max-width:100%;border:1px solid #ccc;border-radius:4px;';
      d.body.appendChild(img);
      setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
      setStatus('\u2197 Opened in new window');
      setTimeout(function() { setStatus(''); }, 5000);
    }, 'image/png');
  }

  window.setColour = setColour;
  window.setSize = setSize;
  window.clearCanvas = clearCanvas;
  window.openInNewWindow = openInNewWindow;
  window.toggleEraser = toggleEraser;

  document.addEventListener('DOMContentLoaded', initCanvas);
})();
