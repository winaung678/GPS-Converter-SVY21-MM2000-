// ==========================================
// --- WEB GEOID READER (JS BINARY READER) ---
// ==========================================
class WebGeoidReader {
    constructor(url, startLat, endLat, minLon, maxLon, step, isLittleEndian) {
        this.url = url; this.startLat = startLat; this.endLat = endLat;
        this.minLon = minLon; this.maxLon = maxLon; this.step = step;
        this.isLittleEndian = isLittleEndian;
        this.gridData = null;
        this.rows = Math.round(Math.abs(endLat - startLat) / step) + 1;
        this.cols = Math.round((maxLon - minLon) / step) + 1;
        this.isGlobal = (startLat === 90.0 && endLat === -90.0);
        this.loadData();
    }
    async loadData() {
        try {
            let response = await fetch(this.url);
            let buffer = await response.arrayBuffer();
            let dataView = new DataView(buffer);
            this.gridData = new Float32Array(buffer.byteLength / 4);
            for (let i = 0; i < this.gridData.length; i++) {
                this.gridData[i] = dataView.getFloat32(i * 4, this.isLittleEndian);
            }
        } catch (e) { console.error("Failed to load Geoid:", this.url); }
    }
    getUndulation(lat, lon) {
        if (!this.gridData) return null;
        let adjustedLon = lon; if (this.isGlobal && adjustedLon < 0) adjustedLon += 360.0;
        let minLat = Math.min(this.startLat, this.endLat); let maxLat = Math.max(this.startLat, this.endLat);
        if (lat < minLat || lat > maxLat || adjustedLon < this.minLon || adjustedLon > this.maxLon) return null;
        let r = (this.startLat > this.endLat) ? (this.startLat - lat) / this.step : (lat - this.startLat) / this.step;
        let c = (adjustedLon - this.minLon) / this.step;
        let r0 = Math.floor(r); let c0 = Math.floor(c);
        let r1 = (r0 + 1 < this.rows) ? r0 + 1 : r0; let c1 = (c0 + 1 < this.cols) ? c0 + 1 : (this.isGlobal ? 0 : c0);
        let n00 = this.gridData[r0 * this.cols + c0]; let n01 = this.gridData[r0 * this.cols + c1];
        let n10 = this.gridData[r1 * this.cols + c0]; let n11 = this.gridData[r1 * this.cols + c1];
        if (n00===undefined || n01===undefined || n10===undefined || n11===undefined) return null;
        let dr = r - r0; let dc = c - c0;
        return (n00 * (1 - dc) + n01 * dc) * (1 - dr) + (n10 * (1 - dc) + n11 * dc) * dr;
    }
}

// Load Geoids for Web
window.webEgm2008 = new WebGeoidReader("egm2008_1min.bin", 1.0, 29.0, 92.0, 104.0, 1.0/60.0, false);
window.webEgm96 = new WebGeoidReader("egm96_global.bin", 90.0, -90.0, 0.0, 360.0, 0.25, true);

// ==========================================
// --- CORE APP LOGIC & UI EVENTS ---
// ==========================================

window.onload = function() {
    loadPointsFromStorage();
    let storedRecords = localStorage.getItem('surveyProRecords');
    if (storedRecords) window.recordedPointsBank = JSON.parse(storedRecords);
    attachPasteFilterToInputs();

    let sSoDatum = localStorage.getItem('pref_so_datum');
    if(sSoDatum) { document.getElementById('so_datum').value = sSoDatum; window.toggleSoDatum(); }
    let sDxfDatum = localStorage.getItem('pref_dxf_datum');
    if(sDxfDatum) { document.getElementById('dxf_datum').value = sDxfDatum; window.toggleDxfDatum(); }

    // 🔴 ဝင်ဝင်ချင်း အမြဲတမ်း Dashboard (Main Face) ကိုသာ ပြသမည်
    window.switchApp(0);

    // Web Compass Listener
    if (window.DeviceOrientationEvent) {
        window.addEventListener("deviceorientationabsolute", (event) => {
            if (event.alpha !== null) window.onCompassUpdate(360 - event.alpha);
        }, true);
        window.addEventListener("deviceorientation", (event) => {
            if (event.webkitCompassHeading) window.onCompassUpdate(event.webkitCompassHeading); // iOS
        }, true);
    }
};

