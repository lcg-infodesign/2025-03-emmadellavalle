
let table;
let volcanoes = [];
let worldImg;
const MAP_FILE = "mondo esteso.png";
const CSV_FILE = "volcanoes-2025-10-27 - Es.3 - Original Data.csv";

let cnv;               // p5 canvas
let wrapper;           // wrapper DOM
let tooltipDiv;

function preload() {
  table = loadTable(CSV_FILE, "csv", "header");
  worldImg = loadImage(MAP_FILE,
  () => console.log("✔️ Mappa caricata con successo"),
  () => console.error("❌ Errore nel caricamento della mappa: controlla nome e percorso")
);

}

function setup() {
  wrapper = document.getElementById("canvas-wrapper");
  createResponsiveCanvas();

  noStroke();
  textFont("Poppins");

  loadVolcanoData();

  // tooltip element
  tooltipDiv = document.getElementById("tooltip");

  // events
  cnv.elt.addEventListener("mousemove", onMouseMove);
  cnv.elt.addEventListener("mouseleave", () => hideTooltip());
  window.addEventListener("resize", () => {
    createResponsiveCanvas();
    redrawAll();
  });

  // initial draw
  redrawAll();
}

// create or resize canvas to preserve image aspect ratio (no deformation)
function createResponsiveCanvas() {
  const wrapperW = Math.max(200, wrapper.clientWidth);
  // keep image ratio
  const imgRatio = worldImg.width / worldImg.height;
  const desiredW = wrapperW;
  const desiredH = Math.round(desiredW / imgRatio);

  if (cnv) {
    resizeCanvas(desiredW, desiredH);
  } else {
    cnv = createCanvas(desiredW, desiredH);
    cnv.parent("canvas-wrapper");
  }
}

// load CSV into structured array
function loadVolcanoData() {
  volcanoes = [];
  // header provided: Volcano Number,Volcano Name,Country,Location,Latitude,Longitude,Elevation (m),Type,TypeCategory,Status,Last Known Eruption
  for (let r = 0; r < table.getRowCount(); r++) {
    let name = table.getString(r, "Volcano Name") || table.getString(r, "Volcano_Name") || "Sconosciuto";
    let country = table.getString(r, "Country") || "";
    let location = table.getString(r, "Location") || "";
    let lat = parseFloat(table.getString(r, "Latitude"));
    let lon = parseFloat(table.getString(r, "Longitude"));
    let elev = parseFloat(table.getString(r, "Elevation (m)"));
    let type = table.getString(r, "Type") || "";
    let category = table.getString(r, "TypeCategory") || table.getString(r, "Type Category") || "";
    let status = table.getString(r, "Status") || "";
    let last = table.getString(r, "Last Known Eruption") || "";

    if (isNaN(lat) || isNaN(lon)) continue;

    // radius 3 -> 20 px mapped from elevation range -6000..7000
    let rSize = map(constrain(elev || 0, -6000, 7000), -6000, 7000, 3, 20);
    rSize = constrain(rSize, 3, 26);

    volcanoes.push({
      name, country, location,
      lat, lon, elev, type, category, status, last,
      rSize
    });
  }
}

// redraw map + points
function redrawAll() {
  clear();
  background(14,15,18);
  imageMode(CORNER);
  // image is drawn to fill canvas exactly (canvas created with same aspect ratio)
  image(worldImg, 0, 0, width, height);

  // draw each volcano
  for (let v of volcanoes) {
    const p = projectToPixel(v.lon, v.lat);
    drawVolcanoPoint(p.x, p.y, v);
  }
}

// draw single volcano point with color from elevation gradient
function drawVolcanoPoint(x, y, v) {
  const elev = (v.elev == null || isNaN(v.elev)) ? 0 : v.elev;
  const col = elevationColor(elev);
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = "rgba(0,0,0,0.35)";
  stroke(0, 40);
  strokeWeight(0.6);
  fill(col);
  ellipse(x, y, v.rSize, v.rSize);
  drawingContext.shadowBlur = 0;
}

