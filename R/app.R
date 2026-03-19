library(shiny)

ui <- fluidPage(
  tags$head(
    tags$style(HTML("
      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        background: #f0f0f0;
        font-family: monospace;
        padding: 24px;
      }

      .app-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        max-width: 1366px;
        margin: 0 auto;
      }

      h1 {
        font-family: monospace;
        font-size: 1.4rem;
        color: #222;
        letter-spacing: 2px;
        text-transform: uppercase;
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: 16px;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 10px 18px;
        flex-wrap: wrap;
      }

      .toolbar-label {
        font-family: monospace;
        font-size: 0.8rem;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .colour-swatch {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        border: 3px solid transparent;
        transition: transform 0.1s;
      }
      .colour-swatch:hover { transform: scale(1.15); }
      .colour-swatch.active {
        border-color: #222;
        box-shadow: 0 0 0 2px #f0f0f0, 0 0 0 4px #222;
      }

      .divider { width: 1px; height: 28px; background: #ddd; }

      input[type=range] {
        -webkit-appearance: none;
        width: 100px;
        height: 4px;
        background: #ccc;
        border-radius: 2px;
        outline: none;
      }
      input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #333;
        cursor: pointer;
      }

      .canvas-container {
        border: 1px solid #ccc;
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      }

      #drawCanvas {
        display: block;
        cursor: crosshair;
        background: #fff;
      }

      .label-row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        max-width: 1366px;
      }

      .label-row label {
        font-family: monospace;
        font-size: 0.8rem;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1px;
        white-space: nowrap;
      }

      #imageLabel {
        flex: 1;
        font-family: monospace;
        font-size: 0.95rem;
        background: #fff;
        color: #222;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 8px 12px;
        outline: none;
      }
      #imageLabel:focus { border-color: #888; }
      #imageLabel::placeholder { color: #bbb; }

      .btn-row { display: flex; gap: 10px; }

      button {
        font-family: monospace;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 9px 22px;
        border-radius: 6px;
        cursor: pointer;
        border: 1px solid #ccc;
        background: #fff;
        color: #333;
        transition: background 0.15s, border-color 0.15s;
      }
      button:hover { background: #f5f5f5; border-color: #999; }

      button.primary {
        background: #222;
        color: #fff;
        border-color: #222;
      }
      button.primary:hover { background: #444; border-color: #444; }

      #copyStatus {
        font-family: monospace;
        font-size: 0.85rem;
        color: #444;
        min-height: 20px;
        text-align: center;
      }
    ")),
    
    tags$script(HTML("
      var isDrawing = false;
      var lastX = 0, lastY = 0;
      var currentColour = '#222222';
      var currentSize = 4;

      function initCanvas() {
        var canvas = document.getElementById('drawCanvas');
        if (!canvas) { setTimeout(initCanvas, 100); return; }
        var ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        canvas.addEventListener('mousedown', function(e) {
          isDrawing = true;
          var r = canvas.getBoundingClientRect();
          lastX = e.clientX - r.left;
          lastY = e.clientY - r.top;
        });
        canvas.addEventListener('mousemove', function(e) {
          if (!isDrawing) return;
          var r = canvas.getBoundingClientRect();
          var x = e.clientX - r.left;
          var y = e.clientY - r.top;
          ctx.beginPath();
          ctx.strokeStyle = currentColour;
          ctx.lineWidth = currentSize;
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
          lastX = x; lastY = y;
        });
        canvas.addEventListener('mouseup',    function() { isDrawing = false; });
        canvas.addEventListener('mouseleave', function() { isDrawing = false; });

        canvas.addEventListener('touchstart', function(e) {
          e.preventDefault();
          isDrawing = true;
          var r = canvas.getBoundingClientRect();
          lastX = e.touches[0].clientX - r.left;
          lastY = e.touches[0].clientY - r.top;
        }, { passive: false });
        canvas.addEventListener('touchmove', function(e) {
          e.preventDefault();
          if (!isDrawing) return;
          var r = canvas.getBoundingClientRect();
          var x = e.touches[0].clientX - r.left;
          var y = e.touches[0].clientY - r.top;
          ctx.beginPath();
          ctx.strokeStyle = currentColour;
          ctx.lineWidth = currentSize;
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
          lastX = x; lastY = y;
        }, { passive: false });
        canvas.addEventListener('touchend', function() { isDrawing = false; });
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

      function buildFlat() {
        var canvas = document.getElementById('drawCanvas');
        var label  = getLabel();
        var labelH = label ? 48 : 0;
        var flat   = document.createElement('canvas');
        flat.width  = canvas.width;
        flat.height = canvas.height + labelH;
        var ctx = flat.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, flat.width, flat.height);
        ctx.drawImage(canvas, 0, 0);
        if (label) {
          ctx.fillStyle = '#222';
          ctx.fillRect(0, canvas.height, flat.width, labelH);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, flat.width / 2, canvas.height + labelH / 2);
        }
        return flat;
      }

      function openInNewWindow() {
        var flat     = buildFlat();
        var filename = slugify(getLabel()) + '.png';
        flat.toBlob(function(blob) {
          var blobUrl = URL.createObjectURL(blob);
          var win = window.open();
          if (!win) {
            setStatus('Popup blocked — please allow popups and try again');
            URL.revokeObjectURL(blobUrl);
            return;
          }
          win.document.write(
            '<html><head><title>' + filename + '</title></head>' +
            '<body style=\"margin:0;background:#eee;display:flex;flex-direction:column;' +
            'align-items:center;padding:20px;gap:14px;font-family:monospace;color:#333;\">' +
            '<p style=\"font-size:13px;\">Right-click the image \u2192 <strong>Copy Image</strong> ' +
            'to place it on the clipboard, or use the link below to save.</p>' +
            '<a href=\"' + blobUrl + '\" download=\"' + filename + '\" ' +
            'style=\"font-family:monospace;font-size:13px;color:#222;\">' +
            '\u2193 Save as ' + filename + '</a>' +
            '<img src=\"' + blobUrl + '\" style=\"max-width:100%;border:1px solid #ccc;border-radius:4px;\"/>' +
            '</body></html>'
          );
          win.document.close();
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
          setStatus('\u2197 Opened in new window');
          setTimeout(function() { setStatus(''); }, 5000);
        }, 'image/png');
      }

      document.addEventListener('DOMContentLoaded', initCanvas);
    "))
  ),
  
  div(class = "app-wrapper",
      tags$h1("Sketchpad"),
      
      div(class = "toolbar",
          span(class = "toolbar-label", "Colour"),
          tags$div(class = "colour-swatch active", style = "background:#222;",
                   title = "Black", onclick = "setColour('#222222', this)"),
          tags$div(class = "colour-swatch", style = "background:#c0392b;",
                   title = "Red",   onclick = "setColour('#c0392b', this)"),
          tags$div(class = "colour-swatch", style = "background:#2471a3;",
                   title = "Blue",  onclick = "setColour('#2471a3', this)"),
          div(class = "divider"),
          span(class = "toolbar-label", "Size"),
          tags$input(type = "range", min = "1", max = "24", value = "4",
                     oninput = "setSize(this.value)")
      ),
      
      div(class = "canvas-container",
          tags$canvas(id = "drawCanvas", width = "1366", height = "768")
      ),
      
      div(class = "label-row",
          tags$label(`for` = "imageLabel", "Label"),
          tags$input(id = "imageLabel", type = "text",
                     placeholder = "Optional label — shown on exported image")
      ),
      
      div(class = "btn-row",
          tags$button("Clear", onclick = "clearCanvas()"),
          tags$button("Copy to Clipboard", class = "primary", onclick = "openInNewWindow()")
      ),
      
      tags$div(id = "copyStatus", "")
  )
)

server <- function(input, output, session) {}

shinyApp(ui, server)