function attachPasteFilterToInputs() {
    let inputs = document.querySelectorAll('.v2-input, .dms-grid input');
    inputs.forEach(input => {
        if (input.id.includes('_lat_') || input.id.includes('_lon_') || input.id.includes('_inp_') || input.id.includes('so_m_')) {
            input.addEventListener('paste', function(e) { e.preventDefault(); let pasteData = (e.clipboardData || window.clipboardData).getData('text'); let cleanNumber = pasteData.replace(/[^\d.-]/g, ''); document.execCommand('insertText', false, cleanNumber); });
        }
    });
}

// Modals ဖွင့်ခြင်း/ပိတ်ခြင်းများ
window.openAbout = function() { document.getElementById('aboutModal').style.display='flex'; history.pushState({modal: true}, "Modal", ""); };
window.closeAbout = function() { document.getElementById('aboutModal').style.display='none'; };

// 🔴 Play Store သို့ Web မှတစ်ဆင့် သွားနိုင်ရန် ပြင်ဆင်ချက်
window.openPlayStore = function() {
    if(window.AndroidNative && window.AndroidNative.openPlayStore) {
        window.AndroidNative.openPlayStore();
    } else {
        // Web Browser မှ နှိပ်လျှင် Play Store Link ကို တိုက်ရိုက်ဖွင့်မည်
        window.open("https://play.google.com/store/apps/details?id=com.winaung.svy21converter", "_blank");
    }
};
window.toggleSound = function() { window.isSoundOn = !window.isSoundOn; let btn = document.getElementById('soundBtn'); btn.innerText = window.isSoundOn ? "🔊 Sound: ON" : "🔇 Sound: OFF"; btn.style.background = window.isSoundOn ? "#10b981" : "#ef4444"; };
window.toggleInputLock = function(lock) { document.querySelectorAll('.v2-input, .dms-grid input').forEach(i => { if(i.id !== 'pt_id' && i.id !== 'pt_desc' && i.id !== 'csv_mode' && !i.id.startsWith('so_') && !i.id.startsWith('dxf_') && !i.id.startsWith('cam_') && !i.id.endsWith('_man_pt') && !i.id.endsWith('_man_desc')) { if(lock) { i.classList.add('input-locked'); i.readOnly = true; } else { i.classList.remove('input-locked'); i.readOnly = false; } } }); };

window.toggleSoDatum = function() { let v = document.getElementById('so_datum').value; let customDiv = document.getElementById('so_custom_utm'); if(customDiv) customDiv.style.display = (v === "GLOBAL_UTM") ? "flex" : "none"; localStorage.setItem('pref_so_datum', v); };
window.toggleDxfDatum = function() { let v = document.getElementById('dxf_datum').value; let customDiv = document.getElementById('dxf_custom_utm'); if(customDiv) customDiv.style.display = (v === "GLOBAL_UTM") ? "flex" : "none"; localStorage.setItem('pref_dxf_datum', v); };
window.toggleCogoDatum = function() { let v = document.getElementById('cogo_datum').value; let customDiv = document.getElementById('cogo_custom_utm'); if(customDiv) customDiv.style.display = (v === "GLOBAL_UTM") ? "flex" : "none"; };

window.handleTopMenuClick = function() { window.isTopoMode = !window.isTopoMode; window.updateTopoUI(); };