// color gradient: -6000 -> +7000 maps to 0..1, then two-stage lerp (dark->orange, orange->yellow)
function elevationColor(elev) {
  const t = constrain(map(elev, -6000, 7000, 0, 1), 0, 1);
  // colors as p5 color objects
  const c0 = color("#4A001A"); // deep bordeaux (low)
  const c1 = color("#CC3300"); // mid (orange/red)
  const c2 = color("#FFE066"); // high (yellow)
  if (t < 0.5) {
    // 0..0.5 -> 0..1 between c0 and c1
    const tt = map(t, 0, 0.5, 0, 1);
    return lerpColor(c0, c1, tt);
  } else {
    // 0.5..1 -> 0..1 between c1 and c2
    const tt = map(t, 0.5, 1, 0, 1);
    return lerpColor(c1, c2, tt);
  }
}

// project equirectangular lon/lat to pixel on displayed image
function projectToPixel(lonDeg, latDeg) {
  // robust normalisation of longitude to [-180, 180]
  let L = ((parseFloat(lonDeg) + 180) % 360 + 360) % 360 - 180;
  const x = map(L, -180, 180, 0, width);
  const y = map(latDeg, 90, -90, 0, height);
  return { x, y };
}

/* ------------------- tooltip handling ------------------- */

function onMouseMove(evt) {
  const rect = cnv.elt.getBoundingClientRect();
  const mx = evt.clientX - rect.left;
  const my = evt.clientY - rect.top;

  // find volcano under cursor
  let found = null;
  for (let v of volcanoes) {
    const p = projectToPixel(v.lon, v.lat);
    const d = dist(mx, my, p.x, p.y);
    if (d <= v.rSize / 2 + 4) { found = { v, p }; break; }
  }

  if (!found) {
    hideTooltip();
    return;
  }
  // show tooltip slightly to the right of the point (or left if would overflow)
  showTooltipFor(found.v, found.p, evt.clientX, evt.clientY);
}

function showTooltipFor(v, p, clientX, clientY) {
  if (!tooltipDiv) tooltipDiv = document.getElementById("tooltip");
  const title = tooltipDiv.querySelector(".tt-title");
  const body = tooltipDiv.querySelector(".tt-body");

  title.textContent = `${v.name} (${v.country || v.location || ""})`;

  const latStr = (Math.round(v.lat * 100) / 100).toFixed(2);
  const lonStr = (Math.round(v.lon * 100) / 100).toFixed(2);
  body.innerHTML = `
    <div><strong>Type:</strong> ${v.type || "N/A"}</div>
    <div><strong>Category:</strong> ${v.category || "N/A"}</div>
    <div><strong>Lat / Lon:</strong> ${latStr}°, ${lonStr}°</div>
    <div><strong>Elevation:</strong> ${v.elev != null ? v.elev + " m" : "N/A"}</div>
    <div><strong>Status:</strong> ${v.status || "N/A"}</div>
    <div><strong>Last Known Eruption:</strong> ${v.last || "N/A"}</div>
  `;

  // compute position relative to card, prefer to the right of the point
  const cardRect = document.querySelector("#map-card").getBoundingClientRect();
  const ttRect = tooltipDiv.getBoundingClientRect();
  // clientX/Y come from mouse; we position near the point within the card
  let left = clientX + 12;
  let top = clientY + 8;

  // if overflow right, put to left of cursor
  if (left + ttRect.width > cardRect.right) left = clientX - ttRect.width - 18;
  if (top + ttRect.height > cardRect.bottom) top = clientY - ttRect.height - 18;
  if (top < cardRect.top + 6) top = cardRect.top + 6;

  // place tooltip
  tooltipDiv.style.left = `${left}px`;
  tooltipDiv.style.top = `${top}px`;
  tooltipDiv.style.display = "block";
  tooltipDiv.setAttribute("aria-hidden", "false");

  // highlight hovered point slightly by redrawing with bigger radius for that point
  redrawAll();
  // draw highlight overlay
  pushHighlight(p.x, p.y, v);
}

function pushHighlight(x, y, v) {
  // draw a glow circle over canvas (works because we call this right after redrawAll)
  drawingContext.save();
  drawingContext.shadowBlur = 22;
  drawingContext.shadowColor = "rgba(255,255,255,0.12)";
  noStroke();
  fill(255, 255, 255, 36);
  ellipse(x, y, v.rSize * 1.8, v.rSize * 1.8);
  drawingContext.restore();
}

function hideTooltip() {
  if (!tooltipDiv) tooltipDiv = document.getElementById("tooltip");
  tooltipDiv.style.display = "none";
  tooltipDiv.setAttribute("aria-hidden", "true");
  redrawAll();
}
