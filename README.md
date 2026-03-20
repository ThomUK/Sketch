# Sketch

<!-- badges: start -->

<!-- badges: end -->

Sketch is a simple R Shiny drawing app — a lightweight way to make and share a sketch online. Sketches can be exported as a PNG file via a popup window.  

Deploy your own copy, or you can use the deployed version on [shinyapps.io](https://thomuk.shinyapps.io/sketch/).

## Features

- **Pen colours** — Black, Silver, Blue, Red, Orange, Green
- **Pen size** — adjustable via a slider
- **Eraser** — three-state toggle: off / erase selected colour only / erase all colours
- **Caption** — type directly onto the canvas; the caption bar always shows the current date and time
- **Export** — opens the full-resolution 1280×720 PNG in a new window for saving or right-click copying
- **Responsive layout** — canvas scales to fit the browser window; toolbar reflows on tablet and smaller screens

## Usage

```r
shiny::runApp()
```

Or run the deployed version on [shinyapps.io](https://thomuk.shinyapps.io/sketch/).

## Tech details

There is no server-side element to the app. All drawing, erasing, caption handling, and export logic is implemented client-side in vanilla JavaScript (`www/sketch.js`). Styles are in `www/styles.css`. The Shiny `app.R` defines only the UI structure.

The canvas buffer is fixed at 1280×720 pixels regardless of display size. Drawing coordinates are scaled from display pixels to buffer pixels on every pointer event, so strokes are always placed accurately at any zoom level.