window.updateTopoUI = function() {
    let btn = document.getElementById('topMenuBtn'); let n = window.activeApp;
    if (window.isNativeGPSActive && (n === 1 || n === 2 || n === 5)) {
        btn.classList.remove('hidden');
        if (window.isTopoMode) {
            btn.innerHTML = "🧮 Data View"; btn.classList.add('topo-active'); document.getElementById('shared_map_view').classList.remove('hidden');
            document.getElementById('v2_calc_ui').classList.add('hidden'); document.getElementById('m_calc_ui').classList.add('hidden'); document.getElementById('g_calc_ui').classList.add('hidden');
            if (!window.leafletMap) window.initMap();
            setTimeout(() => { window.leafletMap.invalidateSize(); window.plotRecordedPointsOnMap(); }, 350);
        } else {
            btn.innerHTML = "🗺️ Map View"; btn.classList.remove('topo-active'); document.getElementById('shared_map_view').classList.add('hidden');
            if (n === 1) document.getElementById('v2_calc_ui').classList.remove('hidden'); if (n === 2) document.getElementById('m_calc_ui').classList.remove('hidden'); if (n === 5) document.getElementById('g_calc_ui').classList.remove('hidden');
        }
    } else {
        btn.classList.add('hidden');
        if (!window.isNativeGPSActive && (n === 1 || n === 2 || n === 5)) { document.getElementById('shared_map_view').classList.add('hidden'); if (n === 1) document.getElementById('v2_calc_ui').classList.remove('hidden'); if (n === 2) document.getElementById('m_calc_ui').classList.remove('hidden'); if (n === 5) document.getElementById('g_calc_ui').classList.remove('hidden'); }
    }
};

