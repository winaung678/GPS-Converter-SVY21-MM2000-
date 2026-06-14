// ==========================================
// --- ONLINE MAP ENGINE ---
// ==========================================

window.toggleMeasureMode = function() {
    window.isMeasuring = !window.isMeasuring; let btn = document.getElementById('measureBtn');
    if (window.isMeasuring) {
        btn.style.background = "#dc2626"; btn.style.borderColor = "#991b1b"; window.measureLatLngs = [];
        if(window.measureLineLayer) window.leafletMap.removeLayer(window.measureLineLayer); if(window.measureMarkersLayer) window.leafletMap.removeLayer(window.measureMarkersLayer);
        window.measureLineLayer = L.polyline([], {color: '#dc2626', weight: 4, dashArray: '5, 5'}).addTo(window.leafletMap); window.measureMarkersLayer = L.layerGroup().addTo(window.leafletMap);
        alert("📏 Measure Mode ON.\nTap on the map or points to measure distances.");
    } else {
        btn.style.background = "#f59e0b"; btn.style.borderColor = "#d97706";
        if(window.measureLineLayer) window.leafletMap.removeLayer(window.measureLineLayer); if(window.measureMarkersLayer) window.leafletMap.removeLayer(window.measureMarkersLayer);
        window.measureLineLayer = null; window.measureMarkersLayer = null;
    }
};

function getSnapPoint(lat, lon, zoomLevel) {
    if (!window.rawDxfEntities || window.rawDxfEntities.length === 0) return { lat, lon, snapped: false };
    let snapRadiusMeters = zoomLevel >= 20 ? 1.5 : (zoomLevel >= 18 ? 3 : 8);
    let bestPt = null; let minDist = snapRadiusMeters;
    const checkPt = (pX, pY) => { let p = window.dxfToLatLon(pX, pY); if (isNaN(p.lat)) return; let d = calcDistance(lat, lon, p.lat, p.lon); if (d < minDist) { minDist = d; bestPt = { lat: p.lat, lon: p.lon, snapped: true }; } };
    window.rawDxfEntities.forEach(ent => { try { if (ent.type === 'LINE') { checkPt(ent.vertices[0].x, ent.vertices[0].y); checkPt(ent.vertices[1].x, ent.vertices[1].y); } else if (ent.type === 'POLYLINE' || ent.type === 'LWPOLYLINE') { ent.vertices.forEach(v => checkPt(v.x, v.y)); } else if (ent.type === 'POINT' || ent.type === 'CIRCLE') { let px = ent.center ? ent.center.x : (ent.position ? ent.position.x : ent.x); let py = ent.center ? ent.center.y : (ent.position ? ent.position.y : ent.y); checkPt(px, py); } } catch(e) {} });
    return bestPt ? bestPt : { lat, lon, snapped: false };
}

