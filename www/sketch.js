// Sketch — all drawing logic wrapped in an IIFE to avoid polluting the global scope.
// Only the functions referenced by inline onclick handlers are exposed on window.
(function () {

  // Canvas buffer dimensions (fixed export resolution)
  var CANVAS_W = 1280;
  var CANVAS_H = 720;

  // Caption bar occupies the bottom 48px of the canvas buffer.
  // Drawing is blocked below CAPTION_TOP so strokes never cover the caption.
  var CAPTION_H   = 48;
  var CAPTION_TOP = CANVAS_H - CAPTION_H; // 672

  var ERASER_DIAMETER = 30; // eraser brush size in display pixels
  var TOLERANCE = 28;       // colour-selective erase: max RGB error before a pixel is considered a match

  // Build the SVG eraser cursor once at startup: a dotted circle matching ERASER_DIAMETER.
  // Encoded as a data URL and used as a CSS cursor value with the hotspot centred.
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

  // Drawing state
  var isDrawing  = false;
  var eraserMode = 0; // 0 = off, 1 = erase selected colour only, 2 = erase all colours
  var lastX = 0, lastY = 0;
  var currentColour = '#222222';
  var currentSize = 4;

  // Returns a zero-padded YYYY-MM-DD HH:MM:SS string for the given Date.
  function formatDateTime(d) {
    var p = function(n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  // Converts a client pointer position to canvas buffer coordinates,
  // accounting for the difference between display size and buffer resolution.
  function getCanvasCoords(canvas, clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (canvas.width  / r.width),
      y: (clientY - r.top)  * (canvas.height / r.height)
    };
  }

  // Draws a line segment from (lastX, lastY) to (x, y), clamped to the caption boundary.
  // Stops drawing if the pointer crosses into the caption zone.
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

  // Draws a filled circle at (x, y) — used on mousedown/touchstart so a tap
  // always produces a visible mark even without a subsequent move event.
  function drawPoint(ctx, x, y) {
    ctx.beginPath();
    ctx.fillStyle = currentColour;
    ctx.arc(x, y, currentSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dispatches a pointer move to either erase or draw, used by both
  // mousemove and touchmove handlers to avoid duplicating the logic.
  function handlePointer(ctx, canvas, x, y) {
    if (eraserMode > 0) {
      if (y < CAPTION_TOP) { erase(ctx, canvas, x, y); }
    } else {
      drawSegment(ctx, x, y);
    }
  }

  // Erases pixels within a circular brush centred at (x, y).
  //
  // Mode 1 — colour-selective: projects each pixel onto the white→currentColour
  // ray in RGB space. A pixel is erased only if it lies close enough to that ray
  // (within TOLERANCE), so strokes of other colours are left untouched.
  //
  // Mode 2 — erase all: every pixel inside the circle is set to white.
  function erase(ctx, canvas, x, y) {
    // Scale the display-pixel brush radius to canvas buffer pixels
    var scale  = canvas.width / canvas.getBoundingClientRect().width;
    var radius = (ERASER_DIAMETER / 2) * scale;

    // Bounding box of the affected region, clamped to the drawing area
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
      // Direction vector from white (255,255,255) toward currentColour
      var tr = parseInt(currentColour.slice(1, 3), 16);
      var tg = parseInt(currentColour.slice(3, 5), 16);
      var tb = parseInt(currentColour.slice(5, 7), 16);
      var dwr = 255 - tr, dwg = 255 - tg, dwb = 255 - tb;
      var magSq = dwr*dwr + dwg*dwg + dwb*dwb;
      if (magSq < 1) return; // currentColour is white — nothing to erase

      for (var i = 0; i < data.length; i += 4) {
        var idx = i / 4;
        var px = x0 + (idx % w);
        var py = y0 + Math.floor(idx / w);
        if ((px - x) * (px - x) + (py - y) * (py - y) > rSq) continue;

        var pr = data[i], pg = data[i + 1], pb = data[i + 2];

        // Project the pixel onto the colour ray: alpha = how much of the target
        // colour is present, assuming the pixel is alpha*colour + (1-alpha)*white
        var alpha = ((255-pr)*dwr + (255-pg)*dwg + (255-pb)*dwb) / magSq;
        if (alpha <= 0.02 || alpha > 1.2) continue; // pixel is near-white or a different hue

        // Accept the pixel if it falls within TOLERANCE of the expected blended colour
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

  // Sets up all canvas event listeners and initialises the caption bar.
  // Retries after 100 ms if the canvas element is not yet in the DOM.
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
        drawPoint(ctx, coords.x, coords.y);
      }
    });
    canvas.addEventListener('mousemove', function(e) {
      if (!isDrawing) return;
      var coords = getCanvasCoords(canvas, e.clientX, e.clientY);
      handlePointer(ctx, canvas, coords.x, coords.y);
    });
    canvas.addEventListener('mouseup',    function() { isDrawing = false; });
    canvas.addEventListener('mouseleave', function() { isDrawing = false; });

    // Touch events (passive: false required to allow preventDefault on touchmove)
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
        drawPoint(ctx, coords.x, coords.y);
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (!isDrawing) return;
      var coords = getCanvasCoords(canvas, e.touches[0].clientX, e.touches[0].clientY);
      handlePointer(ctx, canvas, coords.x, coords.y);
    }, { passive: false });
    canvas.addEventListener('touchend', function() { isDrawing = false; });

    // Auto-focus the caption when the user starts typing anywhere on the page,
    // so they never need to click the caption bar before adding text.
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return; // ignore non-printable keys
      var caption = document.querySelector('#captionPreview .caption-text');
      if (!caption || document.activeElement === caption) return;
      caption.focus();
    });

    // Keep the datetime in the caption bar ticking every second
    setInterval(function() {
      var el = document.querySelector('#captionPreview .caption-datetime');
      if (el) { el.textContent = formatDateTime(new Date()); }
    }, 1000);

    updateCaptionPreview();
  }

  // Creates the caption bar spans on first call, then updates the datetime each tick.
  // The caption text span is contenteditable — the user types directly into it.
  function updateCaptionPreview() {
    var preview = document.getElementById('captionPreview');
    if (!preview) return;
    var left = preview.querySelector('.caption-text');
    var right = preview.querySelector('.caption-datetime');
    if (!left) {
      left = document.createElement('span');
      left.className = 'caption-text';
      left.contentEditable = 'true';
      left.dataset.placeholder = 'Start typing to add a caption...';
      // Prevent newlines — caption must stay single-line
      left.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') e.preventDefault();
      });
      // Browsers insert a <br> when the last character is deleted, which
      // prevents the :empty CSS selector from matching. Clear it immediately.
      left.addEventListener('input', function() {
        if (left.innerHTML === '<br>') left.innerHTML = '';
      });
      right = document.createElement('span');
      right.className = 'caption-datetime';
      preview.appendChild(left);
      preview.appendChild(right);
    }
    right.textContent = formatDateTime(new Date());
  }

  // Updates the eraser toggle button's visual state to reflect the current eraserMode.
  // Mode 0: inactive (dotted border, white fill)
  // Mode 1: colour-selective (crosshatch in currentColour, matching border ring)
  // Mode 2: erase-all ("all" label, dark border ring)
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
    if (eraserMode === 1) { updateEraserToggle(); } // refresh crosshatch to match new colour
    var prev = document.querySelector('.colour-swatch.active');
    if (prev) prev.classList.remove('active');
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

  // Returns the current caption text, read directly from the contenteditable span.
  function getCaption() {
    var el = document.querySelector('#captionPreview .caption-text');
    return el ? el.textContent.trim() : '';
  }

  // Converts caption text to a URL-safe filename slug.
  function slugify(text) {
    if (!text) return 'sketch';
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sketch';
  }

  // Composites the drawing canvas and caption bar into a single flat 1280×720 canvas
  // suitable for export. The caption bar is re-rendered at full resolution here,
  // independent of how it appears in the responsive on-screen preview.
  function buildFlat() {
    var canvas   = document.getElementById('drawCanvas');
    var caption  = getCaption();
    var datetime = formatDateTime(new Date());
    var padding  = 20;

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

  // Exports the current sketch as a PNG by opening a new popup window.
  // The popup contains an instruction, the full-resolution image, and a save link.
  // Uses a data URL (self-contained base64) rather than a blob URL to avoid
  // cross-context blob access failures in restrictive browser security environments
  // (e.g. enterprise policies blocking blob URL access from iframe-opened popups).
  function openInNewWindow() {
    var flat     = buildFlat();
    var filename = slugify(getCaption()) + '.png';
    var dataUrl  = flat.toDataURL('image/png');
    var win = window.open('', '_blank');
    if (!win) {
      setStatus('Popup blocked - please allow popups and try again');
      return;
    }
    var d = win.document;
    d.title = filename;
    d.body.style.cssText = 'margin:0;background:#f0f0f0;display:flex;flex-direction:column;align-items:center;padding:24px;gap:16px;font-family:monospace;color:#333;height:100vh;box-sizing:border-box;overflow:hidden;';
    var p = d.createElement('p');
    p.style.cssText = 'font-family:monospace;font-size:0.9rem;color:#666;text-transform:uppercase;letter-spacing:1px;';
    p.textContent = 'Right-click the image to copy, or save using the button below.';
    d.body.appendChild(p);
    var img = d.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'flex:1;min-height:0;max-width:100%;object-fit:contain;border:1px solid #ccc;border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,0.1);';
    d.body.appendChild(img);
    var a = d.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.style.cssText = 'display:inline-flex;align-items:center;height:52px;padding:0 40px;background:#222;color:#fff;font-family:monospace;font-size:1rem;text-transform:uppercase;letter-spacing:1px;text-decoration:none;border-radius:6px;border:1px solid #222;';
    a.textContent = '\u2193 Save as ' + filename;
    d.body.appendChild(a);
    setStatus('\u2197 Opened in new window');
    setTimeout(function() { setStatus(''); }, 5000);
  }

  // Expose only what the HTML onclick attributes need
  window.setColour = setColour;
  window.setSize = setSize;
  window.clearCanvas = clearCanvas;
  window.openInNewWindow = openInNewWindow;
  window.toggleEraser = toggleEraser;

  document.addEventListener('DOMContentLoaded', initCanvas);
})();