window.switchApp = function(n) {
    // 🔴 History (URL) ပြောင်းခြင်းကို လုံးဝ ဖယ်ရှားလိုက်ပါသည်
    // (if (window.activeApp === 0 && n !== 0) { history.pushState... } ဆိုတာကို ဖြုတ်လိုက်ပါ)

    if (window.isNativeGPSActive && window.activeApp !== n) { window.toggleGlobalGPS(); }
    if (window.activeApp === 3 && n !== 3) { window.stopNavigation(); }
    if (window.activeApp === 4 && n !== 4) { window.clearAreaResultOnly(); }

    window.activeApp = n;
    localStorage.setItem('surveyProLastApp', n);

    // 🔴 Dashboard အပြင် တခြား App တွေ ရောက်သွားတိုင်း Browser History သို့ (Dummy) အတုတစ်ခု ထည့်ထားမည်
    // သို့မှသာ User က ဖုန်း Back ကို နှိပ်လျှင် App အပြင် တန်းမထွက်သွားမည်ဖြစ်သည်
    if (n !== 0) {
        history.pushState({appState: n}, "App " + n, "");
    }

    // ... (အောက်ပိုင်း DOM Element များ Show/Hide လုပ်သည့် Code များ အရင်အတိုင်း ဆက်ထားပါ) ...

    document.getElementById('dashboard_view').classList.toggle('hidden', n !== 0);
    document.getElementById('app1_view').classList.toggle('hidden', n !== 1);
    document.getElementById('app2_view').classList.toggle('hidden', n !== 2);
    document.getElementById('app3_view').classList.toggle('hidden', n !== 3);
    document.getElementById('app4_view').classList.toggle('hidden', n !== 4);
    document.getElementById('app5_view').classList.toggle('hidden', n !== 5);
    document.getElementById('app6_view').classList.toggle('hidden', n !== 6);
    document.getElementById('app7_view').classList.toggle('hidden', n !== 7);

    let showSharedTools = (n === 1 || n === 2 || n === 5) && !window.isNativeGPSActive;
    let showRecordPanel = (n === 1 || n === 2 || n === 5) && window.isNativeGPSActive;

    if (n === 0 || n === 3 || n === 4 || n === 6 || n === 7) { document.getElementById('shared_tools_view').classList.add('hidden'); }
    else { document.getElementById('shared_tools_view').classList.remove('hidden'); document.getElementById('record_panel').style.display = showRecordPanel ? 'block' : 'none'; document.getElementById('csv_panel').style.display = showSharedTools ? 'block' : 'none'; }

    let gpsBtn = document.getElementById('globalGpsBtn'); let menuBtn = document.getElementById('topMenuBtn');
    if (n === 0 || n === 4) { gpsBtn.classList.add('hidden'); menuBtn.classList.add('hidden'); document.getElementById('shared_map_view').classList.add('hidden'); } else { gpsBtn.classList.remove('hidden'); }

    if (n === 3 || n === 6) { window.isTopoMode = false; menuBtn.classList.add('hidden'); document.getElementById('shared_map_view').classList.remove('hidden'); let mapDiv = document.getElementById('map_view'); if (n === 6) { mapDiv.classList.add('map-full-height'); } else { mapDiv.classList.remove('map-full-height'); } }
    else if (n === 4) { window.isTopoMode = false; menuBtn.classList.add('hidden'); document.getElementById('shared_map_view').classList.add('hidden'); document.getElementById('map_view').classList.remove('map-full-height'); if (typeof window.closeCogoTool === "function") window.closeCogoTool(); }
    else if (n === 7) { document.getElementById('shared_map_view').classList.add('hidden'); window.isTopoMode = false; menuBtn.classList.add('hidden'); }

    let csvSelect = document.getElementById('csv_mode');
    if(csvSelect) { if (n === 5) { csvSelect.options[0].text = `UTM (PNEZD) → WGS84 (Lat, Lon)`; csvSelect.options[1].text = `WGS84 (Lat, Lon) → UTM (PNEZD)`; csvSelect.options[2].style.display = 'none'; if (csvSelect.value === "3") csvSelect.value = "1"; } else { let dName = (n === 1) ? "SVY21" : "MM2000"; csvSelect.options[0].text = `${dName} (Local NE) → WGS84 LL & NE`; csvSelect.options[1].text = `WGS84 LL (Lat, Lon) → ${dName} NE`; csvSelect.options[2].text = `WGS84 NE → ${dName} Local NE`; csvSelect.options[2].style.display = 'block'; } }

    if((n === 3 || n === 7) && !window.isNativeGPSActive) window.toggleGlobalGPS();

    if(n !== 0 && n !== 7) {
        if(!window.leafletMap) window.initMap();

        // 🔴 DXF စာမျက်နှာ (App 6) ကို ရောက်ရင် Memory ထဲမှာ DXF မရှိရင် DB ထဲကနေ အတင်းပြန်ခေါ်မည်
        if (n === 6) {
            if ((!window.rawDxfEntities || window.rawDxfEntities.length === 0) && typeof window.loadSavedDXF === 'function') {
                window.loadSavedDXF();
            }
        }

        setTimeout(() => {
            window.leafletMap.invalidateSize();
            if (n === 3 || n === 4 || n === 6) { if (window.recordedLayerGroup && window.leafletMap.hasLayer(window.recordedLayerGroup)) { window.leafletMap.removeLayer(window.recordedLayerGroup); } if (window.pointsLayerGroup && !window.leafletMap.hasLayer(window.pointsLayerGroup)) { window.leafletMap.addLayer(window.pointsLayerGroup); } window.plotPointsOnMap(); }
            if (n === 1 || n === 2 || n === 5) { if (window.recordedLayerGroup && !window.leafletMap.hasLayer(window.recordedLayerGroup)) { window.leafletMap.addLayer(window.recordedLayerGroup); } window.plotRecordedPointsOnMap(); window.updateTopoUI(); }

            // 🔴 DXF ဆွဲမည့် အပိုင်းကို သေချာစစ်ဆေးမည်
            if (window.rawDxfEntities && window.rawDxfEntities.length > 0) {
                if (window.dxfLineLayer === null) { window.renderDXF(); } else { window.toggleDxfLayers(); }
            } else { window.toggleDxfLayers(); }

            if (n === 1 || n === 2 || n === 5) { if (window.pointsLayerGroup && window.leafletMap.hasLayer(window.pointsLayerGroup)) { window.leafletMap.removeLayer(window.pointsLayerGroup); } }
        }, 350);
    }
    if(n === 4) { window.populateAreaPoints(); window.updateAreaOrderUI(); }
};