window.initMap = function() {
    window.leafletMap = L.map('map_view', {
        zoomControl: true,
        maxZoom: 24,
        updateWhenZooming: false,
        updateWhenIdle: true
    }).setView([1.3521, 103.8198], 15);

    // Online Tiles
    let satLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 24, maxNativeZoom: 21, crossOrigin: 'anonymous' });
    let streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 24, maxNativeZoom: 19 });

    satLayer.addTo(window.leafletMap);
    L.control.layers({"Street Map": streetLayer, "Satellite": satLayer}).addTo(window.leafletMap);
    window.pointsLayerGroup = L.layerGroup().addTo(window.leafletMap);

    let zoomLevelBox = L.control({position: 'topleft'});
    zoomLevelBox.onAdd = function(map) { this._div = L.DomUtil.create('div', 'zoom-level-display'); this.update(map.getZoom()); return this._div; };
    zoomLevelBox.update = function(z) { this._div.innerHTML = "<b>Z: " + z + "</b>"; };
    zoomLevelBox.addTo(window.leafletMap);

    window.leafletMap.on('zoomend', function() {
        let currentZoom = window.leafletMap.getZoom();
        zoomLevelBox.update(currentZoom);

        let mapCont = document.getElementById('map_container');
        if (mapCont) {
            if (currentZoom < 17) mapCont.classList.add('zoom-out-texts');
            else mapCont.classList.remove('zoom-out-texts');
        }
    });

    window.leafletMap.on('dragstart', function() { window.isAutoCenter = false; document.getElementById('autoCenterBtn').classList.remove('active'); });
    if(window.setOutPoints.length > 0 && typeof window.plotPointsOnMap === 'function') window.plotPointsOnMap();

    window.leafletMap.on('click', function(e) {
        let tapLat = e.latlng.lat;
        let tapLon = ((e.latlng.lng + 180) % 360 + 360) % 360 - 180;

        let currentZoom = window.leafletMap.getZoom();
        let chkLines = document.getElementById('tgl_dxf_lines'); let snapResult = { lat: tapLat, lon: tapLon, snapped: false };
        if (chkLines && chkLines.checked) snapResult = getSnapPoint(tapLat, tapLon, currentZoom);
        let finalLat = snapResult.lat; let finalLon = snapResult.lon;

        if (window.isMeasuring) {
            window.measureLatLngs.push([finalLat, finalLon]); window.measureLineLayer.setLatLngs(window.measureLatLngs);
            let markerColor = snapResult.snapped ? "#10b981" : "#ef4444";
            let markerIcon = L.divIcon({ className: 'dxf-text-label', html: `<div style="background:white; border-radius:50%; width:12px; height:12px; border:3px solid ${markerColor};"></div>`, iconSize: [16, 16] });
            L.marker([finalLat, finalLon], {icon: markerIcon}).addTo(window.measureMarkersLayer);

            if (window.measureLatLngs.length > 1) {
                let prevLat = window.measureLatLngs[window.measureLatLngs.length-2][0];
                let prevLon = window.measureLatLngs[window.measureLatLngs.length-2][1];
                let lastSegDist = calcDistance(prevLat, prevLon, finalLat, finalLon);

                let totalDist = 0;
                for(let i=0; i<window.measureLatLngs.length-1; i++) { totalDist += calcDistance(window.measureLatLngs[i][0], window.measureLatLngs[i][1], window.measureLatLngs[i+1][0], window.measureLatLngs[i+1][1]); }

                let snapText = snapResult.snapped ? `<br><span style="color:#10b981; font-size:10px;">🧲 Snapped to DXF</span>` : "";
                L.popup().setLatLng([finalLat, finalLon]).setContent(`<b style="color:#0f172a; font-size:12px;">Segment: ${lastSegDist.toFixed(3)} m</b><br><b style="color:#b91c1c; font-size:14px;">Total: ${totalDist.toFixed(3)} m</b>${snapText}`).openOn(window.leafletMap);

                let midLat = (prevLat + finalLat) / 2;
                let midLon = (prevLon + finalLon) / 2;
                let distanceIcon = L.divIcon({ className: 'measure-label', html: `${lastSegDist.toFixed(2)} m`, iconSize: [50, 20], iconAnchor: [25, 10] });
                L.marker([midLat, midLon], {icon: distanceIcon}).addTo(window.measureMarkersLayer);

            } else {
                let snapText = snapResult.snapped ? `<br><span style="color:#10b981; font-size:10px;">🧲 Snapped to DXF</span>` : "";
                L.popup().setLatLng([finalLat, finalLon]).setContent(`<b style="color:#1e40af;">Start Point</b>${snapText}`).openOn(window.leafletMap);
            }
            return;
        }

        let datumLabel = "WGS_LL"; let localN = 0, localE = 0;
        let showLocal = false;
        let autoDetectedZone = Math.floor((finalLon + 180) / 6) + 1;

        if (window.activeApp === 1) {
            if (finalLat >= 1.0 && finalLat <= 2.0 && finalLon >= 103.0 && finalLon <= 104.5) {
                let pW = calc_v2_fwd(finalLat, finalLon); localN = pW.N; localE = pW.E; datumLabel = "SVY21"; showLocal = true;
            }
        }
        else if (window.activeApp === 2) {
            if (finalLat >= 9.0 && finalLat <= 29.0 && finalLon >= 92.0 && finalLon <= 102.0) {
                let x = m_llh2xyz(finalLat, finalLon, 0, m_WGS);
                let mL = m_xyz2llh(x.x+m_DX, x.y+m_DY, x.z+m_DZ, m_EVE);
                let pM = m_project(mL.lat, mL.lon, autoDetectedZone, m_EVE);
                localN = pM.n; localE = pM.e; datumLabel = `MM2000 Z${autoDetectedZone}`; showLocal = true;
            }
        }
        else if (window.activeApp === 5) {
            let hemi = finalLat >= 0 ? 'N' : 'S';
            let pW = m_project(finalLat, finalLon, autoDetectedZone, m_WGS);
            localN = pW.n; localE = pW.e; if(hemi === 'S') localN += 10000000;
            datumLabel = `UTM Z${autoDetectedZone}${hemi}`; showLocal = true;
        }
        else {
            let soDatumVal = document.getElementById('so_datum') ? document.getElementById('so_datum').value : "WGS_LL";
            let cogoDatumVal = document.getElementById('cogo_datum') ? document.getElementById('cogo_datum').value : "WGS_LL";
            let dxfDatumVal = document.getElementById('dxf_datum') ? document.getElementById('dxf_datum').value : "WGS_LL";

            let datum = "WGS_LL";
            if (window.activeApp === 3) datum = soDatumVal;
            else if (window.activeApp === 4) datum = cogoDatumVal;
            else if (window.activeApp === 6) datum = dxfDatumVal;

            if (datum === "SVY21") {
                if (finalLat >= 1.0 && finalLat <= 2.0 && finalLon >= 103.0 && finalLon <= 104.5) {
                    let pW = calc_v2_fwd(finalLat, finalLon); localN = pW.N; localE = pW.E; datumLabel = "SVY21"; showLocal = true;
                }
            }
            else if (datum.startsWith("MM")) {
                if (finalLat >= 9.0 && finalLat <= 29.0 && finalLon >= 92.0 && finalLon <= 102.0) {
                    let x = m_llh2xyz(finalLat, finalLon, 0, m_WGS);
                    let mL = m_xyz2llh(x.x+m_DX, x.y+m_DY, x.z+m_DZ, m_EVE);
                    let pM = m_project(mL.lat, mL.lon, autoDetectedZone, m_EVE);
                    localN = pM.n; localE = pM.e; datumLabel = `MM2000 Z${autoDetectedZone}`; showLocal = true;
                }
            }
            else if (datum.startsWith("WGS_UTM")) {
                let pW = m_project(finalLat, finalLon, autoDetectedZone, m_WGS);
                localN = pW.n; localE = pW.e; datumLabel = `UTM Z${autoDetectedZone}`; showLocal = true;
            }
            else if (datum === "GLOBAL_UTM") {
                let zInput = (window.activeApp === 6) ? document.getElementById('dxf_custom_zone') : (window.activeApp === 4 ? document.getElementById('cogo_custom_zone') : document.getElementById('so_custom_zone'));
                let hInput = (window.activeApp === 6) ? document.getElementById('dxf_custom_hemi') : (window.activeApp === 4 ? document.getElementById('cogo_custom_hemi') : document.getElementById('so_custom_hemi'));
                let customZone = (zInput && zInput.value) ? parseInt(zInput.value) : autoDetectedZone;
                let hemi = hInput ? hInput.value : (finalLat >= 0 ? 'N' : 'S');
                let pW = m_project(finalLat, finalLon, customZone, m_WGS);
                localN = pW.n; localE = pW.e; if(hemi === 'S') localN += 10000000; datumLabel = `UTM Z${customZone}${hemi}`; showLocal = true;
            }
        }

        let popupContent = `<div style="text-align:center; padding: 5px;">`;
        if (snapResult.snapped) { popupContent += `<div style="background:#10b981; color:white; font-size:11px; font-weight:bold; padding:3px; border-radius:4px; margin-bottom:5px;">🧲 Snapped to DXF Node</div>`; }

        if (showLocal) { popupContent += `<b style="font-size:12px; color:#d97706;">[${datumLabel}]</b><br><b style="font-size:14px; color:#b91c1c;">N: ${localN.toFixed(3)}<br>E: ${localE.toFixed(3)}</b><hr style="margin:5px 0; border:0.5px solid #ccc;">`; }
        else { popupContent += `<b style="font-size:11px; color:#ef4444; background:#fee2e2; padding:3px; border-radius:4px; display:block; margin-bottom:5px;">⚠️ Out of Local Bounds</b>`; }

        popupContent += `<b style="font-size:12px; color:#1e3a8a;">Lat: ${finalLat.toFixed(7)}<br>Lon: ${finalLon.toFixed(7)}</b>`;

        if (window.activeApp === 3 && typeof window.setOutFromMapClick === 'function') {
            popupContent += `<br><button class="so-popup-btn" style="background:#dc2626; margin-top:8px;" onclick="setOutFromMapClick(${finalLat}, ${finalLon})">🎯 Set Out Here</button>`;
        }
        popupContent += `</div>`;
        L.popup().setLatLng([finalLat, finalLon]).setContent(popupContent).openOn(window.leafletMap);
    });
};

