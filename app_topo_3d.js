// ==========================================
// --- 3D TIN SURFACE VIEWER & 3D DXF EXPORT ---
// ==========================================

window.update3DScale = function(val) {
    let displayVal = document.getElementById('z_scale_val');
    if (displayVal) displayVal.innerText = parseFloat(val).toFixed(1) + 'x';
    if (document.getElementById('plotly_3d_div')) {
        Plotly.relayout('plotly_3d_div', { 'scene.aspectratio.z': parseFloat(val) });
    }
};

window.view3DSurface = function() {
    if (!window.topoPoints || window.topoPoints.length < 3 || !window.topoTriangles || window.topoTriangles.length === 0) {
        return alert("⚠️ Please generate Topo Surface first!");
    }

    let modal = document.getElementById('topo3dModal');
    modal.style.display = 'flex';
    
    // (၁) အပေါ်ယံ မျက်နှာပြင် (Top Surface) 
    let top_x = [], top_y = [], top_z = [];
    let top_i = [], top_j = [], top_k = [];
    let ptMap = new Map();
    let ptIndex = 0;
    let originalPts = [];

    function getPtIdx(pt) {
        let key = `${pt.e.toFixed(3)}_${pt.n.toFixed(3)}_${pt.z.toFixed(3)}`;
        if(!ptMap.has(key)) {
            ptMap.set(key, ptIndex);
            top_x.push(pt.e); top_y.push(pt.n); top_z.push(pt.z);
            originalPts.push(pt); ptIndex++;
        }
        return ptMap.get(key);
    }

    window.topoTriangles.forEach(t => {
        top_i.push(getPtIdx(t.p1)); top_j.push(getPtIdx(t.p2)); top_k.push(getPtIdx(t.p3));
    });

    let topSurfaceTrace = {
        type: 'mesh3d', x: top_x, y: top_y, z: top_z, i: top_i, j: top_j, k: top_k,
        intensity: top_z, colorscale: 'Jet', showscale: true,
        colorbar: { title: 'Elevation (m)', titleside: 'right', tickfont: {color: '#ffffff'}, titlefont: {color: '#ffffff'} },
        flatshading: true, contour: { show: true, color: '#ffffff', width: 2 }, name: 'Surface'
    };

    // (၂) ဘေးဘောင် နံရံများ (Skirt / Walls) 
    let minZ = Math.min(...top_z); let maxZ = Math.max(...top_z);
    let zRange = maxZ - minZ; let baseZ = minZ - (zRange * 0.15); 
    if (zRange === 0) baseZ = minZ - 5; 

    let edgeCount = new Map();
    function getEdgeKey(idx1, idx2) { return idx1 < idx2 ? `${idx1}_${idx2}` : `${idx2}_${idx1}`; }

    for (let t = 0; t < top_i.length; t++) {
        let edges = [[top_i[t], top_j[t]], [top_j[t], top_k[t]], [top_k[t], top_i[t]]];
        edges.forEach(edge => {
            let key = getEdgeKey(edge[0], edge[1]);
            edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        });
    }

    let wall_x = [], wall_y = [], wall_z = [];
    let wall_i = [], wall_j = [], wall_k = [];
    let wallIdx = 0;

    edgeCount.forEach((count, key) => {
        if (count === 1) { 
            let indices = key.split('_');
            let ptA = originalPts[parseInt(indices[0])];
            let ptB = originalPts[parseInt(indices[1])];

            wall_x.push(ptA.e, ptB.e, ptB.e, ptA.e); wall_y.push(ptA.n, ptB.n, ptB.n, ptA.n); wall_z.push(ptA.z, ptB.z, baseZ, baseZ);
            wall_i.push(wallIdx, wallIdx); wall_j.push(wallIdx + 1, wallIdx + 2); wall_k.push(wallIdx + 2, wallIdx + 3);
            wallIdx += 4; 
        }
    });

    let wallTrace = {
        type: 'mesh3d', x: wall_x, y: wall_y, z: wall_z, i: wall_i, j: wall_j, k: wall_k,
        color: '#94a3b8', flatshading: true, hoverinfo: 'none', name: 'Base Wall'
    };

    // (၃) အမြဲတမ်းပေါ်နေမည့် Contours မျဉ်းများ
    let cx = [], cy = [], cz = [];
    if (window.topoContours && window.topoContours.length > 0) {
        window.topoContours.forEach(poly => {
            poly.points.forEach(pt => { cx.push(pt.e); cy.push(pt.n); cz.push(poly.z); });
            cx.push(null); cy.push(null); cz.push(null); 
        });
    }

    let contourTrace = { type: 'scatter3d', mode: 'lines', x: cx, y: cy, z: cz, line: { color: '#000000', width: 2 }, hoverinfo: 'none', showlegend: false };

    // (၄) 3D Plotly Render လုပ်ခြင်း
    let zScaleInput = document.getElementById('topo_z_scale');
    let initialZScale = zScaleInput ? parseFloat(zScaleInput.value) : 0.5;

    let layout = {
        paper_bgcolor: '#1e293b', margin: {l: 0, r: 0, b: 0, t: 0},
        scene: {
            xaxis: {title: 'Easting (X)', color: '#fff', gridcolor: '#475569', tickformat: '.0f'},
            yaxis: {title: 'Northing (Y)', color: '#fff', gridcolor: '#475569', tickformat: '.0f'},
            zaxis: {title: 'Elevation (Z)', color: '#fff', gridcolor: '#475569', tickformat: '.2f'},
            aspectratio: { x: 1, y: 1, z: initialZScale },
            camera: { eye: {x: -1.25, y: -1.25, z: 1.25} }
        }
    };

    let plotData = [topSurfaceTrace];
    if (wall_i.length > 0) plotData.push(wallTrace); 
    if (cx.length > 0) plotData.push(contourTrace); 

    // Custom Camera Icon
    let customCamIcon = {
        width: 1792, ascent: 1792, descent: 0,
        path: 'M896 672q119 0 203.5 84.5t84.5 203.5-84.5 203.5-203.5 84.5-203.5-84.5-84.5-203.5 84.5-203.5 203.5-84.5zm0 384q66 0 113-47t47-113-47-113-113-47-113 47-47 113 47 113 113 47zm416-288q0-13-10-23t-22-10h-160q-13 0-23 10t-10 23v64q0 13 10 23t23 10h160q13 0 23-10t10-23v-64zm416 160v448q0 106-75 181t-181 75h-1152q-106 0-181-75t-75-181v-448q0-106 75-181t181-75h224l51-136q19-49 69.5-84.5t103.5-35.5h256q53 0 103.5 35.5t69.5 84.5l51 136h224q106 0 181 75t75 181z'
    };

    Plotly.newPlot('plotly_3d_div', plotData, layout, {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['toImage'], 
        modeBarButtonsToAdd: [{
            name: 'Download Exact 3D View as PNG',
            icon: customCamIcon,
            click: function(gd) {
                let currentLayout = gd.layout;
                let currentScene = currentLayout.scene || {};
                let currentCamera = currentScene.camera || { eye: {x: -1.25, y: -1.25, z: 1.25} };
                let zInput = document.getElementById('topo_z_scale');
                let currentZScale = zInput ? parseFloat(zInput.value) : 0.5;

                let exportLayout = {
                    scene: { camera: currentCamera, aspectratio: { x: 1, y: 1, z: currentZScale }, xaxis: currentScene.xaxis, yaxis: currentScene.yaxis, zaxis: currentScene.zaxis },
                    paper_bgcolor: '#1e293b', margin: {l: 0, r: 0, b: 0, t: 0}
                };

                Plotly.toImage(gd, {format: 'png', width: 1200, height: 800, layout: exportLayout}).then(function(dataUrl) {
                    let fileName = `3D_Topo_Map_${new Date().getTime()}.png`;
                    if (window.AndroidNative && window.AndroidNative.downloadPlotlyImage) {
                        window.AndroidNative.downloadPlotlyImage(dataUrl, fileName);
                    } else {
                        let a = document.createElement('a'); a.href = dataUrl; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    }
                });
            }
        }]
    });
};
// ... အောက်က export3DTinDXF() အပိုင်း ဆက်ရှိပါမည် ...

// ==========================================
// 2. AutoCAD အတွက် 3D Surface (3DFACE) DXF Export ထုတ်ခြင်း
// ==========================================
window.export3DTinDXF = function() {
    if (!window.topoTriangles || window.topoTriangles.length === 0) {
        return alert("⚠️ No 3D Triangles generated. Please generate Topo first!");
    }

    // DXF Header
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n";
    
    // Layer Table
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n2\n"; 
    dxf += "0\nLAYER\n2\nTOPO_3D_TIN_SURFACE\n70\n0\n62\n3\n6\nCONTINUOUS\n"; // 3D Surface အတွက် Layer (အစိမ်းရောင်)
    dxf += "0\nENDTAB\n0\nENDSEC\n";
    
    // Entities Section စတင်ခြင်း
    dxf += "0\nSECTION\n2\nENTITIES\n";

    // တြိဂံတစ်ခုချင်းစီကို AutoCAD 3DFACE အဖြစ် ပြောင်းခြင်း
    window.topoTriangles.forEach(t => {
        dxf += "0\n3DFACE\n";
        dxf += "8\nTOPO_3D_TIN_SURFACE\n";
        
        // Point 1 (X, Y, Z)
        dxf += `10\n${t.p1.e.toFixed(3)}\n20\n${t.p1.n.toFixed(3)}\n30\n${t.p1.z.toFixed(3)}\n`;
        // Point 2 (X, Y, Z)
        dxf += `11\n${t.p2.e.toFixed(3)}\n21\n${t.p2.n.toFixed(3)}\n31\n${t.p2.z.toFixed(3)}\n`;
        // Point 3 (X, Y, Z)
        dxf += `12\n${t.p3.e.toFixed(3)}\n22\n${t.p3.n.toFixed(3)}\n32\n${t.p3.z.toFixed(3)}\n`;
        // 3DFACE တွင် Point 4 ပါရမည်ဖြစ်၍ တြိဂံဖြစ်ပါက Point 3 ကိုပဲ ပြန်ထပ်ရေးရပါသည်
        dxf += `13\n${t.p3.e.toFixed(3)}\n23\n${t.p3.n.toFixed(3)}\n33\n${t.p3.z.toFixed(3)}\n`;
    });

    // DXF အဆုံးသတ်ခြင်း
    dxf += "0\nENDSEC\n0\nEOF\n";

    // Download ပြုလုပ်ခြင်း
    let fileName = `3D_TIN_Surface_${new Date().getTime()}.dxf`;
    let mimeType = 'application/dxf';

    if (window.AndroidNative && window.AndroidNative.downloadConvertedCSV) {
        window.AndroidNative.downloadConvertedCSV(dxf, fileName);
    } else {
        let blob = new Blob([dxf], { type: mimeType });
        let url = URL.createObjectURL(blob); 
        let a = document.createElement("a");
        a.href = url; 
        a.download = fileName; 
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);
    }
};