window.toggleGlobalGPS = function() {
    window.isNativeGPSActive = !window.isNativeGPSActive; let btn = document.getElementById('globalGpsBtn');
    let subV2 = document.getElementById('v2_subtitle'); let subM = document.getElementById('m_subtitle'); let subG = document.getElementById('g_subtitle');

    if(window.isNativeGPSActive) {
        window.isTopoMode = true; btn.innerHTML = "🛑 Stop GPS"; btn.classList.add('active');
        if(subV2) subV2.innerHTML = "Singapore Datum (Topo Mode)"; if(subM) subM.innerHTML = "Myanmar Datum (Topo Mode)"; if(subG) subG.innerHTML = "Universal Transverse Mercator (Topo Mode)";
        document.getElementById('v2_gps_box').classList.remove('hidden'); document.getElementById('m_gps_box').classList.remove('hidden'); document.getElementById('g_gps_box').classList.remove('hidden');
        document.getElementById('v2_mode').value = 'LL2SVY'; document.getElementById('m_mode').value = 'W2M_LL'; document.getElementById('g_mode').value = 'LL2UTM';
        document.getElementById('v2_mode').disabled = true; document.getElementById('m_mode').disabled = true; document.getElementById('m_zone').disabled = true; document.getElementById('g_mode').disabled = true;
        window.v2_toggleUI(); window.m_toggleUI(); window.g_toggleUI(); window.toggleInputLock(true);
        if (window.activeApp === 1 || window.activeApp === 2 || window.activeApp === 5) { document.getElementById('record_panel').style.display = 'block'; document.getElementById('csv_panel').style.display = 'none'; window.updateTopoUI(); }

        // WEB GPS TRACKING (Fallback)
        if (typeof window.AndroidNative === 'undefined' && navigator.geolocation) {
            window.webGPSWatchId = navigator.geolocation.watchPosition((pos) => {
                window.onNativeGPSUpdate({
                    lat: pos.coords.latitude, lon: pos.coords.longitude,
                    alt: pos.coords.altitude||0, acc: pos.coords.accuracy||0, hAcc: pos.coords.accuracy||0,
                    vAcc: pos.coords.altitudeAccuracy||0, satCount: 5
                });
            }, (err) => { alert("GPS Error: " + err.message); }, { enableHighAccuracy: true, maximumAge: 0 });
        }
    } else {
        window.isTopoMode = false; btn.innerHTML = "🛰️ GPS: OFF"; btn.classList.remove('active');
        if(subV2) subV2.innerHTML = "Singapore Datum (Converter Mode)"; if(subM) subM.innerHTML = "Myanmar Datum (Converter Mode)"; if(subG) subG.innerHTML = "Universal Transverse Mercator (Converter Mode)";
        document.getElementById('v2_gps_box').classList.add('hidden'); document.getElementById('m_gps_box').classList.add('hidden'); document.getElementById('g_gps_box').classList.add('hidden');
        document.getElementById('v2_mode').disabled = false; document.getElementById('m_mode').disabled = false; document.getElementById('m_zone').disabled = false; document.getElementById('g_mode').disabled = false;
        window.toggleInputLock(false); window.resetBM('v2'); window.resetBM('m'); window.resetBM('g');
        window.currentRawAlt = 0; window.appliedPoleH = 0; window.latest_local_N = 0; window.latest_local_E = 0; window.latest_wgs_N = 0; window.latest_wgs_E = 0; window.latest_Z = 0; window.latest_lat = 0; window.latest_lon = 0; window.currentGeoidN = 0; window.currentGeoidModel = "Unknown";
        document.getElementById('v2_gps_stat').innerText = "H: -- | V: --"; document.getElementById('m_gps_stat').innerText = "H: -- | V: --"; document.getElementById('g_gps_stat').innerText = "H: -- | V: --";
        document.getElementById('v2_dop_info').innerText = "PDOP: -- | VDOP: --"; document.getElementById('m_dop_info').innerText = "PDOP: -- | VDOP: --"; document.getElementById('g_dop_info').innerText = "PDOP: -- | VDOP: --";
        document.getElementById('v2_geoid_val').innerText = "Geoid (N): --.--- m"; document.getElementById('m_geoid_val').innerText = "Geoid (N): --.--- m"; document.getElementById('g_geoid_val').innerText = "Geoid (N): --.--- m";
        document.getElementById('v2_raw_alt').innerText = "Raw GPS Alt: --.--- m"; document.getElementById('m_raw_alt').innerText = "Raw GPS Alt: --.--- m"; document.getElementById('g_raw_alt').innerText = "Raw GPS Alt: --.--- m";
        if (window.activeApp === 1 || window.activeApp === 2 || window.activeApp === 5) { document.getElementById('record_panel').style.display = 'none'; document.getElementById('csv_panel').style.display = 'block'; window.updateTopoUI(); }
        if (window.webGPSWatchId !== null) { navigator.geolocation.clearWatch(window.webGPSWatchId); window.webGPSWatchId = null; }
    }
};