window.toggleAutoCenter = function() {
    window.isAutoCenter = !window.isAutoCenter;
    let btn = document.getElementById('autoCenterBtn');
    if(window.isAutoCenter) {
        btn.classList.add('active');
        if (window.currentLat !== 0) {
            window.leafletMap.setView([window.currentLat, window.currentLon], 21);
        } else { alert("Waiting for GPS Location..."); }
    } else {
        btn.classList.remove('active');
    }
};

// ==========================================
// --- DXF ENGINE (CANVAS RENDERED) ---
// ==========================================
window.toggleDxfPanel = function() {
    let panel = document.getElementById('dxf_controls_panel'); let mapDiv = document.getElementById('map_view'); let btn = document.getElementById('btn_toggle_dxf_panel');
    if (panel.classList.contains('hidden')) { panel.classList.remove('hidden'); mapDiv.classList.remove('map-expanded'); btn.innerText = "🔼 Hide Controls & Expand Map"; }
    else { panel.classList.add('hidden'); mapDiv.classList.add('map-expanded'); btn.innerText = "🔽 Show Controls"; }
    setTimeout(() => { if(window.leafletMap) window.leafletMap.invalidateSize(); }, 350);
};

window.handleDXFUpload = function(event) {
    const file = event.target.files[0]; if (!file) return;
    document.getElementById('dxf_status').innerText = `⏳ Parsing ${file.name}... Please wait.`;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parser = new window.DxfParser(); const dxfData = parser.parseSync(e.target.result);
            window.rawDxfEntities = dxfData.entities || [];
            window.dxfLayerTable = {};
            if(dxfData.tables && dxfData.tables.layer && dxfData.tables.layer.layers) {
                let layers = dxfData.tables.layer.layers;
                for (let key in layers) {
                    let cNum = layers[key].colorNumber;
                    if (cNum === undefined) cNum = layers[key].color;
                    window.dxfLayerTable[key.toUpperCase()] = cNum;
                }
            }

            document.getElementById('dxf_status').innerText = `⚙️ Processing ${window.rawDxfEntities.length} entities...`;
            let exportBtn = document.getElementById('btn_export_kml'); if(exportBtn) exportBtn.style.display = 'block';
            setTimeout(() => { window.renderDXF(); window.toggleDxfPanel(); }, 100);
        } catch(err) { document.getElementById('dxf_status').innerText = `❌ Error parsing DXF!`; alert("Failed to parse DXF. Please ensure it's a valid text-based DXF file."); }
    };
    reader.readAsText(file); event.target.value = '';
};

