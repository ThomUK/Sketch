library(shiny)

ui <- fluidPage(
  tags$head(
    tags$link(rel = "stylesheet", type = "text/css", href = "styles.css"),
    tags$script(src = "sketch.js")
  ),
  div(
    class = "app-wrapper",
    tags$h1("Sketch"),
    div(
      class = "toolbar",
      span(class = "toolbar-label", "Colour"),
      tags$div(
        class = "colour-swatch active", style = "background:#222;",
        title = "Black", onclick = "setColour('#222222', this)"
      ),
      tags$div(
        class = "colour-swatch", style = "background:#C0C0C0;",
        title = "Silver", onclick = "setColour('#C0C0C0', this)"
      ),
      tags$div(
        class = "colour-swatch", style = "background:#0F52BA;",
        title = "Blue", onclick = "setColour('#0F52BA', this)"
      ),
      tags$div(
        class = "colour-swatch", style = "background:#FF3131;",
        title = "Red", onclick = "setColour('#FF3131', this)"
      ),
      tags$div(
        class = "colour-swatch", style = "background:#FFA500;",
        title = "Orange", onclick = "setColour('#FFA500', this)"
      ),
      tags$div(
        class = "colour-swatch", style = "background:#32CD32;",
        title = "Green", onclick = "setColour('#32CD32', this)"
      ),
      div(class = "divider"),
      span(class = "toolbar-label", "Size"),
      tags$input(
        type = "range", min = "1", max = "24", value = "4",
        oninput = "setSize(this.value)"
      )
    ),
    div(
      class = "canvas-container",
      tags$canvas(id = "drawCanvas", width = "1366", height = "768")
    ),
    div(
      class = "label-row",
      tags$label(`for` = "imageLabel", "Label"),
      tags$input(
        id = "imageLabel", type = "text",
        placeholder = "Optional label — shown on exported image"
      )
    ),
    div(
      class = "btn-row",
      tags$button("Clear", onclick = "clearCanvas()"),
      tags$button("Export", class = "primary", onclick = "openInNewWindow()")
    ),
    tags$div(id = "copyStatus", "")
  )
)

server <- function(input, output, session) {}

shinyApp(ui, server)