function fetchGeoidDataFromNative(lat, lon) {
    if (window.AndroidNative && window.AndroidNative.getGeoidData) {
        let jsonStr = window.AndroidNative.getGeoidData(lat, lon);
        try { let data = JSON.parse(jsonStr); if (data.geoid_n !== null) { window.currentGeoidN = data.geoid_n; window.currentGeoidModel = data.geoid_model; } else { window.currentGeoidN = 0; window.currentGeoidModel = "Unknown"; } } catch(e) { window.currentGeoidN = 0; window.currentGeoidModel = "Unknown"; }
    } else {
        // WEB GEOID LOOKUP (JS)
        let n = window.webEgm2008 ? window.webEgm2008.getUndulation(lat, lon) : null;
        if (n !== null) { window.currentGeoidN = n; window.currentGeoidModel = "EGM2008"; }
        else {
            let glon = lon < 0 ? lon + 360 : lon;
            let n96 = window.webEgm96 ? window.webEgm96.getUndulation(lat, glon) : null;
            if (n96 !== null) { window.currentGeoidN = n96; window.currentGeoidModel = "EGM96"; }
            else { window.currentGeoidN = 0; window.currentGeoidModel = "Unknown"; }
        }
    }
}

window.onNativeGPSUpdate = function(d) {
    if(!window.isNativeGPSActive) return;
    let t = (window.activeApp === 1) ? 'v2' : (window.activeApp === 2) ? 'm' : 'g';
    let lat = d.lat, lon = d.lon; window.currentLat = lat; window.currentLon = lon; window.latest_lat = lat; window.latest_lon = lon;

    // Altitude smoothing
    let rawIncomingAlt = d.alt || 0; window.altBuffer.push(rawIncomingAlt); if(window.altBuffer.length > window.BUFFER_SIZE) window.altBuffer.shift(); window.currentRawAlt = window.altBuffer.reduce((a,b) => a + b, 0) / window.altBuffer.length;

    // Check Geoid
    if(d.geoid_n !== undefined && d.geoid_n !== null) { window.currentGeoidN = d.geoid_n; window.currentGeoidModel = d.geoid_model || "Unknown"; }
    else { fetchGeoidDataFromNative(lat, lon); }

    // H Accuracy သာ ပြသမည်
    let hA = d.hAcc || d.acc || 0;

    if(window.activeApp === 1 || window.activeApp === 2 || window.activeApp === 5) {
        document.getElementById(t+'_gps_stat').innerText = `H.Acc: ${hA.toFixed(1)}m`;
        let pdop = d.pdop ? d.pdop.toFixed(1) : "--", vdop = d.vdop ? d.vdop.toFixed(1) : "--";
        document.getElementById(t+'_dop_info').innerText = `PDOP: ${pdop} | VDOP: ${vdop}`;
        let rawAltUI = document.getElementById(t+'_raw_alt'); let geoidUI = document.getElementById(t+'_geoid_val');
        if (rawAltUI) rawAltUI.innerText = `Raw GPS Alt: ${window.currentRawAlt.toFixed(3)} m`;
        if (geoidUI) geoidUI.innerText = `Geoid (N): ${window.currentGeoidN.toFixed(3)} m`;
    }
    updateZDisplay(t);

    if(window.activeApp === 1) { document.getElementById('v2_lat_dd').value = lat.toFixed(9); document.getElementById('v2_lon_dd').value = lon.toFixed(9); window.v2_sync('lat','dd'); window.v2_sync('lon','dd'); window.v2_run(); }
    if(window.activeApp === 2) { window.autoDetectZone(lon); document.getElementById('m_lat_dd').value = lat.toFixed(9); document.getElementById('m_lon_dd').value = lon.toFixed(9); window.m_sync('lat','dd'); window.m_sync('lon','dd'); window.m_run(); }
    if(window.activeApp === 5) { document.getElementById('g_lat_dd').value = lat.toFixed(9); document.getElementById('g_lon_dd').value = lon.toFixed(9); window.g_sync('lat','dd'); window.g_sync('lon','dd'); window.g_run(); }

    if(window.activeApp !== 0 && window.activeApp !== 7 && window.leafletMap) {
        if(!window.markerCurrent) {
            let currIcon = L.divIcon({
                className: '', iconSize: [50, 50], iconAnchor: [25, 25],
                html: `<div id="gps-heading-cone" style="width: 50px; height: 50px; transform: rotate(${window.compassAzimuth||0}deg); transform-origin: center center; transition: transform 0.1s ease-out;"><svg width="50" height="50" viewBox="0 0 50 50"><path d="M25,25 L10,0 A25,25 0 0,1 40,0 Z" fill="url(#gradCone)" opacity="0.5" /><circle cx="25" cy="25" r="6" fill="#2563eb" stroke="white" stroke-width="2.5" /><defs><linearGradient id="gradCone" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" /><stop offset="100%" style="stop-color:#60a5fa;stop-opacity:0" /></linearGradient></defs></svg></div>`
            });
            window.markerCurrent = L.marker([window.currentLat, window.currentLon], {icon: currIcon, zIndexOffset: 1000}).addTo(window.leafletMap);
        } else {
            window.markerCurrent.setLatLng([window.currentLat, window.currentLon]);
        }
        if(window.isAutoCenter) {
            if(!window.targetPoint || window.activeApp !== 3) { window.leafletMap.panTo([window.currentLat, window.currentLon]); }
            else { let bounds = L.latLngBounds([window.currentLat, window.currentLon], [window.targetPoint.lat, window.targetPoint.lon]); window.leafletMap.fitBounds(bounds, {padding: [50, 50], maxZoom: 24}); }
        }
        if(window.targetPoint && window.activeApp === 3) { window.updateSetOut(); }
    }
};