// ==========================================
// 3. GOOGLE EARTH 3D KML EXPORT (CONTOURS & POINTS)
// ==========================================
window.exportTopo3DKML = function() {
    if ((!window.topoContours || window.topoContours.length === 0) && (!window.topoPoints || window.topoPoints.length === 0)) {
        return alert("⚠️ No Topo data to export. Please generate surface first!");
    }

    let datum = document.getElementById('topo_datum') ? document.getElementById('topo_datum').value : "WGS_LL";
    
    // Local Grid အသုံးပြုထားလျှင် သတိပေးမည် (Google Earth တွင် အမှန်ပေါ်မည်မဟုတ်သောကြောင့်)
    if (datum === 'LOCAL') {
        let conf = confirm("⚠️ You are using Local Grid.\nGoogle Earth uses global Lat/Lon (WGS84).\nThe map will likely show up in the ocean (Null Island) or an offset location.\nDo you still want to export?");
        if (!conf) return;
    }

    // 🔴 Local/UTM/SVY21/MM2000 မှ Lat, Lon သို့ ပြောင်းပေးမည့် Helper Function
    let getLatLng = (n, e) => {
        let lat = n, lon = e; 
        if (datum === 'LOCAL') {
            lat = (n - window.localOffsetN) / 100000;
            lon = (e - window.localOffsetE) / 100000;
        }
        else if (datum === "SVY21") { 
            let r = calc_v2_rev(e, n); lat = r.lat; lon = r.lon; 
        }
        else if (datum.startsWith("MM")) {
            let zone = parseInt(datum.slice(-2)); let r = m_inverse(e, n, zone, m_EVE); 
            let x = m_llh2xyz(r.lat, r.lon, 0, m_EVE); let w = m_xyz2llh(x.x-m_DX, x.y-m_DY, x.z-m_DZ, m_WGS);
            lat = w.lat; lon = w.lon;
        }
        else if (datum.startsWith("WGS_UTM")) { 
            let zone = parseInt(datum.slice(-2)); 
            let i = m_inverse(e, n, zone, m_WGS); lat = i.lat; lon = i.lon; 
        }
        else if (datum === "GLOBAL_UTM") {
            let zInput = document.getElementById('topo_custom_zone'); 
            let hInput = document.getElementById('topo_custom_hemi');
            let zone = (zInput && zInput.value) ? parseInt(zInput.value) : 47; 
            let hemi = hInput ? hInput.value : 'N'; 
            let calcN = n; if (hemi === 'S') calcN -= 10000000; 
            let i_w = m_inverse(e, calcN, zone, m_WGS); lat = i_w.lat; lon = i_w.lon;
        }
        return { lat: lat, lon: lon };
    };

    // 🔴 KML Text တည်ဆောက်ခြင်း (KML Colors: AABBGGRR in Hex)
    let kmlString = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>3D Topo Surface (Survey Pro)</name>
    <description>3D Points and Contours exported from Survey Pro</description>
    
    <!-- Styles for Major and Minor Contours -->
    <Style id="majorContour">
      <LineStyle>
        <color>ff0b9ef5</color> <!-- Orange Color -->
        <width>2.5</width>
      </LineStyle>
    </Style>
    <Style id="minorContour">
      <LineStyle>
        <color>ff0953b4</color> <!-- Darker Orange/Brown Color -->
        <width>1.0</width>
      </LineStyle>
    </Style>
    <!-- Style for Points -->
    <Style id="ptStyle">
      <IconStyle>
        <scale>0.6</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
      <LabelStyle><scale>0.7</scale></LabelStyle>
    </Style>

    <Folder>
      <name>Survey Points</name>\n`;

    // 1. Point များကို ထည့်ခြင်း
    if (window.topoPoints && window.topoPoints.length > 0) {
        window.topoPoints.forEach(pt => {
            let ll = getLatLng(pt.n, pt.e);
            if (!isNaN(ll.lat) && !isNaN(ll.lon)) {
                let safeName = pt.p ? pt.p.replace(/&/g, "&amp;").replace(/</g, "&lt;") : "Pt";
                let safeDesc = pt.d ? pt.d.replace(/&/g, "&amp;").replace(/</g, "&lt;") : "";
                kmlString += `      <Placemark>
        <name>${safeName}</name>
        <description>Z: ${pt.z.toFixed(3)}\nCode: ${safeDesc}</description>
        <styleUrl>#ptStyle</styleUrl>
        <Point>
          <!-- absolute ဆိုသည်မှာ Google Earth တွင် မြေကြီးနှင့်မကပ်ဘဲ အမြင့် (Z) အတိုင်းပေါ်စေရန်ဖြစ်သည် -->
          <altitudeMode>clampToGround</altitudeMode>
          <coordinates>${ll.lon},${ll.lat},${pt.z}</coordinates>
        </Point>
      </Placemark>\n`;
            }
        });
    }

    kmlString += `    </Folder>\n    <Folder>\n      <name>3D Contours</name>\n`;

    // 2. Contour မျဉ်းများကို ထည့်ခြင်း
    if (window.topoContours && window.topoContours.length > 0) {
        window.topoContours.forEach(poly => {
            if (poly.points.length < 2) return;
            
            let styleId = poly.isMajor ? "#majorContour" : "#minorContour";
            let coordsStr = "";
            
            poly.points.forEach(pt => {
                let ll = getLatLng(pt.n, pt.e);
                if (!isNaN(ll.lat) && !isNaN(ll.lon)) {
                    coordsStr += `${ll.lon},${ll.lat},${poly.z} `;
                }
            });

            if (coordsStr.trim().length > 0) {
                kmlString += `      <Placemark>
        <name>${poly.z.toFixed(2)} m</name>
        <styleUrl>${styleId}</styleUrl>
        <LineString>
          <altitudeMode>clampToGround</altitudeMode>
          <coordinates>${coordsStr.trim()}</coordinates>
        </LineString>
      </Placemark>\n`;
            }
        });
    }

    kmlString += `    </Folder>\n  </Document>\n</kml>`;

    // 🔴 Download KML File
    let fileName = `3D_Topo_Surface_${new Date().getTime()}.kml`;
    if (window.AndroidNative && window.AndroidNative.downloadConvertedKML) { 
        window.AndroidNative.downloadConvertedKML(kmlString, fileName); 
    }
    else { 
        let blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8;' }); 
        let link = document.createElement("a"); 
        link.href = URL.createObjectURL(blob); 
        link.download = fileName; 
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link); 
    }
};

// ==========================================
// --- EARTHWORK / VOLUME CALCULATOR LOGIC ---
// ==========================================

window.volPoints = [];
window.volTriangles = [];
window.volBoundaryPts = [];
window.volBoundaryLayer = null;
window.isVolDrawing = false;
window.volPolygonObj = null;
window.savedVolAreas = []; // မြေကွက်များ သိမ်းရန် Array အသစ်

// 1. Topo Tool မှ Data ယူခြင်း
window.volLoadFromTopo = function() {
    if (!window.topoTriangles || window.topoTriangles.length === 0) {
        return alert("⚠️ No Topo Surface found! Please generate Topo first in 'Topo Surface & Contour' tool.");
    }
    
    // Topo ထဲက Data တွေကို Volume ဘက်သို့ ကူးယူခြင်း
    window.volPoints = JSON.parse(JSON.stringify(window.topoPoints));
    window.volTriangles = JSON.parse(JSON.stringify(window.topoTriangles));
    
    let statBox = document.getElementById('vol_status');
    statBox.style.display = 'block'; statBox.style.color = '#10b981';
    statBox.innerText = `✅ Successfully loaded surface from Topo Tool. (${window.volPoints.length} points)`;
    
    volShowPointsOnMap();
};

// 3. မြေပုံပေါ်တွင် အမှတ်များ ပြသခြင်း (Coordinate အမှန်ဖြင့်)
function volShowPointsOnMap() {
    if (!window.leafletMap) return;
    
    if (window.topoPointsLayer) window.leafletMap.removeLayer(window.topoPointsLayer);
    window.topoPointsLayer = L.layerGroup().addTo(window.leafletMap);

    // 🚀 OPTIMIZATION: Point ထောင်ချီပါလာရင် မထစ်အောင် Canvas Renderer ဖြင့် တစ်ပေါင်းတည်း ဆွဲမည်
    // 🔴 ပြင်ဆင်ချက်: သီးသန့် Canvas အသစ်မလုပ်ဘဲ ခုနက Topo ဖန်တီးထားတဲ့ မှန်ချပ်ကိုပဲ ယူသုံးမည်
    if (!window.globalSharedCanvas) window.globalSharedCanvas = L.canvas({ padding: 0.5 });
    let sharedCanvasRenderer = window.globalSharedCanvas;

    let bounds = [];
    let datum = document.getElementById('topo_datum') ? document.getElementById('topo_datum').value : "WGS_LL";

    window.volPoints.forEach(pt => {
        let lat = pt.n, lon = pt.e; 

        if (datum === 'LOCAL') {
            lat = (pt.n - (window.localOffsetN || 0)) / 100000;
            lon = (pt.e - (window.localOffsetE || 0)) / 100000;
        }
        else if (datum === "SVY21") { 
            let r = calc_v2_rev(pt.e, pt.n); lat = r.lat; lon = r.lon; 
        }
        else if (datum.startsWith("MM")) {
            let zone = parseInt(datum.slice(-2)); let r = m_inverse(pt.e, pt.n, zone, m_EVE); 
            let x = m_llh2xyz(r.lat, r.lon, 0, m_EVE); let w = m_xyz2llh(x.x-m_DX, x.y-m_DY, x.z-m_DZ, m_WGS);
            lat = w.lat; lon = w.lon;
        }
        else if (datum.startsWith("WGS_UTM")) { 
            let zone = parseInt(datum.slice(-2)); 
            let i = m_inverse(pt.e, pt.n, zone, m_WGS); lat = i.lat; lon = i.lon; 
        }
        else if (datum === "GLOBAL_UTM") {
            let zInput = document.getElementById('topo_custom_zone'); 
            let hInput = document.getElementById('topo_custom_hemi');
            let zone = (zInput && zInput.value) ? parseInt(zInput.value) : 47; 
            let hemi = hInput ? hInput.value : 'N'; 
            let calcN = pt.n; if (hemi === 'S') calcN -= 10000000; 
            let i_w = m_inverse(pt.e, calcN, zone, m_WGS); lat = i_w.lat; lon = i_w.lon;
        }

        if (!isNaN(lat) && !isNaN(lon)) {
            let marker = L.circleMarker([lat, lon], { 
                radius: 4, color: 'transparent', weight: 25, fillColor: '#94a3b8', fillOpacity: 0.8,
                renderer: sharedCanvasRenderer // <-- 🚀 Canvas သုံးရန် ညွှန်ကြားချက်
            });
            
            marker.bindTooltip(`Z: ${pt.z.toFixed(3)}`, { direction: 'top', className: 'pt-tooltip' });
            
            marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                
                let topoTool = document.getElementById('cogo_topo_tool');
                if (topoTool && !topoTool.classList.contains('hidden')) {
                    if (window.isDrawingBoundary) {
                        window.topoBoundaryPolygon.push({ n: pt.n, e: pt.e, lat: lat, lon: lon });
                        if (typeof updateBoundaryDrawUI === 'function') updateBoundaryDrawUI();
                    } else if (window.isDrawingExclude) {
                        window.currentExcludePolygon.push({ n: pt.n, e: pt.e, lat: lat, lon: lon });
                        if (typeof updateBoundaryDrawUI === 'function') updateBoundaryDrawUI();
                    }
                }
                
                let volTool = document.getElementById('cogo_vol_tool');
                if (volTool && !volTool.classList.contains('hidden')) {
                    if (window.isVolDrawing) {
                        window.volBoundaryPts.push({ lat: lat, lon: lon, n: pt.n, e: pt.e, groundZ: pt.z });
                        if (typeof window.volUpdateBoundaryUI === 'function') window.volUpdateBoundaryUI();
                    }
                }
            });

            window.topoPointsLayer.addLayer(marker);
            bounds.push([lat, lon]);
        }
    });

    if (bounds.length > 0) window.leafletMap.fitBounds(L.latLngBounds(bounds), {padding: [30, 30], maxZoom: 22});
    
    if (typeof toggleTopoLayers === 'function') toggleTopoLayers();
}
// ==========================================
// 4. BOUNDARY DRAWING & TARGET LEVEL UI
// ==========================================

// မြေလွတ်ကိုထောက်လျှင် Topo တြိဂံများမှ Z တန်ဖိုးကို အတိအကျ တွက်ယူမည့် သင်္ချာ (Optimized)
function getZFromTIN(n, e, triangles) {
    for (let i = 0; i < triangles.length; i++) {
        let t = triangles[i];
        
        // 🚀 OPTIMIZATION: Bounding Box ကို ယာယီသိမ်းထားပြီး စစ်ဆေးခြင်း (အဆ ၁၀၀ ပိုမြန်သွားပါမည်)
        if (t.minN === undefined) {
            t.minN = Math.min(t.p1.n, t.p2.n, t.p3.n);
            t.maxN = Math.max(t.p1.n, t.p2.n, t.p3.n);
            t.minE = Math.min(t.p1.e, t.p2.e, t.p3.e);
            t.maxE = Math.max(t.p1.e, t.p2.e, t.p3.e);
        }

        // Mouse ထောက်လိုက်တဲ့ နေရာက ဒီတြိဂံရဲ့ အကျယ်အဝန်း (Box) ထဲမှာ မရှိရင် အချိန်ကုန်ခံမတွက်တော့ဘဲ ကျော်ပစ်မည်
        if (n < t.minN || n > t.maxN || e < t.minE || e > t.maxE) continue;

        let det = (t.p2.n - t.p3.n) * (t.p1.e - t.p3.e) + (t.p3.e - t.p2.e) * (t.p1.n - t.p3.n);
        let l1 = ((t.p2.n - t.p3.n) * (e - t.p3.e) + (t.p3.e - t.p2.e) * (n - t.p3.n)) / det;
        let l2 = ((t.p3.n - t.p1.n) * (e - t.p3.e) + (t.p1.e - t.p3.e) * (n - t.p3.n)) / det;
        let l3 = 1.0 - l1 - l2;
        if (l1 >= -0.01 && l2 >= -0.01 && l3 >= -0.01) {
            return (l1 * t.p1.z) + (l2 * t.p2.z) + (l3 * t.p3.z);
        }
    }
    return null; 
}

// --- 🔴 ယာယီအမှတ် (Draft Point) အတွက် Variable များ ---
window.volDraftPoint = null;
window.volDraftMarker = null;
window.volDraftLine = null;
window.volDraftLabel = null;
window.volGhostLine = null;
window.volGhostLabel = null;

// Map Click Event (မြေလွတ်ကို ထောက်လျှင် ယာယီအမှတ်ချမည်)
window.volMapClickListener = function(e) {
    if (!window.isVolDrawing) return;
    
    let coords = window.getDatumCoordsForLatLon(e.latlng.lat, e.latlng.lng); 
    if (!coords.showLocal) return;

    let z = getZFromTIN(coords.localN, coords.localE, window.volTriangles);
    if (z === null) return alert("⚠️ Please tap INSIDE the generated Topo Surface area.");

    // ယာယီအမှတ်အဖြစ် သတ်မှတ်သည် (အတည်မပြုသေးပါ)
    window.volDraftPoint = { lat: e.latlng.lat, lon: e.latlng.lng, n: coords.localN, e: coords.localE, groundZ: z };
    window.volUpdateBoundaryUI();
};

// PC သမားများအတွက် Mouse ရွေ့နေစဉ် Ghost Line ပြပေးမည်
window.volMouseMoveListener = function(e) {
    if (!window.isVolDrawing || window.volBoundaryPts.length === 0) return;
    
    // ယာယီအမှတ် ချထားပြီးသားဆိုရင် (သို့) လက်နဲ့ဖိဆွဲနေရင် Ghost line မပြတော့ပါ
    if (window.volDraftPoint) {
        if (window.volGhostLine) window.leafletMap.removeLayer(window.volGhostLine);
        if (window.volGhostLabel) window.leafletMap.removeLayer(window.volGhostLabel);
        return;
    }
    if (window.volDraftMarker && window.volDraftMarker.dragging && window.volDraftMarker.dragging._draggable && window.volDraftMarker.dragging._draggable._moving) return;

    let lastPt = window.volBoundaryPts[window.volBoundaryPts.length - 1];
    let dist = calcDistance(lastPt.lat, lastPt.lon, e.latlng.lat, e.latlng.lng);
    let midLat = (lastPt.lat + e.latlng.lat) / 2;
    let midLon = (lastPt.lon + e.latlng.lng) / 2;

    if (!window.volGhostLine) {
        window.volGhostLine = L.polyline([[lastPt.lat, lastPt.lon], [e.latlng.lat, e.latlng.lng]], {
            color: '#94a3b8', weight: 2, dashArray: '4, 4', interactive: false
        }).addTo(window.leafletMap);
        
        window.volGhostLabel = L.popup({
            closeButton: false, autoClose: false, closeOnClick: false, autoPan: false
        }).setLatLng([midLat, midLon]).setContent(`<span style="color:#64748b;">${dist.toFixed(2)} m</span>`).addTo(window.leafletMap);
    } else {
        window.volGhostLine.setLatLngs([[lastPt.lat, lastPt.lon], [e.latlng.lat, e.latlng.lng]]);
        window.volGhostLabel.setLatLng([midLat, midLon]).setContent(`<span style="color:#64748b;">${dist.toFixed(2)} m</span>`);
        if (!window.leafletMap.hasLayer(window.volGhostLine)) window.volGhostLine.addTo(window.leafletMap);
        if (!window.leafletMap.hasLayer(window.volGhostLabel)) window.volGhostLabel.addTo(window.leafletMap);
    }
};

window.toggleVolDrawMode = function() {
    if (!window.volPoints || window.volPoints.length === 0) return alert("Please load Data Source first!");

    window.isVolDrawing = !window.isVolDrawing;
    let btn = document.getElementById('btn_vol_draw');
    let undoBtn = document.getElementById('volUndoBtn'); // Undo ခလုတ်ကို လှမ်းယူမည်
    
    if (window.isVolDrawing) {
        btn.innerText = "🛑 Finish Boundary";
        btn.style.background = "#ef4444";
        if (undoBtn) undoBtn.style.display = "flex"; // 🔴 Draw Mode စတာနဲ့ Undo ခလုတ်ကို ဖော်ပေးမည်
        
        if (window.leafletMap) {
            window.leafletMap.on('click', window.volMapClickListener);
            window.leafletMap.on('mousemove', window.volMouseMoveListener);
        }
        alert("1. Tap map to place a draft point.\n2. Click '➕ Add' to confirm.\n3. Use '↩️' on the map to Undo.");
    } else {
        btn.innerText = "✏️ Draw Boundary";
        btn.style.background = "#f59e0b";
        if (undoBtn) undoBtn.style.display = "none"; // 🔴 Draw Mode ပိတ်ရင် Undo ခလုတ် ပြန်ဖျောက်မည်
        
        if (window.leafletMap) {
            window.leafletMap.off('click', window.volMapClickListener);
            window.leafletMap.off('mousemove', window.volMouseMoveListener);
        }
        window.volDraftPoint = null;
        if (window.volGhostLine) window.leafletMap.removeLayer(window.volGhostLine);
        if (window.volGhostLabel) window.leafletMap.removeLayer(window.volGhostLabel);
        
        window.volUpdateBoundaryUI(true); 
    }
};

// 🔴 "➕ Add" ကိုနှိပ်မှ အတည်ပြုပြီး Boundary ထဲ ထည့်မည့် Function
window.confirmVolDraftPoint = function() {
    if (!window.volDraftPoint) return;
    window.volBoundaryPts.push(window.volDraftPoint);
    window.volDraftPoint = null; // ယာယီအမှတ် ရှင်းမည်
    if (window.leafletMap) window.leafletMap.closePopup(); // Popup ကို ပိတ်မည်
    window.volUpdateBoundaryUI();
};

window.volUpdateBoundaryUI = function(isClosed = false) {
    if (!window.leafletMap) return;
    
    if (window.volBoundaryLayer) window.leafletMap.removeLayer(window.volBoundaryLayer);

    if (window.volBoundaryPts.length > 0) {
        let layers = [];
        let latlngs = window.volBoundaryPts.map(pt => [pt.lat, pt.lon]);
        if (isClosed && latlngs.length > 2) latlngs.push(latlngs[0]); 
        
        layers.push(L.polygon(latlngs, { color: '#ef4444', weight: 3, fillColor: '#ef4444', fillOpacity: 0.2, dashArray: '5, 5' }));

        window.volBoundaryPts.forEach((pt, index) => {
            let ptMarker = L.marker([pt.lat, pt.lon], {
                icon: L.divIcon({ className: 'bdy-point-marker', html: `<div style="width:12px; height:12px; background:#fff; border:3px solid #ef4444; border-radius:50%; box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] }),
                interactive: true 
            });

            ptMarker.bindTooltip(
                `<div style="line-height: 1.1; text-align:center;">
                    <b style="font-size:11px; color:#ef4444; display:block;">BDY ${index + 1}</b>
                    <span style="font-size:10px; color:#0f172a; font-weight:bold;">Z: ${pt.groundZ.toFixed(3)}</span>
                 </div>`, { permanent: true, direction: 'top', className: 'pt-tooltip', offset: [0, -6] }
            );
            layers.push(ptMarker);
        });
        window.volBoundaryLayer = L.layerGroup(layers).addTo(window.leafletMap);
    }
    
    if (window.isVolDrawing && window.volDraftPoint) {
        let dPt = window.volDraftPoint;

        // 🔴 ဖုန်းအတွက် အလွန်သေးငယ်ကျစ်လျစ်သော Popup Design (Add ခလုတ် တစ်ခုတည်းသာ ပါဝင်သည်)
        let compactPopupHTML = `<div style="text-align:center; padding: 2px;">
            <div style="font-weight:bold; font-size:11px; color:#d97706; margin-bottom:2px;">📍 Draft Point</div>
            <b style="font-size:12px; color:#b91c1c; display:block; line-height:1.2; margin-bottom:5px;">N: ${dPt.n.toFixed(3)}<br>E: ${dPt.e.toFixed(3)}<br>Z: ${dPt.groundZ.toFixed(3)}</b>
            <button class="so-popup-btn" style="background:#10b981; padding: 6px 15px; font-size: 11px; margin-top: 0; font-weight:bold; border-radius:4px; width:100%;" onclick="confirmVolDraftPoint()">➕ Add</button>
        </div>`;

        if (!window.volDraftMarker) {
            window.volDraftMarker = L.marker([dPt.lat, dPt.lon], {
                draggable: true,
                icon: L.divIcon({ className: 'draft-marker', html: `<div style="background:#eab308; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 5px rgba(0,0,0,0.8);"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })
            }).bindPopup(compactPopupHTML, { closeOnClick: false, autoClose: false }).addTo(window.leafletMap);

            setTimeout(() => { window.volDraftMarker.openPopup(); }, 50);
            window.volDraftMarker.on('dragstart', function() { window.volDraftMarker.closePopup(); });
            window.volDraftMarker.on('drag', function(e) {
                let ll = e.latlng;
                if (window.volBoundaryPts.length > 0) {
                    let lastPt = window.volBoundaryPts[window.volBoundaryPts.length - 1];
                    let dist = calcDistance(lastPt.lat, lastPt.lon, ll.lat, ll.lng);
                    if (window.volDraftLine) window.volDraftLine.setLatLngs([[lastPt.lat, lastPt.lon], [ll.lat, ll.lng]]);
                    if (window.volDraftLabel) window.volDraftLabel.setLatLng([(lastPt.lat + ll.lat)/2, (lastPt.lon + ll.lng)/2]).setContent(`<b style="color:#b91c1c; font-size:14px;">${dist.toFixed(2)} m</b>`);
                }
            });
            window.volDraftMarker.on('dragend', function(e) {
                let ll = e.target.getLatLng();
                let coords = window.getDatumCoordsForLatLon(ll.lat, ll.lng);
                let z = getZFromTIN(coords.localN, coords.localE, window.volTriangles);
                if (z === null) {
                    alert("⚠️ Outside TIN surface! Moved back to previous valid location.");
                    window.volUpdateBoundaryUI(); 
                } else {
                    window.volDraftPoint = { lat: ll.lat, lon: ll.lng, n: coords.localN, e: coords.localE, groundZ: z };
                    window.volUpdateBoundaryUI(); 
                }
            });
        } else {
            window.volDraftMarker.setLatLng([dPt.lat, dPt.lon]);
            window.volDraftMarker.setPopupContent(compactPopupHTML); 
            if (!window.leafletMap.hasLayer(window.volDraftMarker)) window.volDraftMarker.addTo(window.leafletMap);
            setTimeout(() => { window.volDraftMarker.openPopup(); }, 50);
        }

        if (window.volBoundaryPts.length > 0) {
            let lastPt = window.volBoundaryPts[window.volBoundaryPts.length - 1];
            let dist = calcDistance(lastPt.lat, lastPt.lon, dPt.lat, dPt.lon);
            let midLat = (lastPt.lat + dPt.lat) / 2, midLon = (lastPt.lon + dPt.lon) / 2;

            if (!window.volDraftLine) window.volDraftLine = L.polyline([[lastPt.lat, lastPt.lon], [dPt.lat, dPt.lon]], { color: '#eab308', weight: 3, dashArray: '5, 5' }).addTo(window.leafletMap);
            else { window.volDraftLine.setLatLngs([[lastPt.lat, lastPt.lon], [dPt.lat, dPt.lon]]); if (!window.leafletMap.hasLayer(window.volDraftLine)) window.volDraftLine.addTo(window.leafletMap); }

            if (!window.volDraftLabel) window.volDraftLabel = L.popup({ closeButton: false, autoClose: false, closeOnClick: false, autoPan: false }).setLatLng([midLat, midLon]).setContent(`<b style="color:#b91c1c; font-size:14px;">${dist.toFixed(2)} m</b>`).addTo(window.leafletMap);
            else { window.volDraftLabel.setLatLng([midLat, midLon]).setContent(`<b style="color:#b91c1c; font-size:14px;">${dist.toFixed(2)} m</b>`); if (!window.leafletMap.hasLayer(window.volDraftLabel)) window.volDraftLabel.addTo(window.leafletMap); }
        }

    } else {
        if (window.volDraftMarker) window.leafletMap.removeLayer(window.volDraftMarker);
        if (window.volDraftLine) window.leafletMap.removeLayer(window.volDraftLine);
        if (window.volDraftLabel) window.leafletMap.removeLayer(window.volDraftLabel);
    }
    
    window.renderVolTargetInputs();

    if(window.volBoundaryPts.length >= 3) document.getElementById('vol_multi_area_box').classList.remove('hidden');
    else document.getElementById('vol_multi_area_box').classList.add('hidden');
};

window.undoVolBoundary = function() {
    if (window.volDraftPoint) {
        window.volDraftPoint = null;
        window.volUpdateBoundaryUI();
    } else if (window.volBoundaryPts.length > 0) {
        window.volBoundaryPts.pop();
        window.volUpdateBoundaryUI();
    }
};

window.clearVolBoundary = function(skipSavedClear = false) {
    window.volBoundaryPts = [];
    window.volDraftPoint = null;
    if (window.volBoundaryLayer) window.leafletMap.removeLayer(window.volBoundaryLayer);
    if (window.volDraftMarker) window.leafletMap.removeLayer(window.volDraftMarker);
    if (window.volDraftLine) window.leafletMap.removeLayer(window.volDraftLine);
    if (window.volDraftLabel) window.leafletMap.removeLayer(window.volDraftLabel);
    window.volBoundaryLayer = null;
    
    // UI Panels တွေကို ပြန်ဖျောက်မည်
    document.getElementById('vol_target_panel').classList.add('hidden');
    let settingsPanel = document.getElementById('vol_settings_panel');
    if (settingsPanel) settingsPanel.classList.add('hidden');
    document.getElementById('vol_multi_area_box').classList.add('hidden');
    document.getElementById('vol_result_box').classList.add('hidden');
    
    // Method ကို Flat (Default) သို့ ပြန်ထားပေးမည်
    let baseTypeSelect = document.getElementById('vol_base_type');
    if (baseTypeSelect) baseTypeSelect.value = 'flat';
    
    if (!skipSavedClear) {
        window.savedVolAreas = [];
        updateSavedVolAreasUI();
        if (window.isVolDrawing) window.toggleVolDrawMode();
    }
};

window.volSurface2Points = [];
window.volSurface2Triangles = [];

window.renderVolTargetInputs = function() {
    let panel = document.getElementById('vol_target_panel');
    let container = document.getElementById('vol_target_inputs');
    let baseType = document.getElementById('vol_base_type').value;

    if (window.volBoundaryPts.length < 3) { panel.classList.add('hidden'); return; }

    panel.classList.remove('hidden');
    let settingsPanel = document.getElementById('vol_settings_panel');
    if (settingsPanel) settingsPanel.classList.remove('hidden');
    
    container.innerHTML = ''; 

    if (baseType === 'flat') {
        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; background:#fff; padding:8px; border-radius:6px; border:1px solid #bae6fd;">
                <label style="font-size:12px; font-weight:bold; color:#0369a1; flex:1;">Flat Base Level (Z):</label>
                <input type="number" id="vol_flat_z" class="v2-input" placeholder="e.g. 50.0" style="flex:1; margin:0;">
            </div>`;
    } 
    else if (baseType === 'variable') {
        let html = '<div style="font-size:11px; color:#0284c7; margin-bottom:5px;">Enter desired Target Level for each corner:</div>';
        window.volBoundaryPts.forEach((pt, index) => {
            html += `
            <div style="display:flex; align-items:center; gap:5px; background:#fff; padding:5px 8px; border-radius:6px; border:1px solid #bae6fd; margin-bottom:5px;">
                <div style="flex:1;">
                    <span style="font-size:12px; font-weight:bold; color:#0369a1;">BDY ${index + 1}</span><br>
                    <span style="font-size:10px; color:#64748b;">Ground: ${pt.groundZ.toFixed(3)}m</span>
                </div>
                <input type="number" id="vol_var_z_${index}" class="v2-input" placeholder="Target Z" style="flex:1.5; margin:0;">
            </div>`;
        });
        container.innerHTML = html;
    }
    else if (baseType === 'surface2') {
        // Surface 2 ကို အပေါ်မှာကတည်းက တင်ထားပြီးဖြစ်/မဖြစ် စစ်ဆေးမည်
        let isLoaded = (window.volSurface2Triangles && window.volSurface2Triangles.length > 0);
        let statusColor = isLoaded ? '#059669' : '#dc2626';
        let statusMsg = isLoaded ? '✅ Surface 2 is ready.' : '⚠️ No Surface 2 detected! Please Load Surface 2 at Step 1.';
        
        container.innerHTML = `
            <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #bae6fd; text-align:center;">
                <div style="font-size:13px; font-weight:bold; color:${statusColor};">${statusMsg}</div>
                <div style="font-size:11px; color:#64748b; margin-top:5px;">App will calculate volume between Surface 1 and Surface 2.</div>
            </div>`;
    }
};

// 🔴 Surface 2 အတွက် CSV ဖတ်မည့် Function
window.loadVolSurface2CSV = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    let statBox = document.getElementById('vol_surf2_status');
    statBox.style.color = '#d97706';
    statBox.innerText = `⏳ Loading Surface 2...`;

    let formatSel = document.getElementById('topo_csv_format');
    let isPENZD = (formatSel && formatSel.value === 'PENZD');

    const reader = new FileReader();
    reader.onload = function(e) {
        window.volSurface2Points = [];
        let lines = e.target.result.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line || line.toUpperCase().includes("POINT") || line.toUpperCase().includes("NAME") || line.toUpperCase().includes("EAST")) continue;
            
            let cols = line.split(',');
            if (cols.length < 4) continue;

            let n, e_val, z;
            if (isPENZD) {
                e_val = parseFloat(cols[1]); n = parseFloat(cols[2]);
            } else {
                n = parseFloat(cols[1]); e_val = parseFloat(cols[2]);
            }
            z = parseFloat(cols[3]);

            if (!isNaN(n) && !isNaN(e_val) && !isNaN(z)) {
                window.volSurface2Points.push({ n: n, e: e_val, z: z });
            }
        }

        if (window.volSurface2Points.length < 3) {
            statBox.style.color = '#ef4444'; statBox.innerText = `❌ Error: Need at least 3 points!`;
            return;
        }

        // ဒုတိယ Surface ကို TIN အဖြစ် ချက်ချင်း ပြောင်းထားမည်
        window.volSurface2Triangles = generateDelaunayTriangulation(window.volSurface2Points);
        
        statBox.style.color = '#10b981';
        statBox.innerText = `✅ Surface 2 Ready! (${window.volSurface2Points.length} Pts)`;

        // 🔴 အသစ်ပြင်ဆင်ချက်: Surface 2 ကို မြေပုံပေါ် တင်ခိုင်းမည်
        if (typeof volShowSurface2OnMap === 'function') {
            volShowSurface2OnMap();
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

// 🔴 အသစ်ထည့်ထားသော Surface 2 Point များကို မြေပုံပေါ်ပြသခြင်း
window.volSurface2Layer = null;

window.volShowSurface2OnMap = function() {
    if (!window.leafletMap || !window.volSurface2Points || window.volSurface2Points.length === 0) return;
    
    // Layer အဟောင်းရှိရင် ရှင်းမည်
    if (window.volSurface2Layer) {
        window.leafletMap.removeLayer(window.volSurface2Layer);
    }
    window.volSurface2Layer = L.layerGroup().addTo(window.leafletMap);

    // 🔴 ပြင်ဆင်ချက်: သီးသန့် Canvas အသစ်မလုပ်ဘဲ ခုနက Topo ဖန်တီးထားတဲ့ မှန်ချပ်ကိုပဲ ယူသုံးမည်
    if (!window.globalSharedCanvas) window.globalSharedCanvas = L.canvas({ padding: 0.5 });
    let sharedCanvasRenderer = window.globalSharedCanvas;
    let bounds = [];
    let datum = document.getElementById('topo_datum') ? document.getElementById('topo_datum').value : "WGS_LL";

    window.volSurface2Points.forEach(pt => {
        let lat = pt.n, lon = pt.e; 

        // Coordinate ပြောင်းသည့် အပိုင်း
        if (datum === 'LOCAL') {
            lat = (pt.n - (window.localOffsetN || 0)) / 100000;
            lon = (pt.e - (window.localOffsetE || 0)) / 100000;
        }
        else if (datum === "SVY21") { 
            let r = calc_v2_rev(pt.e, pt.n); lat = r.lat; lon = r.lon; 
        }
        else if (datum.startsWith("MM")) {
            let zone = parseInt(datum.slice(-2)); let r = m_inverse(pt.e, pt.n, zone, m_EVE); 
            let x = m_llh2xyz(r.lat, r.lon, 0, m_EVE); let w = m_xyz2llh(x.x-m_DX, x.y-m_DY, x.z-m_DZ, m_WGS);
            lat = w.lat; lon = w.lon;
        }
        else if (datum.startsWith("WGS_UTM")) { 
            let zone = parseInt(datum.slice(-2)); 
            let i = m_inverse(pt.e, pt.n, zone, m_WGS); lat = i.lat; lon = i.lon; 
        }
        else if (datum === "GLOBAL_UTM") {
            let zInput = document.getElementById('topo_custom_zone'); 
            let hInput = document.getElementById('topo_custom_hemi');
            let zone = (zInput && zInput.value) ? parseInt(zInput.value) : 47; 
            let hemi = hInput ? hInput.value : 'N'; 
            let calcN = pt.n; if (hemi === 'S') calcN -= 10000000; 
            let i_w = m_inverse(pt.e, calcN, zone, m_WGS); lat = i_w.lat; lon = i_w.lon;
        }

        if (!isNaN(lat) && !isNaN(lon)) {
            // လိမ္မော်ရောင် (Orange) ဖြင့် ပြမည်
            let marker = L.circleMarker([lat, lon], { 
                radius: 4, color: '#ea580c', weight: 2, fillColor: '#f97316', fillOpacity: 0.8,
                renderer: sharedCanvasRenderer 
            });
            
            marker.bindTooltip(`<b>S2</b> Z: ${pt.z.toFixed(3)}`, { direction: 'top', className: 'pt-tooltip', offset: [0, -5] });
            
            // ထောက်လိုက်ရင် Volume Boundary ထဲ အလိုလို ဝင်သွားအောင် ချိတ်ဆက်ထားသည်
            marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                let volTool = document.getElementById('cogo_vol_tool');
                if (volTool && !volTool.classList.contains('hidden')) {
                    if (window.isVolDrawing) {
                        window.volBoundaryPts.push({ lat: lat, lon: lon, n: pt.n, e: pt.e, groundZ: pt.z });
                        if (typeof window.volUpdateBoundaryUI === 'function') window.volUpdateBoundaryUI();
                    }
                }
            });

            window.volSurface2Layer.addLayer(marker);
            bounds.push([lat, lon]);
        }
    });

    if (bounds.length > 0) window.leafletMap.fitBounds(L.latLngBounds(bounds), {padding: [30, 30], maxZoom: 22});
};

window.saveCurrentVolArea = function() {
    if (window.volBoundaryPts.length < 3) return alert("⚠️ Please draw at least 3 points.");
    let baseType = document.getElementById('vol_base_type').value;
    let targetLevels = [];

    if (baseType === 'flat') {
        let flatZ = parseFloat(document.getElementById('vol_flat_z').value);
        if (isNaN(flatZ)) return alert("⚠️ Please enter a Flat Base Level.");
        targetLevels.push({ z: flatZ });
    } 
    else if (baseType === 'variable') {
        for (let i = 0; i < window.volBoundaryPts.length; i++) {
            let varZ = parseFloat(document.getElementById(`vol_var_z_${i}`).value);
            if (isNaN(varZ)) return alert(`⚠️ Please enter Target Level for BDY ${i+1}.`);
            targetLevels.push({ n: window.volBoundaryPts[i].n, e: window.volBoundaryPts[i].e, z: varZ });
        }
    } 
    else if (baseType === 'surface2') {
        if (!window.volSurface2Triangles || window.volSurface2Triangles.length === 0) {
            return alert("⚠️ Please upload Surface 2 CSV first!");
        }
        targetLevels = window.volSurface2Triangles; 
    }

    // 🔴 ဖြည့်စွက်ချက်: Save နှိပ်တဲ့အချိန်မှာ ရှိနေတဲ့ Grid တွေကိုပါ Area ထဲ သီးသန့်မှတ်ထားမည်
    let gInp = parseFloat(document.getElementById('vol_grid_size').value) || 0.5;
    let swInp = parseFloat(document.getElementById('vol_swell').value) || 0;
    let shInp = parseFloat(document.getElementById('vol_shrink').value) || 0;

    window.savedVolAreas.push({ 
        boundary: [...window.volBoundaryPts], baseType: baseType, targetLevels: targetLevels,
        gridSize: gInp, swellPct: swInp, shrinkPct: shInp 
    });
    
    window.clearVolBoundary(true); 
    updateSavedVolAreasUI();
};

function updateSavedVolAreasUI() {
    let container = document.getElementById('saved_vol_areas_list');
    if (!container) return;
    container.innerHTML = '';
    
    window.savedVolAreas.forEach((area, index) => {
        let html = `
        <div style="background:#f0f9ff; border:1px solid #7dd3fc; border-radius:6px; margin-bottom:5px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px;">
                <div style="font-size:12px; color:#0369a1; font-weight:bold;">📍 Saved Vol BDY ${index + 1} <span style="font-size:10px; color:#64748b;">(${area.boundary.length} pts)</span></div>
                <div style="display:flex; gap:5px;">
                    <!-- 🔴 တစ်ကွက်ချင်းစီ တွက်ရန် Calc ခလုတ် -->
                    <button class="top-btn" style="background:#10b981; color:white; padding:4px 8px; font-size:11px;" onclick="calcIndividualVolume(${index})">📊 Calc</button>
                    <button class="top-btn" style="background:#ef4444; color:white; padding:4px 8px; font-size:11px;" onclick="deleteSavedVolArea(${index})">🗑️ Drop</button>
                </div>
            </div>
            <!-- 🔴 အဖြေပြမည့် Accordion Box (စစချင်း ဖျောက်ထားမည်) -->
            <div id="indiv_vol_res_${index}" style="display:none; border-top:1px dashed #7dd3fc; padding:8px; background:#fff; border-bottom-left-radius:6px; border-bottom-right-radius:6px;">
            </div>
        </div>`;
        container.innerHTML += html;
    });
    
    if (typeof window.drawSavedVolBdys === 'function') window.drawSavedVolBdys();
}

// 🔴 တစ်ကွက်ချင်းစီ သီးသန့်တွက်ထုတ်ပေးမည့် Function (Web Worker သုံးထားသည်)
window.calcIndividualVolume = function(index) {
    let area = window.savedVolAreas[index];
    if (!area) return;

    let resDiv = document.getElementById(`indiv_vol_res_${index}`);
    if (resDiv.style.display === 'block' && resDiv.innerHTML.includes('Net:')) { resDiv.style.display = 'none'; return; }

    resDiv.style.display = 'block';
    resDiv.innerHTML = `<div style="text-align:center; font-size:11px; color:#d97706;">⏳ Calculating BDY ${index + 1}... <span id="indiv_prog_${index}" style="font-weight:bold; color:#1e40af;">0%</span></div>`;

    // 🔴 ဖြည့်စွက်ချက်: Area ထဲမှာ သီးသန့် မှတ်ထားတဲ့ Grid Size, Swell, Shrink ကို ပို့ပေးမည်
    runVolumeWorker(window.volTriangles, area.boundary, area.targetLevels, area.baseType, area.gridSize, area.swellPct, area.shrinkPct,
        function(pct) {
            let progSpan = document.getElementById(`indiv_prog_${index}`);
            if(progSpan) progSpan.innerText = pct + '%';
        },
        function(res) {
            let netVol = res.cutVol - res.fillVol;
            resDiv.innerHTML = `
                <div style="font-size:10px; color:#64748b; margin-bottom:5px; text-align:center;">
                    Grid: ${res.gridSize}m | Swell: ${res.swellPct}% | Shrink: ${res.shrinkPct}%
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:11px; text-align:center;">
                    <div style="background:#f1f5f9; padding:4px; border-radius:4px; color:#475569;"><b>Area:</b><br>${res.totalArea.toFixed(2)} m²</div>
                    <div style="background:#fef2f2; padding:4px; border-radius:4px; color:#ef4444;"><b>Cut (Adj):</b><br>${res.cutVol.toFixed(3)} m³</div>
                    <div style="background:#ecfdf5; padding:4px; border-radius:4px; color:#059669;"><b>Fill (Adj):</b><br>${res.fillVol.toFixed(3)} m³</div>
                    <div style="background:${netVol >= 0 ? '#fef2f2' : '#ecfdf5'}; padding:4px; border-radius:4px; color:${netVol >= 0 ? '#ef4444' : '#059669'}; font-weight:bold; font-size:12px;"><b>Net:</b><br>${Math.abs(netVol).toFixed(3)} m³ ${netVol >= 0 ? '(Cut)' : '(Fill)'}</div>
                </div>
            `;
        }
    );
};

window.deleteSavedVolArea = function(index) {
    window.savedVolAreas.splice(index, 1);
    updateSavedVolAreasUI();
};

// 🔴 Saved Boundaries များကို သီးသန့် Layer ဖြင့် မြေပုံပေါ်ဆွဲတင်ရန်
window.savedVolBdyLayer = null;

window.drawSavedVolBdys = function() {
    if (!window.leafletMap) return;
    
    if (window.savedVolBdyLayer) {
        window.leafletMap.removeLayer(window.savedVolBdyLayer);
        window.savedVolBdyLayer = null;
    }
    
    let layers = [];
    window.savedVolAreas.forEach((area, index) => {
        let sLatLngs = area.boundary.map(pt => [pt.lat, pt.lon]);
        sLatLngs.push(sLatLngs[0]); 
        layers.push(L.polygon(sLatLngs, { color: '#0ea5e9', weight: 2, fillColor: '#0ea5e9', fillOpacity: 0.15, dashArray: '4, 4' }));
        
        let centerLat = sLatLngs.reduce((sum, pt) => sum + pt[0], 0) / sLatLngs.length;
        let centerLon = sLatLngs.reduce((sum, pt) => sum + pt[1], 0) / sLatLngs.length;
        layers.push(L.marker([centerLat, centerLon], {
            icon: L.divIcon({ className: '', html: `<b style="color:#0369a1; font-size:12px; font-weight:bold; text-shadow: 1px 1px 2px white, -1px -1px 2px white;">Vol BDY ${index + 1}</b>`, iconSize: [80, 15] }), interactive: false
        }));
    });
    
    window.savedVolBdyLayer = L.layerGroup(layers);
    window.toggleVolBdyLayer(); // လက်ရှိ Tab အခြေအနေနဲ့ Checkbox အခြေအနေကို စစ်ပြီးမှ မြေပုံပေါ်တင်မည်
};

// 🔴 Layer ကို On/Off လုပ်ပေးမည့် Function 
window.toggleVolBdyLayer = function() {
    if (!window.leafletMap || !window.savedVolBdyLayer) return;
    
    let chk = document.getElementById('tgl_vol_bdys');
    let volTool = document.getElementById('cogo_vol_tool');
    let isVolActive = (window.activeApp === 4) && volTool && !volTool.classList.contains('hidden');
    
    // Checkbox အမှန်ခြစ်ထားပြီး Volume Tool ထဲ ရောက်နေမှသာ မြေပုံပေါ်ပြမည်
    if (chk && chk.checked && isVolActive) {
        if (!window.leafletMap.hasLayer(window.savedVolBdyLayer)) {
            window.leafletMap.addLayer(window.savedVolBdyLayer);
        }
    } else {
        if (window.leafletMap.hasLayer(window.savedVolBdyLayer)) {
            window.leafletMap.removeLayer(window.savedVolBdyLayer);
        }
    }
};

// 🔴 Tab ပြောင်းသည့်အခါ အလိုအလျောက် ပိတ်သွားစေရန် Hook ချိတ်ခြင်း
let _oldOpenCogoToolVol = window.openCogoTool;
window.openCogoTool = function(toolName) {
    if(typeof _oldOpenCogoToolVol === 'function') _oldOpenCogoToolVol(toolName);
    setTimeout(window.toggleVolBdyLayer, 100);
};

let _oldCloseCogoToolVol = window.closeCogoTool;
window.closeCogoTool = function() {
    if(typeof _oldCloseCogoToolVol === 'function') _oldCloseCogoToolVol();
    setTimeout(window.toggleVolBdyLayer, 100);
};

let _oldSwitchAppVol = window.switchApp;
window.switchApp = function(n) {
    if(typeof _oldSwitchAppVol === 'function') _oldSwitchAppVol(n);
    setTimeout(window.toggleVolBdyLayer, 100);
};


// ==========================================
// --- VOLUME CALCULATION (WEB WORKER + OPTIMIZED) ---
// ==========================================

// 1. Worker အတွက် Code များကို String အဖြစ် သတ်မှတ်ခြင်း
const volumeWorkerScript = `
    function isPointInVolumeBoundary(n, e, boundaryPts) {
        let isInside = false;
        for (let i = 0, j = boundaryPts.length - 1; i < boundaryPts.length; j = i++) {
            let pi = boundaryPts[i]; let pj = boundaryPts[j];
            if (((pi.n > n) !== (pj.n > n)) && (e < (pj.e - pi.e) * (n - pi.n) / (pj.n - pi.n) + pi.e)) {
                isInside = !isInside;
            }
        }
        return isInside;
    }

    function getZFromTIN(n, e, triangles) {
        for (let i=0; i<triangles.length; i++) {
            let t = triangles[i];
            // 🚀 OPTIMIZATION: Bounding Box Check (အဝေးက တြိဂံတွေကို ကျော်ပစ်မည်)
            if (n < t.minN || n > t.maxN || e < t.minE || e > t.maxE) continue;

            let det = (t.p2.n - t.p3.n) * (t.p1.e - t.p3.e) + (t.p3.e - t.p2.e) * (t.p1.n - t.p3.n);
            let l1 = ((t.p2.n - t.p3.n) * (e - t.p3.e) + (t.p3.e - t.p2.e) * (n - t.p3.n)) / det;
            let l2 = ((t.p3.n - t.p1.n) * (e - t.p3.e) + (t.p1.e - t.p3.e) * (n - t.p3.n)) / det;
            let l3 = 1.0 - l1 - l2;
            if (l1 >= -0.01 && l2 >= -0.01 && l3 >= -0.01) {
                return (l1 * t.p1.z) + (l2 * t.p2.z) + (l3 * t.p3.z);
            }
        }
        return null;
    }

    self.onmessage = function(e) {
        const data = e.data;
        let gridSize = data.gridSize;
        let gridArea = gridSize * gridSize;
        
        let rawMinN = Math.min(...data.boundaryPts.map(p => p.n));
        let rawMaxN = Math.max(...data.boundaryPts.map(p => p.n));
        let rawMinE = Math.min(...data.boundaryPts.map(p => p.e));
        let rawMaxE = Math.max(...data.boundaryPts.map(p => p.e));

        let startN = Math.floor(rawMinN / gridSize) * gridSize;
        let endN = Math.ceil(rawMaxN / gridSize) * gridSize;
        let startE = Math.floor(rawMinE / gridSize) * gridSize;
        let endE = Math.ceil(rawMaxE / gridSize) * gridSize;

        let rawCut = 0, rawFill = 0, cutArea = 0, fillArea = 0;
        let mapCells = []; // 🔴 ဖြည့်စွက်ချက်: DXF တွင် အရောင်ခြယ်ရန် အကွက်များကို မှတ်သားမည့် Array

        let prepTriangles = (tris) => {
            for(let i=0; i<tris.length; i++) {
                tris[i].minN = Math.min(tris[i].p1.n, tris[i].p2.n, tris[i].p3.n);
                tris[i].maxN = Math.max(tris[i].p1.n, tris[i].p2.n, tris[i].p3.n);
                tris[i].minE = Math.min(tris[i].p1.e, tris[i].p2.e, tris[i].p3.e);
                tris[i].maxE = Math.max(tris[i].p1.e, tris[i].p2.e, tris[i].p3.e);
            }
        };
        prepTriangles(data.triangles);
        if(data.targetTriangles && data.targetTriangles.length > 0) prepTriangles(data.targetTriangles);

        let numRows = Math.round((endN - startN) / gridSize) + 1;
        let numCols = Math.round((endE - startE) / gridSize) + 1;
        let totalSteps = numRows * numCols;
        let currentStep = 0;
        let lastPercent = 0;

        for (let r = 0; r < numRows; r++) {
            let n = startN + (r * gridSize);
            
            for (let c = 0; c < numCols; c++) {
                let e = startE + (c * gridSize);
                currentStep++;
                
                let percent = Math.floor((currentStep / totalSteps) * 100);
                if (percent > lastPercent && percent % 5 === 0) {
                    self.postMessage({ type: 'progress', percent: percent });
                    lastPercent = percent;
                }

                let cellN = n + (gridSize / 2);
                let cellE = e + (gridSize / 2);

                if (isPointInVolumeBoundary(cellN, cellE, data.boundaryPts)) {
                    let groundZ = getZFromTIN(cellN, cellE, data.triangles);
                    if (groundZ !== null) {
                        let targetZ = null;
                        if (data.baseType === 'flat') targetZ = data.targetLevels[0].z;
                        else if (data.baseType === 'variable') targetZ = getZFromTIN(cellN, cellE, data.targetTriangles);
                        else if (data.baseType === 'surface2') targetZ = getZFromTIN(cellN, cellE, data.targetLevels);

                        if (targetZ !== null) {
                            let diff = groundZ - targetZ; 
                            let vol = Math.abs(diff) * gridArea;

                            if (diff > 0.001) { 
                                rawCut += vol; cutArea += gridArea; 
                                mapCells.push({ e: cellE, n: cellN, type: 1 }); // 🔴 1 = အနီရောင် (Cut)
                            } 
                            else if (diff < -0.001) { 
                                rawFill += vol; fillArea += gridArea; 
                                mapCells.push({ e: cellE, n: cellN, type: 3 }); // 🔴 3 = အစိမ်းရောင် (Fill)
                            }
                        }
                    }
                }
            }
        }

        let adjCut = rawCut * (1 + (data.swellPct / 100));
        let adjFill = rawFill * (1 + (data.shrinkPct / 100));

        self.postMessage({
            type: 'done',
            result: {
                cutVol: adjCut, fillVol: adjFill, netVol: adjCut - adjFill, 
                rawCut: rawCut, rawFill: rawFill, 
                cutArea: cutArea, fillArea: fillArea, totalArea: cutArea + fillArea,
                gridSize: gridSize, swellPct: data.swellPct, shrinkPct: data.shrinkPct,
                mapCells: mapCells // 🔴 Export ထုတ်မည့် အပိုင်းအတွက် ပြန်ပို့ပေးမည်
            }
        });
    };
`;

// 2. Main Thread မှ Worker ခေါ်မည့် Wrapper Function အသစ်
function runVolumeWorker(triangles, boundaryPts, targetLevels, baseType, customGrid, customSwell, customShrink, onProgress, onComplete) {
    
    // 🔴 UI ထဲက သွားမဖတ်တော့ဘဲ Parameter ကနေပဲ ယူသုံးမည်
    let gridSize = customGrid > 0.01 ? customGrid : 0.5;
    let swellPct = customSwell || 0;
    let shrinkPct = customShrink || 0;

    let targetTriangles = [];
    if (baseType === 'variable' && typeof generateDelaunayTriangulation === 'function') {
        targetTriangles = generateDelaunayTriangulation(targetLevels);
    }

    const blob = new Blob([volumeWorkerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = function(e) {
        if (e.data.type === 'progress') {
            if (onProgress) onProgress(e.data.percent);
        } else if (e.data.type === 'done') {
            worker.terminate(); 
            if (onComplete) onComplete(e.data.result);
        }
    };

    worker.postMessage({
        triangles: triangles, boundaryPts: boundaryPts, targetLevels: targetLevels, targetTriangles: targetTriangles,
        baseType: baseType, gridSize: gridSize, swellPct: swellPct, shrinkPct: shrinkPct
    });
}

window.calcVolume = function() {
    if (typeof window.savedVolAreas === 'undefined') window.savedVolAreas = [];
    let areasToCalc = [...window.savedVolAreas];

    if (window.volBoundaryPts && window.volBoundaryPts.length >= 3) {
        let baseType = document.getElementById('vol_base_type').value;
        let targetLevels = [];

        if (baseType === 'flat') {
            let flatZInput = document.getElementById('vol_flat_z');
            if (!flatZInput || flatZInput.value === "") return alert("⚠️ Please enter a Flat Base Level (Z) before calculating.");
            targetLevels.push({ z: parseFloat(flatZInput.value) });
        } 
        else if (baseType === 'variable') {
            let valid = true;
            for (let i = 0; i < window.volBoundaryPts.length; i++) {
                let varZInput = document.getElementById(`vol_var_z_${i}`);
                if (!varZInput || varZInput.value === "") { alert(`⚠️ Please enter Target Level for BDY ${i+1}.`); valid = false; break; }
                targetLevels.push({ n: window.volBoundaryPts[i].n, e: window.volBoundaryPts[i].e, z: parseFloat(varZInput.value) });
            }
            if (!valid) return; 
        }
        else if (baseType === 'surface2') {
            if (!window.volSurface2Triangles || window.volSurface2Triangles.length === 0) return alert("⚠️ Please upload Surface 2 CSV first!");
            targetLevels = window.volSurface2Triangles;
        }

        if (targetLevels.length > 0) {
            // 🔴 Save မလုပ်ရသေးတဲ့ လက်ရှိ Area အတွက်ဆိုရင်တော့ မျက်နှာပြင်က လက်ရှိ Input Box တန်ဖိုးကို ယူသုံးမည်
            let curGrid = parseFloat(document.getElementById('vol_grid_size').value) || 0.5;
            let curSwell = parseFloat(document.getElementById('vol_swell').value) || 0;
            let curShrink = parseFloat(document.getElementById('vol_shrink').value) || 0;

            areasToCalc.push({ 
                boundary: [...window.volBoundaryPts], baseType: baseType, targetLevels: targetLevels,
                gridSize: curGrid, swellPct: curSwell, shrinkPct: curShrink 
            });
        }
    }

    if (areasToCalc.length === 0) return alert("⚠️ No valid areas to calculate. Please draw a boundary and enter target levels.");

    document.getElementById('vol_result_box').classList.remove('hidden');
    let summaryBox = document.getElementById('vol_summary');
    
    summaryBox.innerHTML = `
        <div style="text-align:center; color:#d97706; padding:10px;">
            <b>⏳ Preparing Data...</b><br>
            <div style="width:100%; background:#e2e8f0; border-radius:10px; height:10px; margin-top:10px; overflow:hidden;">
                <div id="vol_progress_bar" style="width:0%; height:100%; background:#10b981; transition:width 0.2s;"></div>
            </div>
            <div id="vol_progress_text" style="font-size:12px; margin-top:5px; color:#1e40af; font-weight:bold;">0%</div>
        </div>`;

    let grandTotalArea = 0, grandCutVol = 0, grandFillVol = 0;
    let grandRawCut = 0, grandRawFill = 0;
    let grandCutArea = 0, grandFillArea = 0; // 🔴 Cut/Fill Area အသစ်ထပ်ထည့်ထားသည်
    let reportDetails = "";
    window.latestVolResultsArray = []; 
    let currentIndex = 0;

    function processNextArea() {
        if (currentIndex >= areasToCalc.length) {
            let grandNetVol = grandCutVol - grandFillVol;
            let html = `
                <div style="font-weight:bold; font-size:15px; text-align:center; color:#1e40af; border-bottom:1px solid #10b981; padding-bottom:5px; margin-bottom:10px;">📊 Earthwork Volume Report</div>
                ${areasToCalc.length > 1 ? reportDetails : ''}
                <table style="width:100%; border-collapse: collapse; margin-top:5px; font-size:13px;">
                    <tr><td style="padding:4px 0;"><b>Total Area:</b></td><td style="padding:4px 0; text-align:right; font-weight:bold;">${grandTotalArea.toFixed(2)} m²</td></tr>
                    <tr><td style="padding:4px 0; color:#ef4444;"><b>Cut Area:</b></td><td style="padding:4px 0; text-align:right; color:#ef4444;">${grandCutArea.toFixed(2)} m²</td></tr>
                    <tr><td style="padding:4px 0; color:#059669; border-bottom:1px solid #cbd5e1;"><b>Fill Area:</b></td><td style="padding:4px 0; text-align:right; color:#059669; border-bottom:1px solid #cbd5e1;">${grandFillArea.toFixed(2)} m²</td></tr>
                    
                    <tr style="background:rgba(239,68,68,0.05);"><td style="padding:4px 0; color:#ef4444;"><b>Total Raw Cut:</b></td><td style="padding:4px 0; text-align:right; color:#ef4444;">${grandRawCut.toFixed(3)} m³</td></tr>
                    <tr style="background:rgba(239,68,68,0.1);"><td style="padding:4px 0; border-bottom:1px solid #fca5a5;"><b>Adjusted Cut:</b></td><td style="padding:4px 0; border-bottom:1px solid #fca5a5; text-align:right; color:#b91c1c; font-weight:bold; font-size:15px;">${grandCutVol.toFixed(3)} m³</td></tr>
                    <tr style="background:rgba(16,185,129,0.05);"><td style="padding:4px 0; color:#059669;"><b>Total Raw Fill:</b></td><td style="padding:4px 0; text-align:right; color:#059669;">${grandRawFill.toFixed(3)} m³</td></tr>
                    <tr style="background:rgba(16,185,129,0.1);"><td style="padding:4px 0; border-bottom:1px solid #6ee7b7;"><b>Adjusted Fill:</b></td><td style="padding:4px 0; border-bottom:1px solid #6ee7b7; text-align:right; color:#047857; font-weight:bold; font-size:15px;">${grandFillVol.toFixed(3)} m³</td></tr>
                    <tr><td style="padding-top:10px; font-size:14px;"><b>NET VOLUME:</b></td><td style="padding-top:10px; text-align:right; font-size:15px; font-weight:bold; color:${grandNetVol >= 0 ? '#ef4444' : '#059669'};">${Math.abs(grandNetVol).toFixed(3)} m³ <span style="font-size:11px;">(${grandNetVol >= 0 ? 'Cut' : 'Fill'})</span></td></tr>
                </table>
            `;
            summaryBox.innerHTML = html;
            return;
        }

        let area = areasToCalc[currentIndex];
        
        summaryBox.innerHTML = `
            <div style="text-align:center; color:#d97706; padding:10px;">
                <b>⏳ Calculating BDY ${currentIndex + 1} of ${areasToCalc.length}...</b><br>
                <div style="width:100%; background:#e2e8f0; border-radius:10px; height:10px; margin-top:10px; overflow:hidden;">
                    <div id="vol_progress_bar" style="width:0%; height:100%; background:#10b981; transition:width 0.2s;"></div>
                </div>
                <div id="vol_progress_text" style="font-size:12px; margin-top:5px; color:#1e40af; font-weight:bold;">0%</div>
            </div>`;

        runVolumeWorker(window.volTriangles, area.boundary, area.targetLevels, area.baseType, area.gridSize, area.swellPct, area.shrinkPct, 
            function(pct) {
                let pBar = document.getElementById('vol_progress_bar');
                let pTxt = document.getElementById('vol_progress_text');
                if(pBar) pBar.style.width = pct + '%';
                if(pTxt) pTxt.innerText = pct + '%';
            },
            function(res) {
                grandTotalArea += res.totalArea;
                grandCutArea += res.cutArea; // 🔴 Cut Area ပေါင်းခြင်း
                grandFillArea += res.fillArea; // 🔴 Fill Area ပေါင်းခြင်း
                grandCutVol += res.cutVol; grandFillVol += res.fillVol;
                grandRawCut += res.rawCut; grandRawFill += res.rawFill;

                res.areaIndex = currentIndex + 1;
                window.latestVolResultsArray.push({ areaDef: area, result: res });

                reportDetails += `
                <div style="font-size:11px; color:#475569; border-bottom:1px dashed #cbd5e1; margin-bottom:5px; padding-bottom:5px;">
                    <b>BDY ${currentIndex + 1} (Grid ${res.gridSize}m):</b> 
                    Cut = <span style="color:#ef4444;">${res.cutVol.toFixed(2)} m³</span> | 
                    Fill = <span style="color:#059669;">${res.fillVol.toFixed(2)} m³</span>
                </div>`;

                currentIndex++;
                processNextArea(); 
            }
        );
    }

    processNextArea();
};

window.exportVolDXF = function() {
    if (!window.latestVolResultsArray || window.latestVolResultsArray.length === 0) {
        return alert("Please Calculate Volume first!");
    }

    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n15\n"; 
    
    // Topo & Grid အတွက် Layers
    dxf += "0\nLAYER\n2\nTOPO_POINTS\n70\n0\n62\n7\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nTOPO_MAJOR_CONTOUR\n70\n0\n62\n2\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nTOPO_MINOR_CONTOUR\n70\n0\n62\n8\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nTOPO_LABELS\n70\n0\n62\n7\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nTOPO_BOUNDARY\n70\n0\n62\n1\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nTOPO_POINT_NO\n70\n0\n62\n1\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nTOPO_POINT_CODES\n70\n0\n62\n3\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nGRID_LINES\n70\n0\n62\n8\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nGRID_TEXT\n70\n0\n62\n7\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nMAP_TITLE\n70\n0\n62\n7\n6\nCONTINUOUS\n"; 
    dxf += "0\nLAYER\n2\nNORTH_ARROW\n70\n0\n62\n7\n6\nCONTINUOUS\n"; 
    
    // Volume & Table အတွက် Layers
    dxf += "0\nLAYER\n2\nVOL_CUT_AREA\n70\n0\n62\n1\n6\nCONTINUOUS\n"; // Red
    dxf += "0\nLAYER\n2\nVOL_FILL_AREA\n70\n0\n62\n3\n6\nCONTINUOUS\n"; // Green
    dxf += "0\nLAYER\n2\nVOL_BOUNDARY\n70\n0\n62\n5\n6\nCONTINUOUS\n"; // Blue
    dxf += "0\nLAYER\n2\nREPORT_TABLE\n70\n0\n62\n7\n6\nCONTINUOUS\n";
    dxf += "0\nENDTAB\n0\nENDSEC\n";
    
    dxf += "0\nSECTION\n2\nENTITIES\n";

    // --- Settings များကို UI မှ လှမ်းယူခြင်း ---
    let labelSpacing = parseFloat(document.getElementById('topo_label_space')?.value) || 15.0; 
    let txtH = parseFloat(document.getElementById('topo_text_height')?.value) || 0.5; 
    let interval = parseFloat(document.getElementById('topo_grid_interval')?.value) || 50;
    let mapTitle = document.getElementById('topo_map_title')?.value.trim() || "TOPOGRAPHIC MAP";
    let yOffset = txtH * 0.7; 

    // --- Boundary ကို ရှာခြင်း (Grid Box ချရန်) ---
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
    if (window.topoPoints) {
        window.topoPoints.forEach(pt => {
            if (pt.e < minE) minE = pt.e; if (pt.e > maxE) maxE = pt.e;
            if (pt.n < minN) minN = pt.n; if (pt.n > maxN) maxN = pt.n;
        });
    }
    window.latestVolResultsArray.forEach(item => {
        item.areaDef.boundary.forEach(pt => {
            if (pt.e < minE) minE = pt.e; if (pt.e > maxE) maxE = pt.e;
            if (pt.n < minN) minN = pt.n; if (pt.n > maxN) maxN = pt.n;
        });
    });
    if (minE === Infinity) { minE = 0; maxE = 100; minN = 0; maxN = 100; }

    let gridMinE = minE - interval, gridMaxE = maxE + interval;
    let gridMinN = minN - interval, gridMaxN = maxN + interval;
    let startE = Math.ceil(gridMinE / interval) * interval;
    let startN = Math.ceil(gridMinN / interval) * interval;

    // ==========================================
    // 🔴 အပိုင်း (၁) - TOPO MAP အပြည့်အစုံ ရေးဆွဲခြင်း
    // ==========================================
    
    if (window.topoPoints) {
        window.topoPoints.forEach(pt => {
            let ptxtE = pt.e + (txtH * 0.3); let currentTxtH = txtH * 0.5; 
            dxf += `0\nPOINT\n8\nTOPO_POINTS\n10\n${pt.e.toFixed(3)}\n20\n${pt.n.toFixed(3)}\n30\n${pt.z.toFixed(3)}\n`;
            if (pt.p && pt.p.trim() !== "") {
                dxf += `0\nTEXT\n8\nTOPO_POINT_NO\n10\n${ptxtE.toFixed(3)}\n20\n${(pt.n + yOffset).toFixed(3)}\n30\n${pt.z.toFixed(3)}\n40\n${currentTxtH}\n1\n${pt.p}\n`;
            }
            dxf += `0\nTEXT\n8\nTOPO_POINTS\n10\n${ptxtE.toFixed(3)}\n20\n${pt.n.toFixed(3)}\n30\n${pt.z.toFixed(3)}\n40\n${currentTxtH}\n1\n${pt.z.toFixed(3)}\n`;
            if (pt.d && pt.d.trim() !== "") {
                dxf += `0\nTEXT\n8\nTOPO_POINT_CODES\n10\n${ptxtE.toFixed(3)}\n20\n${(pt.n - yOffset).toFixed(3)}\n30\n${pt.z.toFixed(3)}\n40\n${currentTxtH}\n1\n${pt.d}\n`;
            }
        });
    }

    if (window.topoContours) {
        window.topoContours.forEach(poly => {
            let layer = poly.isMajor ? "TOPO_MAJOR_CONTOUR" : "TOPO_MINOR_CONTOUR";
            dxf += `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n8\n10\n0.0\n20\n0.0\n30\n${poly.z.toFixed(3)}\n`;
            poly.points.forEach(pt => { dxf += `0\nVERTEX\n8\n${layer}\n70\n32\n10\n${pt.e.toFixed(3)}\n20\n${pt.n.toFixed(3)}\n30\n${poly.z.toFixed(3)}\n`; });
            dxf += `0\nSEQEND\n8\n${layer}\n`;

            if (poly.isMajor && poly.points.length >= 2) {
                let currentDist = 0; let nextLabelDist = labelSpacing / 2; 
                for (let i = 0; i < poly.points.length - 1; i++) {
                    let p1 = poly.points[i]; let p2 = poly.points[i+1];
                    let segLen = Math.hypot(p2.e - p1.e, p2.n - p1.n); 
                    if (currentDist + segLen >= nextLabelDist) {
                        let fraction = (nextLabelDist - currentDist) / segLen;
                        let labelE = p1.e + fraction * (p2.e - p1.e); let labelN = p1.n + fraction * (p2.n - p1.n);
                        let angleDeg = Math.atan2(p2.n - p1.n, p2.e - p1.e) * (180 / Math.PI);
                        if (angleDeg > 90 || angleDeg <= -90) angleDeg += 180;
                        dxf += `0\nTEXT\n8\nTOPO_LABELS\n10\n${labelE.toFixed(3)}\n20\n${labelN.toFixed(3)}\n30\n${poly.z.toFixed(3)}\n40\n${txtH}\n1\n${poly.z.toFixed(3)}\n50\n${angleDeg.toFixed(3)}\n72\n1\n11\n${labelE.toFixed(3)}\n21\n${labelN.toFixed(3)}\n31\n${poly.z.toFixed(3)}\n73\n2\n`;
                        nextLabelDist += labelSpacing; 
                    }
                    currentDist += segLen;
                }
            }
        });
    }

    // Grid Lines & Titles
    let gridTxtH = txtH * 3.5; 
    for (let e = startE; e <= gridMaxE; e += interval) {
        dxf += `0\nLINE\n8\nGRID_LINES\n10\n${e}\n20\n${gridMinN}\n30\n0.0\n11\n${e}\n21\n${gridMaxN}\n31\n0.0\n`;
        dxf += `0\nTEXT\n8\nGRID_TEXT\n10\n${e}\n20\n${gridMaxN + gridTxtH}\n30\n0.0\n40\n${gridTxtH}\n1\nE ${e.toFixed(3)}\n72\n1\n11\n${e}\n21\n${gridMaxN + gridTxtH}\n31\n0.0\n73\n1\n`;
        dxf += `0\nTEXT\n8\nGRID_TEXT\n10\n${e}\n20\n${gridMinN - gridTxtH}\n30\n0.0\n40\n${gridTxtH}\n1\nE ${e.toFixed(3)}\n72\n1\n11\n${e}\n21\n${gridMinN - gridTxtH}\n31\n0.0\n73\n3\n`;
    }
    for (let n = startN; n <= gridMaxN; n += interval) {
        dxf += `0\nLINE\n8\nGRID_LINES\n10\n${gridMinE}\n20\n${n}\n30\n0.0\n11\n${gridMaxE}\n21\n${n}\n31\n0.0\n`;
        dxf += `0\nTEXT\n8\nGRID_TEXT\n10\n${gridMinE - gridTxtH}\n20\n${n}\n30\n0.0\n40\n${gridTxtH}\n1\nN ${n.toFixed(3)}\n72\n2\n11\n${gridMinE - gridTxtH}\n21\n${n}\n31\n0.0\n73\n2\n`;
        dxf += `0\nTEXT\n8\nGRID_TEXT\n10\n${gridMaxE + gridTxtH}\n20\n${n}\n30\n0.0\n40\n${gridTxtH}\n1\nN ${n.toFixed(3)}\n72\n0\n11\n${gridMaxE + gridTxtH}\n21\n${n}\n31\n0.0\n73\n2\n`;
    }
    dxf += `0\nPOLYLINE\n8\nGRID_LINES\n66\n1\n70\n1\n10\n0.0\n20\n0.0\n30\n0.0\n`; 
    dxf += `0\nVERTEX\n8\nGRID_LINES\n70\n32\n10\n${gridMinE}\n20\n${gridMinN}\n30\n0.0\n0\nVERTEX\n8\nGRID_LINES\n70\n32\n10\n${gridMaxE}\n20\n${gridMinN}\n30\n0.0\n0\nVERTEX\n8\nGRID_LINES\n70\n32\n10\n${gridMaxE}\n20\n${gridMaxN}\n30\n0.0\n0\nVERTEX\n8\nGRID_LINES\n70\n32\n10\n${gridMinE}\n20\n${gridMaxN}\n30\n0.0\n0\nSEQEND\n8\nGRID_LINES\n`;

    dxf += `0\nTEXT\n8\nMAP_TITLE\n10\n${(gridMinE + gridMaxE)/2}\n20\n${gridMaxN + (gridTxtH * 4)}\n30\n0.0\n40\n${gridTxtH * 2.5}\n1\n${mapTitle}\n72\n1\n11\n${(gridMinE + gridMaxE)/2}\n21\n${gridMaxN + (gridTxtH * 4)}\n31\n0.0\n73\n1\n`;

    let nSize = Math.min(Math.max((gridMaxN - gridMinN) * 0.08, interval * 0.4), 50); 
    let arrE = gridMaxE + (gridTxtH * 8), arrN = gridMaxN - (nSize * 1.5), tN = arrN + nSize, w = nSize * 0.25, cN = arrN + (nSize * 0.3);
    dxf += `0\nLINE\n8\nNORTH_ARROW\n10\n${arrE}\n20\n${arrN}\n30\n0.0\n11\n${arrE}\n21\n${tN}\n31\n0.0\n`;
    dxf += `0\nSOLID\n8\nNORTH_ARROW\n10\n${arrE}\n20\n${tN}\n30\n0.0\n11\n${arrE + w}\n21\n${cN}\n31\n0.0\n12\n${arrE}\n22\n${cN}\n32\n0.0\n13\n${arrE}\n23\n${cN}\n33\n0.0\n`;
    dxf += `0\nLINE\n8\nNORTH_ARROW\n10\n${arrE}\n20\n${tN}\n30\n0.0\n11\n${arrE - w}\n21\n${cN}\n31\n0.0\n`;
    dxf += `0\nLINE\n8\nNORTH_ARROW\n10\n${arrE - w}\n20\n${cN}\n30\n0.0\n11\n${arrE}\n21\n${cN}\n31\n0.0\n`;
    dxf += `0\nCIRCLE\n8\nNORTH_ARROW\n10\n${arrE}\n20\n${arrN}\n30\n0.0\n40\n${nSize * 0.1}\n`;
    dxf += `0\nTEXT\n8\nNORTH_ARROW\n10\n${arrE}\n20\n${tN + (gridTxtH * 0.8)}\n30\n0.0\n40\n${gridTxtH * 1.5}\n1\nN\n72\n1\n11\n${arrE}\n21\n${tN + (gridTxtH * 0.8)}\n31\n0.0\n73\n1\n`;

    // ==========================================
    // 🔴 အပိုင်း (၂) - VOLUME CUT/FILL SOLIDS
    // ==========================================
    let grandCut = 0, grandFill = 0, grandArea = 0;

    window.latestVolResultsArray.forEach((item, index) => {
        let bdy = item.areaDef.boundary;
        let res = item.result;
        grandCut += res.cutVol; grandFill += res.fillVol; grandArea += res.totalArea;

        // Draw Volume Boundary 
        dxf += `0\nPOLYLINE\n8\nVOL_BOUNDARY\n66\n1\n70\n9\n10\n0.0\n20\n0.0\n30\n0.0\n`; 
        bdy.forEach(pt => { dxf += `0\nVERTEX\n8\nVOL_BOUNDARY\n70\n32\n10\n${pt.e.toFixed(3)}\n20\n${pt.n.toFixed(3)}\n30\n0.0\n`; });
        dxf += `0\nSEQEND\n8\nVOL_BOUNDARY\n`;

        // Cut / Fill Colors
        let hs = res.gridSize / 2.0; 
        if (res.mapCells && res.mapCells.length > 0) {
            res.mapCells.forEach(cell => {
                let layer = cell.type === 1 ? "VOL_CUT_AREA" : "VOL_FILL_AREA";
                let x1 = cell.e - hs, y1 = cell.n - hs; 
                let x2 = cell.e + hs, y2 = cell.n - hs; 
                let x3 = cell.e - hs, y3 = cell.n + hs; 
                let x4 = cell.e + hs, y4 = cell.n + hs; 
                dxf += `0\nSOLID\n8\n${layer}\n10\n${x1.toFixed(3)}\n20\n${y1.toFixed(3)}\n30\n0.0\n11\n${x2.toFixed(3)}\n21\n${y2.toFixed(3)}\n31\n0.0\n12\n${x3.toFixed(3)}\n22\n${y3.toFixed(3)}\n32\n0.0\n13\n${x4.toFixed(3)}\n23\n${y4.toFixed(3)}\n33\n0.0\n`;
            });
        }
        
        let cE = bdy.reduce((s, p) => s + p.e, 0) / bdy.length;
        let cN = bdy.reduce((s, p) => s + p.n, 0) / bdy.length;
        dxf += `0\nTEXT\n8\nVOL_BOUNDARY\n10\n${cE}\n20\n${cN}\n30\n0.0\n40\n${gridTxtH}\n1\nVol BDY ${item.result.areaIndex}\n72\n1\n11\n${cE}\n21\n${cN}\n31\n0.0\n73\n2\n`;
    });

    // ==========================================
    // 🔴 အပိုင်း (၃) - REPORT TABLE (Cut Area & Fill Area အသစ်ထည့်ထားသည်)
    // ==========================================
    
    let tX = gridMaxE + 30.0; 
    let tY = gridMaxN; 
    
    // 🔴 Column ၉ ခု ရှိသွားပါမည်
    let cols = [8.0, 16.0, 14.0, 16.0, 16.0, 18.0, 20.0, 20.0, 26.0]; 
    let tW = cols.reduce((a, b) => a + b, 0);
    
    let tblTxtH = 1.5; 
    let rowH = tblTxtH * 3.5; 
    let numRows = window.latestVolResultsArray.length + 2; 

    dxf += `0\nTEXT\n8\nREPORT_TABLE\n62\n3\n10\n${tX + tW/2}\n20\n${tY + (rowH * 2)}\n30\n0.0\n40\n${tblTxtH * 1.5}\n1\nEARTHWORK VOLUME REPORT\n72\n1\n11\n${tX + tW/2}\n21\n${tY + (rowH * 2)}\n31\n0.0\n73\n2\n`;
    dxf += `0\nTEXT\n8\nREPORT_TABLE\n62\n8\n10\n${tX + tW/2}\n20\n${tY + (rowH * 0.8)}\n30\n0.0\n40\n${tblTxtH}\n1\nCalculation Method: Grid Method\n72\n1\n11\n${tX + tW/2}\n21\n${tY + (rowH * 0.8)}\n31\n0.0\n73\n2\n`;

    for (let r = 0; r <= numRows; r++) {
        let curY = tY - (r * rowH);
        dxf += `0\nLINE\n8\nREPORT_TABLE\n10\n${tX}\n20\n${curY}\n30\n0.0\n11\n${tX + tW}\n21\n${curY}\n31\n0.0\n`;
    }
    let curX = tX;
    dxf += `0\nLINE\n8\nREPORT_TABLE\n10\n${curX}\n20\n${tY}\n30\n0.0\n11\n${curX}\n21\n${tY - (numRows * rowH)}\n31\n0.0\n`;
    for (let c = 0; c < cols.length; c++) {
        curX += cols[c];
        dxf += `0\nLINE\n8\nREPORT_TABLE\n10\n${curX}\n20\n${tY}\n30\n0.0\n11\n${curX}\n21\n${tY - (numRows * rowH)}\n31\n0.0\n`;
    }

    function writeCell(rowIdx, colIdx, text, colorCode = 7) {
        let xPos = tX; 
        for(let i=0; i<colIdx; i++) xPos += cols[i];
        xPos += (cols[colIdx] / 2); 
        let yPos = tY - (rowIdx * rowH) - (rowH / 2);
        dxf += `0\nTEXT\n8\nREPORT_TABLE\n62\n${colorCode}\n10\n${xPos}\n20\n${yPos}\n30\n0.0\n40\n${tblTxtH}\n1\n${text}\n72\n1\n11\n${xPos}\n21\n${yPos}\n31\n0.0\n73\n2\n`;
    }

    // 🔴 Headers အသစ်များ
    writeCell(0, 0, "No", 7);
    writeCell(0, 1, "Boundary", 7);
    writeCell(0, 2, "Grid (m)", 7);
    writeCell(0, 3, "Cut Area", 1);  // 🔴
    writeCell(0, 4, "Fill Area", 3); // 🔴
    writeCell(0, 5, "Total Area", 7); 
    writeCell(0, 6, "Cut (cu.m)", 1); 
    writeCell(0, 7, "Fill (cu.m)", 3); 
    writeCell(0, 8, "Net (cu.m)", 2); 

    let grandCutArea = 0, grandFillArea = 0;

    // Data Rows
    window.latestVolResultsArray.forEach((item, index) => {
        let rIdx = index + 1;
        let r = item.result;
        let net = r.cutVol - r.fillVol;
        
        grandCutArea += r.cutArea;
        grandFillArea += r.fillArea;

        writeCell(rIdx, 0, r.areaIndex.toString(), 7);
        writeCell(rIdx, 1, `BDY ${r.areaIndex}`, 5);
        writeCell(rIdx, 2, r.gridSize.toFixed(2), 8); 
        writeCell(rIdx, 3, r.cutArea.toFixed(2), 1);   // 🔴 Cut Area Data
        writeCell(rIdx, 4, r.fillArea.toFixed(2), 3);  // 🔴 Fill Area Data
        writeCell(rIdx, 5, r.totalArea.toFixed(2), 7);
        writeCell(rIdx, 6, r.cutVol.toFixed(3), 1);
        writeCell(rIdx, 7, r.fillVol.toFixed(3), 3);
        writeCell(rIdx, 8, Math.abs(net).toFixed(3) + (net >= 0 ? " (Cut)" : " (Fill)"), net >= 0 ? 1 : 3);
    });

    // Grand Total Row
    let lastRow = window.latestVolResultsArray.length + 1;
    let grandNet = grandCut - grandFill;
    writeCell(lastRow, 1, "GRAND TOTAL", 4); 
    writeCell(lastRow, 2, "-", 8); 
    writeCell(lastRow, 3, grandCutArea.toFixed(2), 1);  // 🔴 Total Cut Area
    writeCell(lastRow, 4, grandFillArea.toFixed(2), 3); // 🔴 Total Fill Area
    writeCell(lastRow, 5, grandArea.toFixed(2), 7);
    writeCell(lastRow, 6, grandCut.toFixed(3), 1);
    writeCell(lastRow, 7, grandFill.toFixed(3), 3);
    writeCell(lastRow, 8, Math.abs(grandNet).toFixed(3) + (grandNet >= 0 ? " (Cut)" : " (Fill)"), 2);

    dxf += "0\nENDSEC\n0\nEOF\n";

    // Download DXF File
    let fileName = `Earthwork_Volume_Report_${new Date().getTime()}.dxf`;
    if (window.AndroidNative && window.AndroidNative.downloadConvertedCSV) { 
        window.AndroidNative.downloadConvertedCSV(dxf, fileName); 
    } else { 
        let blob = new Blob([dxf], { type: 'application/dxf' }); 
        let url = URL.createObjectURL(blob); 
        let a = document.createElement("a"); a.href = url; a.download = fileName; 
        document.body.appendChild(a); a.click(); document.body.removeChild(a); 
    }
};
