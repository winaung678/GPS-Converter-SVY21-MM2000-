// ==========================================
// --- 3D TIN SURFACE VIEWER & 3D DXF EXPORT ---
// ==========================================

// 🔴 Live Z-Scale ကို ချိန်းပေးမည့် Function အသစ်
window.update3DScale = function(val) {
    let displayVal = document.getElementById('z_scale_val');
    if (displayVal) displayVal.innerText = parseFloat(val).toFixed(1) + 'x';

    // Plotly ရဲ့ relayout ကိုသုံးပြီး Z ရဲ့ aspect ratio ကိုပဲ ချက်ချင်း (Live) ပြောင်းပေးမည်
    if (document.getElementById('plotly_3d_div')) {
        Plotly.relayout('plotly_3d_div', {
            'scene.aspectratio.z': parseFloat(val)
        });
    }
};

window.view3DSurface = function() {
    if (!window.topoPoints || window.topoPoints.length < 3 || !window.topoTriangles || window.topoTriangles.length === 0) {
        return alert("⚠️ Please generate Topo Surface first!");
    }

    let modal = document.getElementById('topo3dModal');
    modal.style.display = 'flex';
    
    // ----------------------------------------------------
    // (၁) အပေါ်ယံ မျက်နှာပြင် (Top Surface) အတွက် Data များ
    // ----------------------------------------------------
    let top_x = [], top_y = [], top_z = [];
    let top_i = [], top_j = [], top_k = [];
    let ptMap = new Map();
    let ptIndex = 0;
    let originalPts = [];

    function getPtIdx(pt) {
        let key = `${pt.e.toFixed(3)}_${pt.n.toFixed(3)}_${pt.z.toFixed(3)}`;
        if(!ptMap.has(key)) {
            ptMap.set(key, ptIndex);
            top_x.push(pt.e);     
            top_y.push(pt.n);     
            top_z.push(pt.z);
            originalPts.push(pt); 
            ptIndex++;
        }
        return ptMap.get(key);
    }

    window.topoTriangles.forEach(t => {
        top_i.push(getPtIdx(t.p1));
        top_j.push(getPtIdx(t.p2));
        top_k.push(getPtIdx(t.p3));
    });

    let topSurfaceTrace = {
        type: 'mesh3d',
        x: top_x, y: top_y, z: top_z,
        i: top_i, j: top_j, k: top_k,
        intensity: top_z, 
        colorscale: 'Jet', 
        showscale: true,
        colorbar: {
            title: 'Elevation (m)', titleside: 'right',
            tickfont: {color: '#ffffff'}, titlefont: {color: '#ffffff'}
        },
        flatshading: true,
        contour: { show: true, color: '#ffffff', width: 2 },
        name: 'Surface'
    };

    // ----------------------------------------------------
    // (၂) ဘေးဘောင် နံရံများ (Skirt / Walls) တွက်ချက်ခြင်း 
    // ----------------------------------------------------
    let minZ = Math.min(...top_z);
    let maxZ = Math.max(...top_z);
    let zRange = maxZ - minZ;
    let baseZ = minZ - (zRange * 0.15); 
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

            wall_x.push(ptA.e, ptB.e, ptB.e, ptA.e);
            wall_y.push(ptA.n, ptB.n, ptB.n, ptA.n);
            wall_z.push(ptA.z, ptB.z, baseZ, baseZ);

            wall_i.push(wallIdx, wallIdx);
            wall_j.push(wallIdx + 1, wallIdx + 2);
            wall_k.push(wallIdx + 2, wallIdx + 3);
            wallIdx += 4; 
        }
    });

    let wallTrace = {
        type: 'mesh3d',
        x: wall_x, y: wall_y, z: wall_z,
        i: wall_i, j: wall_j, k: wall_k,
        color: '#94a3b8', 
        flatshading: true,
        hoverinfo: 'none', 
        name: 'Base Wall'
    };

    // ----------------------------------------------------
    // (၃) အမြဲတမ်းပေါ်နေမည့် Contours မျဉ်းများ
    // ----------------------------------------------------
    let cx = [], cy = [], cz = [];
    if (window.topoContours && window.topoContours.length > 0) {
        window.topoContours.forEach(poly => {
            poly.points.forEach(pt => { cx.push(pt.e); cy.push(pt.n); cz.push(poly.z); });
            cx.push(null); cy.push(null); cz.push(null); 
        });
    }

    let contourTrace = {
        type: 'scatter3d', mode: 'lines', x: cx, y: cy, z: cz,
        line: { color: '#000000', width: 2 }, hoverinfo: 'none', showlegend: false
    };

    // ----------------------------------------------------
    // (၄) 3D Plotly Render လုပ်ခြင်း
    // ----------------------------------------------------
    
    // 🔴 Slider ရဲ့ လက်ရှိ တန်ဖိုးကို လှမ်းယူပါမည်
    let zScaleInput = document.getElementById('topo_z_scale');
    let initialZScale = zScaleInput ? parseFloat(zScaleInput.value) : 0.5;

    let layout = {
        paper_bgcolor: '#1e293b',
        margin: {l: 0, r: 0, b: 0, t: 0},
        scene: {
            xaxis: {title: 'Easting (X)', color: '#fff', gridcolor: '#475569', tickformat: '.0f'},
            yaxis: {title: 'Northing (Y)', color: '#fff', gridcolor: '#475569', tickformat: '.0f'},
            zaxis: {title: 'Elevation (Z)', color: '#fff', gridcolor: '#475569', tickformat: '.2f'},
            // 🔴 Z အတွက် အသေပေးမယ့်အစား Slider က ယူထားသော initialZScale ကို သုံးမည်
            aspectratio: { x: 1, y: 1, z: initialZScale },
            camera: { eye: {x: -1.25, y: -1.25, z: 1.25} }
        }
    };

    let plotData = [topSurfaceTrace];
    if (wall_i.length > 0) plotData.push(wallTrace); 
    if (cx.length > 0) plotData.push(contourTrace); 

    Plotly.newPlot('plotly_3d_div', plotData, layout, {responsive: true, displayModeBar: true});
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