window.onCompassUpdate = function(azimuth) {
    window.compassAzimuth = azimuth;
    if(window.activeApp === 3 && window.targetPoint) window.updateSetOut();
    let headingElement = document.getElementById('gps-heading-cone');
    if (headingElement) { headingElement.style.transform = `rotate(${azimuth}deg)`; }
};

// ==========================================
// --- Z (MSL) & POLE/BM LOGIC ---
// ==========================================
function updateZDisplay(t) { if (!window.currentRawAlt) return; let finalZ = window.currentRawAlt - window.currentGeoidN - window.appliedPoleH; if (window.isBMMode) { finalZ += window.zOffset; } window.latest_Z = finalZ; if (window.activeApp === 1 || window.activeApp === 2 || window.activeApp === 5) { let zb = document.getElementById(t+'_z_val'); let modeText = window.isBMMode ? "Z (BM Mode)" : window.appliedPoleH > 0 ? `MSL (Pole -${window.appliedPoleH}m)` : `MSL (${window.currentGeoidModel})`; window.globalZText = `${modeText}: ${finalZ.toFixed(3)} m`; if (zb) { zb.innerText = window.globalZText; zb.style.color = window.isBMMode ? "#dc2626" : (window.activeApp === 5 ? "#0f766e" : "#059669"); } } }
window.applyPole = function(val) { window.appliedPoleH = parseFloat(val) || 0; document.getElementById('v2_pole_val').value = document.getElementById('m_pole_val').value = document.getElementById('g_pole_val').value = val; updateZDisplay('v2'); updateZDisplay('m'); updateZDisplay('g'); };
window.setBM = function(t) { let p_val = document.getElementById(t+'_pole_val').value; let b_val = document.getElementById(t+'_bm_val').value; if (b_val === '') return alert("Please enter a Benchmark (BM) value to SET!"); if (!window.isNativeGPSActive) return alert("Start GPS first!"); if (!window.currentRawAlt) return alert("Waiting for GPS Altitude..."); document.getElementById('v2_pole_val').value = document.getElementById('m_pole_val').value = document.getElementById('g_pole_val').value = p_val; document.getElementById('v2_bm_val').value = document.getElementById('m_bm_val').value = document.getElementById('g_bm_val').value = b_val; window.appliedPoleH = parseFloat(p_val) || 0; let bmValue = parseFloat(b_val); if (isNaN(bmValue)) return alert("Invalid BM value!"); window.zOffset = bmValue - (window.currentRawAlt - window.currentGeoidN - window.appliedPoleH); window.isBMMode = true; updateZDisplay(t); alert("Benchmark Calibration Successful!"); };
window.resetBM = function(t) { window.appliedPoleH = 0; window.zOffset = 0; window.isBMMode = false; document.getElementById('v2_pole_val').value = ''; document.getElementById('m_pole_val').value = ''; document.getElementById('g_pole_val').value = ''; document.getElementById('v2_bm_val').value = ''; document.getElementById('m_bm_val').value = ''; document.getElementById('g_bm_val').value = ''; updateZDisplay(t); };