window.clearDXF = function() {
    if (!window.leafletMap) return;
    if (!confirm("Are you sure you want to clear the DXF map?")) return;
    window.dxfCancelFlag = true;
    window.rawDxfEntities = [];
    window.dxfLayerTable = {};
    if (window.dxfLineLayer) { window.leafletMap.removeLayer(window.dxfLineLayer); }
    if (window.dxfTextLayer) { window.leafletMap.removeLayer(window.dxfTextLayer); }
    window.dxfLineLayer = null;
    window.dxfTextLayer = null;
    let statusEl = document.getElementById('dxf_status');
    if (statusEl) statusEl.innerHTML = "Waiting for DXF file...";
    let exportBtn = document.getElementById('btn_export_kml');
    if(exportBtn) exportBtn.style.display = 'none';
    let dxfFileInp = document.getElementById('dxf_file');
    if(dxfFileInp) dxfFileInp.value = "";
    let chkLines = document.getElementById('tgl_dxf_lines');
    if (chkLines) { chkLines.checked = false; chkLines.disabled = true; }
    let chkTexts = document.getElementById('tgl_dxf_texts');
    if (chkTexts) { chkTexts.checked = false; chkTexts.disabled = true; }
    let chkDark = document.getElementById('tgl_dxf_dark');
    if (chkDark) { chkDark.checked = false; }
};

