(function () {
  var CANVAS_W = 1280;
  var CANVAS_H = 720;
  var CAPTION_H = 48;

  var isDrawing = false;
  var lastX = 0, lastY = 0;
  var currentColour = '#222222';
  var currentSize = 4;

  // Scale display coordinates to canvas pixel coordinates
  function getCanvasCoords(canvas, clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (canvas.width  / r.width),
      y: (clientY - r.top)  * (canvas.height / r.height)
    };
  }

  // Y coordinate above which drawing is allowed (full height when no label)
  function captionZoneStart() {
    return getLabel() ? CANVAS_H - CAPTION_H : CANVAS_H;
  }

  // Draw a segment, clamping to the caption zone boundary and stopping there
  function drawSegment(ctx, x, y) {
    var limit = captionZoneStart();
    var targetY = Math.min(y, limit - 1);
    ctx.beginPath();
    ctx.strokeStyle = currentColour;
    ctx.lineWidth = currentSize;
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, targetY);
    ctx.stroke();
    lastX = x;
    lastY = targetY;
    if (y >= limit) { isDrawing = false; }
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
      if (coords.y >= captionZoneStart()) return;
      isDrawing = true;
      lastX = coords.x;
      lastY = coords.y;
    });
    canvas.addEventListener('mousemove', function(e) {
      if (!isDrawing) return;
      var coords = getCanvasCoords(canvas, e.clientX, e.clientY);
      drawSegment(ctx, coords.x, coords.y);
    });
    canvas.addEventListener('mouseup',    function() { isDrawing = false; });
    canvas.addEventListener('mouseleave', function() { isDrawing = false; });

    // Touch events
    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      var coords = getCanvasCoords(canvas, e.touches[0].clientX, e.touches[0].clientY);
      if (coords.y >= captionZoneStart()) return;
      isDrawing = true;
      lastX = coords.x;
      lastY = coords.y;
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (!isDrawing) return;
      var coords = getCanvasCoords(canvas, e.touches[0].clientX, e.touches[0].clientY);
      drawSegment(ctx, coords.x, coords.y);
    }, { passive: false });
    canvas.addEventListener('touchend', function() { isDrawing = false; });

    // Show/hide caption zone indicator when label changes
    var labelInput = document.getElementById('imageLabel');
    if (labelInput) {
      labelInput.addEventListener('input', updateCaptionZone);
    }
  }

  function updateCaptionZone() {
    var preview = document.getElementById('captionPreview');
    if (preview) { preview.textContent = getLabel(); }
  }

  function setColour(col, el) {
    currentColour = col;
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

  function getLabel() {
    var el = document.getElementById('imageLabel');
    return el ? el.value.trim() : '';
  }

  function slugify(text) {
    if (!text) return 'sketch';
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sketch';
  }

  // Caption is overlaid within the bottom CAPTION_H pixels — output is always CANVAS_W x CANVAS_H
  function buildFlat() {
    var canvas = document.getElementById('drawCanvas');
    var label  = getLabel();
    var flat   = document.createElement('canvas');
    flat.width  = CANVAS_W;
    flat.height = CANVAS_H;
    var ctx = flat.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    if (label) {
      var captionY = CANVAS_H - CAPTION_H;
      ctx.fillStyle = '#222';
      ctx.fillRect(0, captionY, flat.width, CAPTION_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, flat.width / 2, captionY + CAPTION_H / 2);
    }
    return flat;
  }

  function openInNewWindow() {
    var flat     = buildFlat();
    var filename = slugify(getLabel()) + '.png';
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

  // Expose functions called from inline HTML attributes
  window.setColour = setColour;
  window.setSize = setSize;
  window.clearCanvas = clearCanvas;
  window.openInNewWindow = openInNewWindow;

  document.addEventListener('DOMContentLoaded', initCanvas);
})();