// ==========================================
// --- SYSTEM BACK BUTTON & MODALS LOGIC ---
// ==========================================

window.openAbout = function() {
    document.getElementById('aboutModal').style.display='flex';
    history.pushState({modal: true}, "Modal", ""); // Modal အတွက်သာ သီးသန့် State မှတ်မည်
};
window.closeAbout = function() {
    document.getElementById('aboutModal').style.display='none';
};

window.openPlayStore = function() {
    if(window.AndroidNative && window.AndroidNative.openPlayStore) {
        window.AndroidNative.openPlayStore();
    } else {
        window.open("https://play.google.com/store/apps/details?id=com.winaung.svy21converter", "_blank");
    }
};

// 🔴 System Back ခလုတ် (ဖုန်း Back) ကို ဖမ်းယူခြင်း
window.addEventListener("popstate", function(e) {
    // ၁။ Modal (About Us, Privacy) ပုံးလေးတွေ ပွင့်နေရင် အဲ့ဒါကိုပဲ အရင်ပိတ်မည်
    let modals = document.querySelectorAll('.modal');
    let modalClosed = false;
    modals.forEach(m => {
        if (m.style.display === 'flex') {
            m.style.display = 'none';
            modalClosed = true;
        }
    });
    if (modalClosed) return; // ပုံးပိတ်သွားရင် အနောက်ကို ထပ်မဆုတ်တော့ပါ

    // ၂။ COGO ထဲရောက်နေရင် (App 4)
    if (window.activeApp === 4) {
        let cogoContainer = document.getElementById('cogo_tool_container');
        // COGO ရဲ့ (Area/Inverse/Grad) Tool တစ်ခုခု ပွင့်နေတယ်ဆိုရင်
        if (!cogoContainer.classList.contains('hidden')) {
            window.closeCogoTool(); // COGO Main Menu ကိုသာ ပြန်သွားမည်
            // History မှာ ဆက်နေနိုင်အောင် အတုတစ်ခု ပြန်ထည့်ပေးမည်
            history.pushState({appState: 4}, "App 4", "");
            return;
        }
    }

    // ၃။ တခြား App တွေ (SVY21, COGO Main Menu စသည်) ရောက်နေရင် Dashboard ကို ပြန်သွားမည်
    if (window.activeApp !== 0) {
        window.switchApp(0); // 0 (Dashboard) ကို ခေါ်လိုက်ပါမည်
    }
});