window.aciToHex = function(colorNumber) {
    const aciPalette = [
        "#000000", "#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF", "#FFFFFF",
        "#414141", "#808080", "#FF0000", "#FFAAAA", "#BD0000", "#BD7E7E", "#810000", "#815656",
        "#7C0000", "#7C5353", "#4C0000", "#4C3333", "#FF3F00", "#FFBFAA", "#BD2E00", "#BD8D7E",
        "#7C1F00", "#7C5D53", "#4C1300", "#4C3933", "#FF7F00", "#FFDFAA", "#BD5E00", "#BDA57E"
    ];
    if (colorNumber >= 0 && colorNumber < aciPalette.length) return aciPalette[colorNumber];
    return null;
};

window.stringToColor = function(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
};

window.dxfToLatLon = function(e, n) {
    let datum = document.getElementById('dxf_datum') ? document.getElementById('dxf_datum').value : "WGS_LL";
    if (datum === "SVY21") { return calc_v2_rev(e, n); }
    else if (datum.startsWith("WGS_UTM")) { let zone = parseInt(datum.slice(-2)); let i_w = m_inverse(e, n, zone, m_WGS); return { lat: i_w.lat, lon: i_w.lon }; }
    else if (datum === "GLOBAL_UTM") { let zInput = document.getElementById('dxf_custom_zone'); let hInput = document.getElementById('dxf_custom_hemi'); let zone = (zInput && zInput.value) ? parseInt(zInput.value) : 47; let hemi = hInput ? hInput.value : 'N'; let calcN = n; if (hemi === 'S') calcN -= 10000000; let i_w = m_inverse(e, calcN, zone, m_WGS); return { lat: i_w.lat, lon: i_w.lon }; }
    else { let isMM = datum.startsWith("MM"); let zone = parseInt(datum.slice(-2)); let r = m_inverse(e, n, zone, isMM ? m_EVE : m_WGS); if (isMM) { let x = m_llh2xyz(r.lat, r.lon, 0, m_EVE); let w = m_xyz2llh(x.x-m_DX, x.y-m_DY, x.z-m_DZ, m_WGS); return { lat: w.lat, lon: w.lon }; } return { lat: r.lat, lon: r.lon }; }
};

L.CanvasTextLayer = L.Layer.extend({
    initialize: function (texts, options) { this._texts = texts; L.setOptions(this, options); },
    onAdd: function (map) {
        this._map = map;
        if (!this._canvas) { this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated'); this._canvas.style.position = 'absolute'; this._canvas.style.left = '0'; this._canvas.style.top = '0'; this._canvas.style.pointerEvents = 'none'; this._ctx = this._canvas.getContext('2d'); }
        map._panes.overlayPane.appendChild(this._canvas); map.on('move', this._reset, this); map.on('resize', this._reset, this); map.on('zoom', this._reset, this); this._reset();
    },
    onRemove: function (map) { L.DomUtil.remove(this._canvas); map.off('move', this._reset, this); map.off('resize', this._reset, this); map.off('zoom', this._reset, this); },
    _reset: function () { let size = this._map.getSize(); let tl = this._map.containerPointToLayerPoint([0, 0]); L.DomUtil.setPosition(this._canvas, tl); this._canvas.width = size.x; this._canvas.height = size.y; this._draw(); },
    _draw: function () {
        let ctx = this._ctx;
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        if (this._map.getZoom() < 19) return;

        let bounds = this._map.getBounds();
        let dynamicFontSize = window.currentDxfTextSize;

        ctx.font = `bold ${dynamicFontSize}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        let isDarkMode = document.getElementById('master-ui').classList.contains('dark-mode');

        for (let i = 0; i < this._texts.length; i++) {
            let t = this._texts[i];
            if (!t.text || t.text.trim() === "") continue;

            if (bounds.contains([t.lat, t.lon])) {
                let p = this._map.latLngToContainerPoint([t.lat, t.lon]);
                if(t.align === 'center') ctx.textAlign = 'center'; else if(t.align === 'right') ctx.textAlign = 'right'; else ctx.textAlign = 'left';

                let txtColor = t.color;
                if ((txtColor === "#000000" || txtColor === "#0f172a") && isDarkMode) txtColor = "#FFFFFF";
                if ((txtColor === "#FFFFFF" || txtColor === "#ffffff") && !isDarkMode) txtColor = "#0f172a";

                ctx.fillStyle = txtColor;
                ctx.strokeStyle = isDarkMode ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)";
                ctx.lineWidth = 3;

                ctx.save();
                ctx.translate(p.x, p.y);
                if (t.rotation) { ctx.rotate(-t.rotation * Math.PI / 180); }
                ctx.strokeText(t.text, 0, 0);
                ctx.fillText(t.text, 0, 0);
                ctx.restore();
            }
        }
    }
});

window.changeDxfTextSize = function(val) {
    window.currentDxfTextSize += val; if (window.currentDxfTextSize < 6) window.currentDxfTextSize = 6; if (window.currentDxfTextSize > 40) window.currentDxfTextSize = 40;
    let disp = document.getElementById('dxf_text_size_display'); if(disp) disp.innerText = window.currentDxfTextSize;
    document.documentElement.style.setProperty('--pt-font-size', window.currentDxfTextSize + 'px');
    if (window.dxfTextLayer && window.leafletMap.hasLayer(window.dxfTextLayer)) { window.dxfTextLayer._reset(); }
};

window.renderDXF = function() {
    if (!window.leafletMap || !window.rawDxfEntities || window.rawDxfEntities.length === 0) return;

    window.dxfCancelFlag = false;

    if (window.dxfLineLayer) window.leafletMap.removeLayer(window.dxfLineLayer); if (window.dxfTextLayer) window.leafletMap.removeLayer(window.dxfTextLayer);
    window.dxfLineLayer = L.layerGroup(); let textsData = []; let bounds = [];
    let isDarkLines = false; let chkDark = document.getElementById('tgl_dxf_dark'); if(chkDark) isDarkLines = chkDark.checked;
    let lineCount = 0; let textCount = 0; let totalEntities = window.rawDxfEntities.length; let currentIndex = 0; let chunkSize = 500;

    document.getElementById('dxf_status').innerHTML = `⏳ Drawing Map... Please wait.`;
    let sharedCanvasRenderer = L.canvas({ padding: 0.5 });

    function processChunk() {
        if (window.dxfCancelFlag) return;

        let end = Math.min(currentIndex + chunkSize, totalEntities);
        for (; currentIndex < end; currentIndex++) {
            let ent = window.rawDxfEntities[currentIndex];

            let color = "#3b82f6";

            if (isDarkLines) {
                color = "#0f172a";
            } else {
                if (ent.trueColor) {
                    color = "#" + ent.trueColor.toString(16).padStart(6, '0');
                } else {
                    let rawColorNum = ent.colorIndex;
                    if (rawColorNum === 256 || rawColorNum === 0 || rawColorNum === undefined || rawColorNum === null) {
                        if (ent.layer && window.dxfLayerTable[ent.layer.toUpperCase()] !== undefined) {
                            rawColorNum = window.dxfLayerTable[ent.layer.toUpperCase()];
                        }
                    }

                    let aciColor = window.aciToHex(rawColorNum);
                    if (aciColor !== null) {
                        color = aciColor;
                    } else if (ent.layer) {
                        color = window.stringToColor(ent.layer);
                    }
                }
                if (color.toLowerCase() === "#ffffff") color = "#f8fafc";
            }

            try {
                if (ent.type === 'LINE') { let start = window.dxfToLatLon(ent.vertices[0].x, ent.vertices[0].y); let end = window.dxfToLatLon(ent.vertices[1].x, ent.vertices[1].y); if (!isNaN(start.lat) && !isNaN(end.lat)) { let poly = L.polyline([[start.lat, start.lon], [end.lat, end.lon]], {color: color, weight: 1.5, renderer: sharedCanvasRenderer}); window.dxfLineLayer.addLayer(poly); bounds.push([start.lat, start.lon]); lineCount++; } }
                else if (ent.type === 'POLYLINE' || ent.type === 'LWPOLYLINE') { let latlngs = []; ent.vertices.forEach(v => { let p = window.dxfToLatLon(v.x, v.y); if (!isNaN(p.lat) && !isNaN(p.lon)) { bounds.push([p.lat, p.lon]); latlngs.push([p.lat, p.lon]); } }); if (latlngs.length > 1) { if (ent.shape === true) latlngs.push(latlngs[0]); let poly = L.polyline(latlngs, {color: color, weight: 1.5, renderer: sharedCanvasRenderer}); window.dxfLineLayer.addLayer(poly); lineCount++; } }
                else if (ent.type === 'CIRCLE') { let center = window.dxfToLatLon(ent.center.x, ent.center.y); if (!isNaN(center.lat)) { let circle = L.circle([center.lat, center.lon], {radius: ent.radius, color: color, weight: 1.5, fill: false, renderer: sharedCanvasRenderer}); window.dxfLineLayer.addLayer(circle); bounds.push([center.lat, center.lon]); lineCount++; } }
                else if (ent.type === 'ARC') { let cx = ent.center.x, cy = ent.center.y, r = ent.radius; let startAngle = ent.startAngle, endAngle = ent.endAngle; if (endAngle < startAngle) endAngle += 2 * Math.PI; let arcPoints = []; let step = 5 * Math.PI / 180; for (let angle = startAngle; angle <= endAngle; angle += step) { let p = window.dxfToLatLon(cx + r * Math.cos(angle), cy + r * Math.sin(angle)); if (!isNaN(p.lat)) arcPoints.push([p.lat, p.lon]); } let pLast = window.dxfToLatLon(cx + r * Math.cos(endAngle), cy + r * Math.sin(endAngle)); if (!isNaN(pLast.lat)) arcPoints.push([pLast.lat, pLast.lon]); if (arcPoints.length > 1) { let arcPoly = L.polyline(arcPoints, {color: color, weight: 1.5, renderer: sharedCanvasRenderer}); window.dxfLineLayer.addLayer(arcPoly); bounds.push(arcPoints[0]); lineCount++; } }
                else if (ent.type === 'POINT') { let px = ent.position ? ent.position.x : ent.x; let py = ent.position ? ent.position.y : ent.y; let pt = window.dxfToLatLon(px, py); if (!isNaN(pt.lat)) { let dot = L.circleMarker([pt.lat, pt.lon], {radius: 2, color: color, weight: 1, fillColor: color, fillOpacity: 1, renderer: sharedCanvasRenderer}); window.dxfLineLayer.addLayer(dot); bounds.push([pt.lat, pt.lon]); lineCount++; } }
                else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
                    let px = ent.startPoint.x; let py = ent.startPoint.y;
                    if (ent.attachmentPoint && [2, 3, 5, 6, 8, 9].includes(ent.attachmentPoint)) { if(ent.x !== undefined && ent.y !== undefined) { px = ent.x; py = ent.y; } }
                    let p = window.dxfToLatLon(px, py);
                    if (!isNaN(p.lat)) {
                        let align = 'left'; if (ent.attachmentPoint) { if ([2, 5, 8].includes(ent.attachmentPoint)) align = 'center'; else if ([3, 6, 9].includes(ent.attachmentPoint)) align = 'right'; }
                        textsData.push({ lat: p.lat, lon: p.lon, text: ent.text, color: color, align: align, rotation: ent.rotation });
                        textCount++;
                    }
                }
            } catch(e) {}
        }
        let percent = Math.round((currentIndex / totalEntities) * 100);

        if (window.dxfCancelFlag) return;

        document.getElementById('dxf_status').innerHTML = `⏳ Drawing... ${percent}%`;
        if (currentIndex < totalEntities) { setTimeout(processChunk, 5); }
        else {
            document.getElementById('dxf_status').innerHTML = `✅ Loaded <b>${lineCount}</b> entities & <b>${textCount}</b> texts.`;
            window.dxfTextLayer = new L.CanvasTextLayer(textsData);

            let chkLines = document.getElementById('tgl_dxf_lines'); if (chkLines) { chkLines.checked = true; chkLines.disabled = false; }
            let chkTexts = document.getElementById('tgl_dxf_texts'); if (chkTexts) { chkTexts.checked = true; chkTexts.disabled = false; }
            window.toggleDxfLayers();

            setTimeout(() => { window.leafletMap.invalidateSize(); if (bounds.length > 0) { let validBounds = bounds.filter(b => !isNaN(b[0]) && !isNaN(b[1])); if(validBounds.length > 0) { window.leafletMap.fitBounds(L.latLngBounds(validBounds), {padding: [20, 20], maxZoom: 22}); } window.isAutoCenter = false; let btn = document.getElementById('autoCenterBtn'); if(btn) btn.classList.remove('active'); } }, 100);
        }
    }
    processChunk();
};

window.reRenderDXFColors = function() {
    if (!window.rawDxfEntities || window.rawDxfEntities.length === 0) return;
    window.renderDXF();
};

window.toggleDxfLayers = function() {
    if (!window.leafletMap) return;

    if (window.dxfLineLayer) {
        let chkLines = document.getElementById('tgl_dxf_lines');
        if (chkLines && chkLines.checked) { if (!window.leafletMap.hasLayer(window.dxfLineLayer)) window.leafletMap.addLayer(window.dxfLineLayer); }
        else { window.leafletMap.removeLayer(window.dxfLineLayer); }
    }

    if (window.dxfTextLayer) {
        let chkTexts = document.getElementById('tgl_dxf_texts');
        if (chkTexts && chkTexts.checked) {
            if (!window.leafletMap.hasLayer(window.dxfTextLayer)) window.leafletMap.addLayer(window.dxfTextLayer);
            window.dxfTextLayer._reset();
        }
        else { window.leafletMap.removeLayer(window.dxfTextLayer); }
    }

    if (window.pointsLayerGroup) {
        let chkPts = document.getElementById('tgl_so_pts');
        if (chkPts && chkPts.checked) { if (!window.leafletMap.hasLayer(window.pointsLayerGroup)) window.leafletMap.addLayer(window.pointsLayerGroup); }
        else { window.leafletMap.removeLayer(window.pointsLayerGroup); }
    }

    let chkSoTexts = document.getElementById('tgl_so_texts');
    let mapCont = document.getElementById('map_container');
    if (chkSoTexts && mapCont) {
        if (chkSoTexts.checked) mapCont.classList.remove('hide-so-texts');
        else mapCont.classList.add('hide-so-texts');
    }
};

window.plotPointsOnMap = function() {
    if(!window.pointsLayerGroup) return;
    window.pointsLayerGroup.clearLayers();

    let total = window.setOutPoints.length;
    if (total === 0) return;

    let i = 0;
    let chunkSize = 50;
    let sharedCanvasRenderer = L.canvas({ padding: 0.5 });

    function processChunk() {
        let end = Math.min(i + chunkSize, total);
        for (; i < end; i++) {
            let ptIndex = i;
            let pt = window.setOutPoints[ptIndex];

            let ptMarker = L.circleMarker([pt.lat, pt.lon], {
                radius: 5, color: 'rgba(0,0,0,0.01)', weight: 25, fillColor: '#ef4444', fillOpacity: 1,
                renderer: sharedCanvasRenderer
            });
            ptMarker.bindTooltip(pt.p, { permanent: true, direction: 'right', className: 'pt-tooltip', offset: [5, 0] });

            ptMarker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                if (window.isMeasuring) { window.leafletMap.fireEvent('click', {latlng: e.latlng}); }
                else {
                    let popupContent = `<div style="text-align:center; padding: 5px; min-width: 120px;"><b style="font-size:14px; color:#1e3a8a;">Point: ${pt.p}</b>`;
                    if (window.activeApp === 3) { popupContent += `<button class="so-popup-btn" style="background:#2563eb; width:100%; margin-top:8px;" onclick="window.startMapSetOut(${ptIndex})">🎯 Set Out</button>`; }
                    else if (window.activeApp === 4) {
                        let isSelected = window.orderedAreaPoints.includes(ptIndex);
                        let btnText = isSelected ? "❌ Remove from Area" : "➕ Add to Area";
                        let btnColor = isSelected ? "#ef4444" : "#10b981";
                        popupContent += `<button class="so-popup-btn" style="background:${btnColor}; width:100%; margin-top:8px;" onclick="window.addPointToArea(${ptIndex})">${btnText}</button>`;
                    }
                    popupContent += `</div>`; L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(window.leafletMap);
                }
            });
            ptMarker.addTo(window.pointsLayerGroup);
        }
        if (i < total) setTimeout(processChunk, 15);
    }
    processChunk();
};