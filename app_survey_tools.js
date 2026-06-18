// ==========================================
// --- RECORDING, CSV, STAKEOUT & COGO LOGIC ---
// ==========================================

function incrementPointName(p) {
    let match = p.match(/^(.*?)(\d+)$/);
    if (match) { let prefix = match[1]; let numStr = match[2]; let newNum = parseInt(numStr, 10) + 1; let paddedNum = newNum.toString().padStart(numStr.length, '0'); return prefix + paddedNum; }
    else { if (!isNaN(parseInt(p, 10))) return (parseInt(p, 10) + 1).toString(); return p + "1"; }
}

window.saveManualPoint = function(datumLabel, prefix) {
    let pInp = document.getElementById(prefix + '_man_pt'); let dInp = document.getElementById(prefix + '_man_desc');
    let p = pInp ? pInp.value || "1" : "1"; let d = dInp ? dInp.value || "" : "";
    window.recordedPointsBank.push({ p: p, lN: window.latest_local_N, lE: window.latest_local_E, wLa: window.latest_lat, wLo: window.latest_lon, wN: window.latest_wgs_N, wE: window.latest_wgs_E, z: window.latest_Z, d: d, datum: datumLabel });
    localStorage.setItem('surveyProRecords', JSON.stringify(window.recordedPointsBank));
    let statBox = document.getElementById(prefix + '_man_stat'); if(statBox) statBox.innerHTML = `✅ Point [${p}] Saved!`;
    if (window.AndroidNative && window.AndroidNative.savePoint) { window.AndroidNative.savePoint(p, window.latest_local_N.toFixed(3), window.latest_local_E.toFixed(3), window.latest_Z.toFixed(3), d); }
    if (pInp) pInp.value = incrementPointName(p);
    window.plotRecordedPointsOnMap();
};

window.triggerRecord = function(isPrecise) {
    if (!window.isNativeGPSActive) return alert("⚠️ Please start GPS tracking first!");
    if ((window.activeApp===1 || window.activeApp===2 || window.activeApp===5) && (window.latest_local_N === 0 && window.latest_wgs_N === 0)) return alert("⚠️ Please wait for valid GPS data!");

    let lat = window.latest_lat;
    let lon = window.latest_lon;
    if (window.activeApp === 1) {
        if (!(lat >= 1.0 && lat <= 2.0 && lon >= 103.0 && lon <= 104.5)) return alert("⚠️ Out of Bounds! You are not in Singapore Datum limit.");
    } else if (window.activeApp === 2) {
        if (!(lat >= 9.0 && lat <= 29.0 && lon >= 92.0 && lon <= 102.0)) return alert("⚠️ Out of Bounds! You are not in Myanmar Datum limit.");
    }

    if (isPrecise) {
        if (window.isAveraging) return; window.isAveraging = true; window.avgDataBuffer = [];
        let secondsLeft = 10; document.getElementById('avg_timer_display').style.display = 'block'; document.getElementById('record_status').style.display = 'none'; document.getElementById('avg_sec_left').innerText = secondsLeft;
        window.avgInterval = setInterval(() => {
            secondsLeft--; document.getElementById('avg_sec_left').innerText = secondsLeft;
            window.avgDataBuffer.push({ lN: window.latest_local_N, lE: window.latest_local_E, wLa: window.latest_lat, wLo: window.latest_lon, wN: window.latest_wgs_N, wE: window.latest_wgs_E, Z: window.latest_Z });
            if (secondsLeft <= 0) {
                clearInterval(window.avgInterval); window.isAveraging = false; document.getElementById('avg_timer_display').style.display = 'none';
                let sum_lN = 0, sum_lE = 0, sum_wLa = 0, sum_wLo = 0, sum_wN = 0, sum_wE = 0, sum_Z = 0; let count = window.avgDataBuffer.length;
                window.avgDataBuffer.forEach(d => { sum_lN += d.lN; sum_lE += d.lE; sum_wLa += d.wLa; sum_wLo += d.wLo; sum_wN += d.wN; sum_wE += d.wE; sum_Z += d.Z; });
                savePointToDevice(sum_lN/count, sum_lE/count, sum_wLa/count, sum_wLo/count, sum_wN/count, sum_wE/count, sum_Z/count, true);
            }
        }, 1000);
    } else {
        savePointToDevice(window.latest_local_N, window.latest_local_E, window.latest_lat, window.latest_lon, window.latest_wgs_N, window.latest_wgs_E, window.latest_Z, false);
    }
};

function savePointToDevice(lN, lE, la, lo, wN, wE, Z, isAveraged) {
    let pInput = document.getElementById('pt_id'); let p = pInput ? pInput.value || "1" : "1";
    let d = document.getElementById('pt_desc').value || ""; let zStr = Z.toFixed(3);
    let typeLabel = (window.activeApp === 1) ? "SVY21" : (window.activeApp === 2) ? "MM2000" : `UTM Z${Math.floor((lo+180)/6)+1}`;
    window.recordedPointsBank.push({ p: p, lN: lN, lE: lE, wLa: la, wLo: lo, wN: wN, wE: wE, z: Z, d: d, datum: typeLabel });
    localStorage.setItem('surveyProRecords', JSON.stringify(window.recordedPointsBank));
    let statBox = document.getElementById('record_status'); statBox.style.display = 'block';
    statBox.innerHTML = `✅ Point [${p}] Saved! ${isAveraged ? "<span style='color:#8b5cf6;'>[10s Avg]</span>" : ""}<br><span style="color:#0f172a;font-weight:normal;">N: ${lN.toFixed(3)} | E: ${lE.toFixed(3)} | Z: ${zStr}</span>`;
    if (window.AndroidNative && window.AndroidNative.savePoint) window.AndroidNative.savePoint(p, lN.toFixed(3), lE.toFixed(3), zStr, d);
    if (pInput) pInput.value = incrementPointName(p);
    window.plotRecordedPointsOnMap();
}

window.deleteRecordedPoint = function(index) {
    if(!confirm("Delete this point permanently?")) return;
    window.recordedPointsBank.splice(index, 1);
    localStorage.setItem('surveyProRecords', JSON.stringify(window.recordedPointsBank));
    if (window.leafletMap) window.leafletMap.closePopup();
    window.plotRecordedPointsOnMap();
};

window.triggerExport = function() {
    if (window.recordedPointsBank.length === 0) return alert("No points recorded yet!");
    let csvContent = "Point,Local_N,Local_E,WGS_Lat,WGS_Lon,WGS_UTM_N,WGS_UTM_E,Z_MSL,Description,Datum\n";
    window.recordedPointsBank.forEach(pt => { csvContent += `${pt.p},${pt.lN.toFixed(3)},${pt.lE.toFixed(3)},${pt.wLa.toFixed(8)},${pt.wLo.toFixed(8)},${pt.wN.toFixed(3)},${pt.wE.toFixed(3)},${pt.z.toFixed(3)},${pt.d},${pt.datum}\n`; });
    let fileName = `SurveyPro_Records_${new Date().getTime()}.csv`;
    if (window.AndroidNative && window.AndroidNative.downloadConvertedCSV) window.AndroidNative.downloadConvertedCSV(csvContent, fileName);
    else { let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); let link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
};

window.triggerClearRecords = function() {
    if(confirm("Are you sure you want to clear ALL saved points?")) {
        window.recordedPointsBank = []; localStorage.removeItem('surveyProRecords');
        if(window.AndroidNative && window.AndroidNative.clearRecordedPoints) window.AndroidNative.clearRecordedPoints();
        ['pt_id', 'v2_man_pt', 'm_man_pt', 'g_man_pt'].forEach(id => { let e = document.getElementById(id); if(e) e.value = '1'; });
        ['pt_desc', 'v2_man_desc', 'm_man_desc', 'g_man_desc'].forEach(id => { let e = document.getElementById(id); if(e) e.value = ''; });
        let statBox = document.getElementById('record_status'); if(statBox) { statBox.style.display = 'none'; statBox.innerHTML = ''; }
        ['v2_man_stat', 'm_man_stat', 'g_man_stat'].forEach(id => { let e = document.getElementById(id); if(e) e.innerHTML = ''; });
        if (window.recordedLayerGroup) window.recordedLayerGroup.clearLayers();
        alert("All saved points have been cleared!");
    }
};

window.handleCSVFile = function(event) { const file = event.target.files[0]; if (!file) return; let statBox = document.getElementById('csv_status'); let dlBtn = document.getElementById('csv_download_btn'); if(statBox) { statBox.style.display = 'block'; statBox.innerHTML = `⏳ Processing <b>${file.name}</b>...`; } if(dlBtn) { dlBtn.style.display = 'none'; } const reader = new FileReader(); reader.onload = function(e) { processCSVText(e.target.result, file.name, parseInt(document.getElementById('csv_mode').value)); }; reader.onerror = function() { if(statBox) statBox.innerHTML = "❌ Failed to read CSV file."; }; reader.readAsText(file); };
function processCSVText(csvText, originalFileName, mode) { let lines = csvText.split('\n'); let outCSV = "Point,Local_N,Local_E,WGS_Lat,WGS_Lon,WGS_UTM_N,WGS_UTM_E,Z,Description\n"; let successCount = 0; let dName = (window.activeApp === 1) ? "SVY21" : (window.activeApp === 2) ? "MM2000" : "Global UTM"; let globalUserZone = parseInt(document.getElementById('g_zone')?.value) || 47; let globalUserHemi = document.getElementById('g_hemi')?.value || 'N'; for (let i = 0; i < lines.length; i++) { let line = lines[i].trim(); if (!line) continue; let cols = line.split(','); let p = cols[0].trim(); let val1 = parseFloat(cols[1]); let val2 = parseFloat(cols[2]); if (isNaN(val1) || isNaN(val2)) continue; let z = parseFloat(cols[3]) || 0.000; let d = cols.length > 4 ? cols.slice(4).join(',').trim() : ""; let lN = 0, lE = 0, wLa = 0, wLo = 0, wN = 0, wE = 0; if (window.activeApp === 1) { if (mode === 1) { lN = val1; lE = val2; let r = calc_v2_rev(lE, lN); wLa = r.lat; wLo = r.lon; let pW = m_project(wLa, wLo, 48, m_WGS); wE = pW.e; wN = pW.n; } else if (mode === 2) { wLa = val1; wLo = val2; let r = calc_v2_fwd(wLa, wLo); lN = r.N; lE = r.E; let pW = m_project(wLa, wLo, Math.floor((wLo+180)/6)+1, m_WGS); wE = pW.e; wN = pW.n; } else if (mode === 3) { wN = val1; wE = val2; let i = m_inverse(wE, wN, 48, m_WGS); wLa = i.lat; wLo = i.lon; let r = calc_v2_fwd(wLa, wLo); lN = r.N; lE = r.E; } } else if (window.activeApp === 2) { let z_utm = parseInt(document.getElementById('m_zone').value) || 47; if (mode === 1) { lE = val2; lN = val1; let i_m = m_inverse(lE, lN, z_utm, m_EVE); let mLa = i_m.lat; let mLo = i_m.lon; let x = m_llh2xyz(mLa, mLo, 0, m_EVE); let wL = m_xyz2llh(x.x-m_DX, x.y-m_DY, x.z-m_DZ, m_WGS); wLa = wL.lat; wLo = wL.lon; let pW = m_project(wLa, wLo, z_utm, m_WGS); wE = pW.e; wN = pW.n; } else if (mode === 2) { wLa = val1; wLo = val2; let pW = m_project(wLa, wLo, z_utm, m_WGS); wE = pW.e; wN = pW.n; let x = m_llh2xyz(wLa, wLo, 0, m_WGS); let mL = m_xyz2llh(x.x+m_DX, x.y+m_DY, x.z+m_DZ, m_EVE); let pM = m_project(mL.lat, mL.lon, z_utm, m_EVE); lE = pM.e; lN = pM.n; } else if (mode === 3) { wN = val1; wE = val2; let i_w = m_inverse(wE, wN, z_utm, m_WGS); wLa = i_w.lat; wLo = i_w.lon; let x = m_llh2xyz(wLa, wLo, 0, m_WGS); let mL = m_xyz2llh(x.x+m_DX, x.y+m_DY, x.z+m_DZ, m_EVE); let pM = m_project(mL.lat, mL.lon, z_utm, m_EVE); lE = pM.e; lN = pM.n; } } else if (window.activeApp === 5) { if (mode === 1 || mode === 3) { lE = val2; lN = val1; wE = lE; wN = lN; let calcN = wN; if (globalUserHemi === 'S') calcN -= 10000000; let i_w = m_inverse(wE, calcN, globalUserZone, m_WGS); wLa = i_w.lat; wLo = i_w.lon; } else if (mode === 2) { wLa = val1; wLo = val2; let autoZone = Math.floor((wLo + 180) / 6) + 1; let autoHemi = wLa >= 0 ? 'N' : 'S'; let pW = m_project(wLa, wLo, autoZone, m_WGS); wE = pW.e; wN = pW.n; if (autoHemi === 'S') wN += 10000000; lE = wE; lN = wN; } } outCSV += `${p},${lN.toFixed(3)},${lE.toFixed(3)},${wLa.toFixed(8)},${wLo.toFixed(8)},${wN.toFixed(3)},${wE.toFixed(3)},${z.toFixed(3)},${d}\n`; successCount++; } let statBox = document.getElementById('csv_status'); if(successCount > 0) { window.finalCSVOutput = outCSV; if(statBox) statBox.innerHTML = `✅ Successfully converted <b>${successCount}</b> points! (${dName})`; let dlBtn = document.getElementById('csv_download_btn'); if(dlBtn) dlBtn.style.display = 'block'; } else { if(statBox) statBox.innerHTML = `⚠️ No valid points found. Check your PNEZD format.`; } document.getElementById('csv_file').value = ""; }
window.downloadCSV = function() { if (!window.finalCSVOutput) return; let dName = (window.activeApp === 1) ? "SVY21" : (window.activeApp === 2) ? "MM2000" : "Global_UTM"; let fileName = `Converted_${dName}_Points.csv`; if (window.AndroidNative && window.AndroidNative.downloadConvertedCSV) { window.AndroidNative.downloadConvertedCSV(window.finalCSVOutput, fileName); } else { let blob = new Blob([window.finalCSVOutput], { type: 'text/csv;charset=utf-8;' }); let url = URL.createObjectURL(blob); let link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", fileName); document.body.appendChild(link); link.click(); document.body.removeChild(link); } };
window.clearCSVFile = function() { let csvFileInput = document.getElementById('csv_file'); if(csvFileInput) csvFileInput.value = ""; let statusBox = document.getElementById('csv_status'); if(statusBox) statusBox.style.display = 'none'; let dlBtn = document.getElementById('csv_download_btn'); if(dlBtn) dlBtn.style.display = 'none'; window.finalCSVOutput = ""; };

window.importTopoToSetOut = function() {
    if (window.recordedPointsBank.length === 0) return alert("No Topo Points recorded yet!");
    let addedCount = 0;
    window.recordedPointsBank.forEach(pt => {
        let exists = window.setOutPoints.some(s => s.p === pt.p && s.lat === pt.wLa && s.lon === pt.wLo);
        if (!exists) { window.setOutPoints.push({p: pt.p, lat: pt.wLa, lon: pt.wLo, z: pt.z, d: pt.d}); addedCount++; }
    });
    if (addedCount > 0) {
        savePointsToStorage(); updateTargetDropdown(); window.plotPointsOnMap(); window.populateAreaPoints();
        alert(`Successfully imported ${addedCount} Topo points!`);
    } else { alert("Points are already in the list."); }
};

function savePointsToStorage() { localStorage.setItem('surveyProSetOutPoints', JSON.stringify(window.setOutPoints)); }
function loadPointsFromStorage() { let stored = localStorage.getItem('surveyProSetOutPoints'); if(stored) { window.setOutPoints = JSON.parse(stored); updateTargetDropdown(); if(window.leafletMap) window.plotPointsOnMap(); } }
window.setOutFromMapClick = function(lat, lon) { window.leafletMap.closePopup(); document.getElementById('so_target_list').value = ""; activateTarget({p: "Map Tap", lat: parseFloat(lat), lon: parseFloat(lon), z: 0, d: "Manual Map Tap"}); };

function activateTarget(pt) { window.targetPoint = pt; document.getElementById('map_container').classList.add('hide-names'); if(window.markerTarget) window.leafletMap.removeLayer(window.markerTarget); window.markerTarget = L.circleMarker([window.targetPoint.lat, window.targetPoint.lon], {radius: 7, color: '#1e3a8a', weight: 2, fillColor: '#f59e0b', fillOpacity: 1}).addTo(window.leafletMap); window.markerTarget.bindTooltip(`${window.targetPoint.p}`, {permanent: true, direction: 'top', className: 'pt-tooltip target-tooltip', offset: [0, -5]}).openTooltip(); window.isAutoCenter = true; document.getElementById('autoCenterBtn').classList.add('active'); if (window.currentLat !== 0) { let bounds = L.latLngBounds([window.currentLat, window.currentLon], [window.targetPoint.lat, window.targetPoint.lon]); window.leafletMap.flyToBounds(bounds, {padding: [50, 50], maxZoom: 24}); } else { window.leafletMap.flyTo([window.targetPoint.lat, window.targetPoint.lon], 22); } if(window.distanceLine) { window.leafletMap.removeLayer(window.distanceLine); window.distanceLine = null; } window.updateSetOut(); }
window.startMapSetOut = function(idx) { if (window.activeApp !== 3) window.switchApp(3); document.getElementById('so_target_list').value = idx; window.selectTarget(); window.leafletMap.closePopup(); };

window.stopNavigation = function() { window.targetPoint = null; let sel = document.getElementById('so_target_list'); if(sel) sel.value = ""; let soDist = document.getElementById('so_dist'); if(soDist) { soDist.innerText = "0.000 m"; soDist.classList.remove('success'); } let soGuide = document.getElementById('so_guidance_text'); if(soGuide) soGuide.innerText = "Waiting for Target..."; let soArrow = document.getElementById('so_arrow'); if(soArrow) soArrow.style.transform = `rotate(0deg)`; if(window.markerTarget && window.leafletMap) window.leafletMap.removeLayer(window.markerTarget); if(window.distanceLine && window.leafletMap) { window.leafletMap.removeLayer(window.distanceLine); window.distanceLine = null; } let mapCont = document.getElementById('map_container'); if(mapCont) mapCont.classList.remove('hide-names'); window.isAutoCenter = true; let btnAuto = document.getElementById('autoCenterBtn'); if(btnAuto) btnAuto.classList.add('active'); if (window.currentLat !== 0 && window.leafletMap) window.leafletMap.flyTo([window.currentLat, window.currentLon], 20); };

window.clearSetOutPoints = function() { if(!confirm("Are you sure you want to delete ALL Points?")) return; window.setOutPoints = []; window.orderedAreaPoints = []; savePointsToStorage(); updateTargetDropdown(); window.stopNavigation(); if(window.pointsLayerGroup) window.pointsLayerGroup.clearLayers(); window.populateAreaPoints(); window.updateAreaOrderUI(); window.clearAreaCalc(); alert("Points Cleared!"); };
window.loadSetOutCSV = function(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(e) { parseSetOutCSV(e.target.result); }; reader.readAsText(file); event.target.value = ''; };

function parseSetOutCSV(text) { window.stopNavigation(); let lines = text.split('\n'); let successCount = 0; let errorCount = 0; for (let i = 0; i < lines.length; i++) { let line = lines[i].trim(); if(!line) continue; let cols = line.split(','); if (cols.length < 3) { errorCount++; continue; } let p = cols[0].trim(); let val1 = parseFloat(cols[1]); let val2 = parseFloat(cols[2]); if (isNaN(val1) || isNaN(val2)) { errorCount++; continue; } let z = parseFloat(cols[3]) || 0.000; processRawPointToTarget(p, val1, val2, z, "", true); successCount++; } savePointsToStorage(); updateTargetDropdown(); window.plotPointsOnMap(); window.populateAreaPoints(); if(errorCount > 0) alert(`Loaded ${successCount} points.\nSkipped ${errorCount} points.`); else alert(`Loaded ${successCount} points successfully!`); }

window.addManualSetOut = function() { let p = document.getElementById('so_m_p').value || "M1"; let n = parseFloat(document.getElementById('so_m_n').value); let e = parseFloat(document.getElementById('so_m_e').value); if(isNaN(n) || isNaN(e)) return alert("Invalid Coordinates"); processRawPointToTarget(p, n, e, 0, "Manual", false); savePointsToStorage(); window.populateAreaPoints(); alert("Point Added!"); };

function processRawPointToTarget(p, val1, val2, z, desc, skipUI) { let datum = document.getElementById('so_datum') ? document.getElementById('so_datum').value : "WGS_LL"; let tLat = 0, tLon = 0; if (datum === "SVY21") { let r = calc_v2_rev(val2, val1); tLat = r.lat; tLon = r.lon; } else if (datum === "WGS_LL") { tLat = val1; tLon = val2; } else if (datum === "GLOBAL_UTM") { let zInput = document.getElementById('so_custom_zone'); let hInput = document.getElementById('so_custom_hemi'); let zone = (zInput && zInput.value) ? parseInt(zInput.value) : 47; let hemi = hInput ? hInput.value : 'N'; let calcN = val1; if (hemi === 'S') calcN -= 10000000; let iW = m_inverse(val2, calcN, zone, m_WGS); tLat = iW.lat; tLon = iW.lon; } else { let isMM = datum.startsWith("MM"); let zone = parseInt(datum.slice(-2)); let r = m_inverse(val2, val1, zone, isMM ? m_EVE : m_WGS); if (isMM) { let x = m_llh2xyz(r.lat, r.lon, 0, m_EVE); let w = m_xyz2llh(x.x-m_DX, x.y-m_DY, x.z-m_DZ, m_WGS); tLat = w.lat; tLon = w.lon; } else { tLat = r.lat; tLon = r.lon; } } window.setOutPoints.push({p: p, lat: tLat, lon: tLon, z: z, d: desc}); if (!skipUI) { updateTargetDropdown(); window.plotPointsOnMap(); } }

function updateTargetDropdown() { let sel = document.getElementById('so_target_list'); if(sel) { sel.innerHTML = '<option value="">-- Select Point --</option>'; window.setOutPoints.forEach((pt, idx) => { sel.innerHTML += `<option value="${idx}">${pt.p}</option>`; }); } }
window.selectTarget = function() { let idx = document.getElementById('so_target_list').value; if(idx === "") { window.stopNavigation(); return; } activateTarget(window.setOutPoints[idx]); };

window.addPointToArea = function(idx) {
    let indexPos = window.orderedAreaPoints.indexOf(idx);
    if (indexPos === -1) window.orderedAreaPoints.push(idx);
    else window.orderedAreaPoints.splice(indexPos, 1);

    if (typeof window.populateAreaPoints === "function") window.populateAreaPoints();
    if (typeof window.updateAreaOrderUI === "function") window.updateAreaOrderUI();
    if (window.leafletMap) window.leafletMap.closePopup();
    if (typeof window.plotPointsOnMap === "function") window.plotPointsOnMap();
};

window.updateSetOut = function() {
    if(!window.targetPoint || window.currentLat === 0) return;
    let dist = calcDistance(window.currentLat, window.currentLon, window.targetPoint.lat, window.targetPoint.lon);
    let bearing = calcBearing(window.currentLat, window.currentLon, window.targetPoint.lat, window.targetPoint.lon);
    let arrowRotation = bearing - window.compassAzimuth;
    let soArrow = document.getElementById('so_arrow');
    if (soArrow) soArrow.style.transform = `rotate(${arrowRotation}deg)`;
    let distBox = document.getElementById('so_dist');
    if (distBox) distBox.innerText = dist.toFixed(3) + " m";
    let dLat = (window.targetPoint.lat - window.currentLat) * 111320;
    let dLon = (window.targetPoint.lon - window.currentLon) * (111320 * Math.cos(toRad(window.currentLat)));
    let dirN = dLat >= 0 ? "North" : "South";
    let dirE = dLon >= 0 ? "East" : "West";
    let soGuide = document.getElementById('so_guidance_text');
    if (soGuide) soGuide.innerHTML = `Go ${dirN}: <b>${Math.abs(dLat).toFixed(2)}m</b> | Go ${dirE}: <b>${Math.abs(dLon).toFixed(2)}m</b>`;

    let latlngs = [ [window.currentLat, window.currentLon], [window.targetPoint.lat, window.targetPoint.lon] ];
    if(!window.distanceLine) { window.distanceLine = L.polyline(latlngs, {color: '#ef4444', dashArray: '5, 5', weight: 3}).addTo(window.leafletMap); }
    else { window.distanceLine.setLatLngs(latlngs); }

    // ၂ မီတာအတွင်းရောက်လျှင် အရောင်သာပြောင်းမည် (အသံ/တုန်ခါမှု မပါတော့ပါ)
    if(dist <= 2.0) {
        if (distBox) distBox.classList.add('success');
        if(window.distanceLine) window.distanceLine.setStyle({opacity: 0});
        if(window.markerTarget) window.markerTarget.setStyle({fillOpacity: 0.2, color: 'rgba(0,0,0,0.2)'});
    } else {
        if (distBox) distBox.classList.remove('success');
        if(window.distanceLine) window.distanceLine.setStyle({opacity: 1});
        if(window.markerTarget) window.markerTarget.setStyle({fillOpacity: 1, color: '#1e3a8a'});
    }
};

window.toggleCheckboxArea = function(idx, isChecked) { let indexPos = window.orderedAreaPoints.indexOf(idx); if (isChecked && indexPos === -1) window.orderedAreaPoints.push(idx); else if (!isChecked && indexPos !== -1) window.orderedAreaPoints.splice(indexPos, 1); window.updateAreaOrderUI(); window.plotPointsOnMap(); };
window.updateAreaOrderUI = function() { let orderTextSpan = document.getElementById('area_order_text'); if (!orderTextSpan) return; if (window.orderedAreaPoints.length === 0) { orderTextSpan.innerHTML = "None"; orderTextSpan.style.color = "#ef4444"; } else { let textArray = window.orderedAreaPoints.map((idx, step) => `<b>${step+1}.</b> ${window.setOutPoints[idx].p}`); orderTextSpan.innerHTML = textArray.join(" ➔ "); orderTextSpan.style.color = "#059669"; } };
window.populateAreaPoints = function() { let listDiv = document.getElementById('area_point_list'); if (!listDiv) return; listDiv.innerHTML = ''; if (window.setOutPoints.length === 0) { listDiv.innerHTML = '<p style="text-align:center; opacity:0.5; font-size:12px; margin: 10px 0;">No Set Out points available. Load CSV first.</p>'; return; } window.setOutPoints.forEach((pt, index) => { let item = document.createElement('div'); item.className = 'area-pt-item'; let isChecked = window.orderedAreaPoints.includes(index) ? 'checked' : ''; item.innerHTML = `<input type="checkbox" id="chk_pt_${index}" value="${index}" ${isChecked} onchange="window.toggleCheckboxArea(${index}, this.checked)"><label for="chk_pt_${index}" style="cursor:pointer; flex:1;">[${pt.p}] - Lat: ${pt.lat.toFixed(5)}, Lon: ${pt.lon.toFixed(5)}</label>`; listDiv.appendChild(item); }); };

window.calculateAreaFromSelection = function() {
    if (window.orderedAreaPoints.length < 3) return alert("⚠️ Please select at least 3 points in order!");
    let selectedPointsForCalc = []; let latlngsForMap = [];
    let datum = document.getElementById('cogo_datum') ? document.getElementById('cogo_datum').value : "WGS_LL";
    window.orderedAreaPoints.forEach(idx => {
        let pt = window.setOutPoints[idx]; let targetN = 0, targetE = 0;
        let autoZone = Math.floor((pt.lon + 180) / 6) + 1;

        if (datum === "SVY21") { let pW = calc_v2_fwd(pt.lat, pt.lon); targetN = pW.N; targetE = pW.E; }
        else if (datum.startsWith("WGS_UTM")) { let pW = m_project(pt.lat, pt.lon, autoZone, m_WGS); targetN = pW.n; targetE = pW.e; }
        else if (datum.startsWith("MM")) { let x = m_llh2xyz(pt.lat, pt.lon, 0, m_WGS); let mL = m_xyz2llh(x.x + m_DX, x.y + m_DY, x.z + m_DZ, m_EVE); let pM = m_project(mL.lat, mL.lon, autoZone, m_EVE); targetN = pM.n; targetE = pM.e; }
        else if (datum === "GLOBAL_UTM") { let zInput = document.getElementById('cogo_custom_zone'); let hInput = document.getElementById('cogo_custom_hemi'); let zone = (zInput && zInput.value) ? parseInt(zInput.value) : autoZone; let hemi = hInput ? hInput.value : 'N'; let pW = m_project(pt.lat, pt.lon, zone, m_WGS); targetN = pW.n; targetE = pW.e; if(hemi === 'S') targetN += 10000000; }
        else { let pW = m_project(pt.lat, pt.lon, autoZone, m_WGS); targetN = pW.n; targetE = pW.e; }
        selectedPointsForCalc.push({ n: targetN, e: targetE }); latlngsForMap.push([pt.lat, pt.lon]);
    });
    let areaSqMeters = calcPolygonArea(selectedPointsForCalc); let areaSqFeet = areaSqMeters * 10.7639104; let areaAcres = areaSqMeters / 4046.85642; let areaHectares = areaSqMeters / 10000.0; document.getElementById('res_sqm').innerText = areaSqMeters.toFixed(3); document.getElementById('res_sqft').innerText = areaSqFeet.toFixed(3); document.getElementById('res_acre').innerText = areaAcres.toFixed(4); document.getElementById('res_hectare').innerText = areaHectares.toFixed(4); document.getElementById('area_result_box').classList.remove('hidden');
    if (window.leafletMap) { if (window.areaPolygonLayer) window.leafletMap.removeLayer(window.areaPolygonLayer); window.areaPolygonLayer = L.polygon(latlngsForMap, { color: '#3b82f6', weight: 3, fillColor: '#60a5fa', fillOpacity: 0.4 }).addTo(window.leafletMap); window.leafletMap.fitBounds(window.areaPolygonLayer.getBounds(), { padding: [30, 30] }); window.isAutoCenter = false; let btn = document.getElementById('autoCenterBtn'); if (btn) btn.classList.remove('active'); }
};

window.clearAreaResultOnly = function() { let resBox = document.getElementById('area_result_box'); if(resBox) resBox.classList.add('hidden'); if (window.leafletMap && window.areaPolygonLayer) { window.leafletMap.removeLayer(window.areaPolygonLayer); window.areaPolygonLayer = null; } };
window.clearAreaCalc = function() { window.orderedAreaPoints = []; window.updateAreaOrderUI(); let checkboxes = document.querySelectorAll('#area_point_list input[type="checkbox"]'); checkboxes.forEach(chk => chk.checked = false); window.clearAreaResultOnly(); window.plotPointsOnMap(); };

window.startMapSetOutFromTopo = function(topoIndex) {
    let tPt = window.recordedPointsBank[topoIndex];
    let exists = window.setOutPoints.findIndex(s => s.p === tPt.p && s.lat === tPt.wLa && s.lon === tPt.wLo);
    if (exists === -1) {
        window.setOutPoints.push({p: tPt.p, lat: tPt.wLa, lon: tPt.wLo, z: tPt.z, d: tPt.d});
        savePointsToStorage(); updateTargetDropdown(); window.plotPointsOnMap();
        exists = window.setOutPoints.length - 1;
    }
    window.startMapSetOut(exists);
};

window.addTopoPointToArea = function(topoIndex) {
    let tPt = window.recordedPointsBank[topoIndex];
    let exists = window.setOutPoints.findIndex(s => s.p === tPt.p && s.lat === tPt.wLa && s.lon === tPt.wLo);
    if (exists === -1) {
        window.setOutPoints.push({p: tPt.p, lat: tPt.wLa, lon: tPt.wLo, z: tPt.z, d: tPt.d});
        savePointsToStorage(); updateTargetDropdown(); window.plotPointsOnMap(); window.populateAreaPoints();
        exists = window.setOutPoints.length - 1;
    }
    window.addPointToArea(exists);
};

// ==========================================
// --- KML EXPORTS ---
// ==========================================
window.exportDxfToKml = function() {
    if (!window.rawDxfEntities || window.rawDxfEntities.length === 0) return alert("Please load a DXF file first!");
    let kmlString = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Exported_DXF.kml</name>\n    <description>Generated by Survey Pro</description>`;
    document.getElementById('dxf_status').innerHTML = `⏳ Converting to KML...`;
    window.rawDxfEntities.forEach(ent => {
        try {
            if (ent.type === 'LINE') { let s = window.dxfToLatLon(ent.vertices[0].x, ent.vertices[0].y); let e = window.dxfToLatLon(ent.vertices[1].x, ent.vertices[1].y); if (!isNaN(s.lat) && !isNaN(e.lat)) { kmlString += `\n    <Placemark><LineString><coordinates>${s.lon},${s.lat},0 ${e.lon},${e.lat},0</coordinates></LineString></Placemark>`; } }
            else if (ent.type === 'POLYLINE' || ent.type === 'LWPOLYLINE') { let coords = ""; ent.vertices.forEach(v => { let p = window.dxfToLatLon(v.x, v.y); if (!isNaN(p.lat)) coords += `${p.lon},${p.lat},0 `; }); if (ent.shape === true && ent.vertices.length > 0) { let p0 = window.dxfToLatLon(ent.vertices[0].x, ent.vertices[0].y); coords += `${p0.lon},${p0.lat},0 `; } if (coords.trim().length > 0) { kmlString += `\n    <Placemark><LineString><coordinates>${coords.trim()}</coordinates></LineString></Placemark>`; } }
            else if (ent.type === 'POINT') { let px = ent.position ? ent.position.x : ent.x; let py = ent.position ? ent.position.y : ent.y; let pt = window.dxfToLatLon(px, py); if (!isNaN(pt.lat)) { kmlString += `\n    <Placemark><Point><coordinates>${pt.lon},${pt.lat},0</coordinates></Point></Placemark>`; } }
            else if (ent.type === 'TEXT' || ent.type === 'MTEXT') { let p = window.dxfToLatLon(ent.startPoint.x, ent.startPoint.y); if (!isNaN(p.lat)) { let cleanText = ent.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); kmlString += `\n    <Placemark><name>${cleanText}</name><Point><coordinates>${p.lon},${p.lat},0</coordinates></Point></Placemark>`; } }
        } catch(err) {}
    });
    kmlString += `\n  </Document>\n</kml>`;
    document.getElementById('dxf_status').innerHTML = `✅ KML Export Ready!`;
    let fileName = `SurveyPro_DXF_${new Date().getTime()}.kml`;
    if (window.AndroidNative && window.AndroidNative.downloadConvertedKML) { window.AndroidNative.downloadConvertedKML(kmlString, fileName); }
    else { let blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8;' }); let link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
};

window.exportPointsToKml = function() {
    if (window.setOutPoints.length === 0) return alert("No points to export!");
    let kmlString = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Exported_Points.kml</name>\n    <description>Generated by Survey Pro</description>`;
    window.setOutPoints.forEach(pt => {
        let cleanDesc = pt.d ? pt.d.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
        kmlString += `\n    <Placemark>\n      <name>${pt.p}</name>\n      <description>${cleanDesc}</description>\n      <Point>\n        <coordinates>${pt.lon},${pt.lat},${pt.z}</coordinates>\n      </Point>\n    </Placemark>`;
    });
    kmlString += `\n  </Document>\n</kml>`;
    let fileName = `SurveyPro_Points_${new Date().getTime()}.kml`;
    if (window.AndroidNative && window.AndroidNative.downloadConvertedKML) { window.AndroidNative.downloadConvertedKML(kmlString, fileName); }
    else { let blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8;' }); let link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
};

// ==========================================
// --- COGO TOOL SELECTOR LOGIC (Main Menu & Back) ---
// ==========================================

window.openCogoTool = function(toolName) {
    document.getElementById('cogo_main_menu').classList.add('hidden');
    document.getElementById('cogo_tool_container').classList.remove('hidden');

    document.getElementById('cogo_area_tool').classList.add('hidden');
    document.getElementById('cogo_inv_tool').classList.add('hidden');
    document.getElementById('cogo_grad_tool').classList.add('hidden');

    let titleEl = document.getElementById('cogo_tool_title');
    let mapContainer = document.getElementById('shared_map_view');
    let gpsBtn = document.getElementById('globalGpsBtn');

    if (window.isNativeGPSActive && toolName !== 'area') { window.toggleGlobalGPS(); }

    if (toolName === 'area') {
        document.getElementById('cogo_area_tool').classList.remove('hidden');
        titleEl.innerText = '📐 Area Calculator'; titleEl.style.color = '#10b981';
        mapContainer.classList.remove('hidden'); gpsBtn.classList.remove('hidden');
        if(window.leafletMap) setTimeout(() => { window.leafletMap.invalidateSize(); }, 300);
    } else if (toolName === 'inv') {
        document.getElementById('cogo_inv_tool').classList.remove('hidden');
        titleEl.innerText = '🧭 Bearing & Distance'; titleEl.style.color = '#8b5cf6';
        mapContainer.classList.add('hidden'); gpsBtn.classList.add('hidden');
    } else if (toolName === 'grad') {
        document.getElementById('cogo_grad_tool').classList.remove('hidden');
        titleEl.innerText = '📈 Gradient / Elevation'; titleEl.style.color = '#b91c1c';
        mapContainer.classList.add('hidden'); gpsBtn.classList.add('hidden');
    }

    // 🔴 Tool ပွင့်လာလျှင် Back နှိပ်ရန်အတွက် မှတ်ဉာဏ်တစ်ခု ထည့်ထားမည်
    history.pushState({subTool: toolName}, "Cogo Tool", "");
};

window.closeCogoTool = function(isFromBack = false) {
    document.getElementById('cogo_tool_container').classList.add('hidden');
    document.getElementById('cogo_main_menu').classList.remove('hidden');
    document.getElementById('shared_map_view').classList.add('hidden');
    document.getElementById('globalGpsBtn').classList.add('hidden');

    // User က UI ပေါ်က "Home" ကို နှိပ်ပြီး ထွက်တာဆိုရင်
    if (!isFromBack) {
        window.history.back(); // History ရှင်းလင်းရန် back() ခေါ်ပေးသည်
    }
};

// ==========================================
// --- BEARING & DISTANCE UI LOGIC ---
// ==========================================

window.swapInversePoints = function() {
    let aN = document.getElementById('inv_a_n').value; let aE = document.getElementById('inv_a_e').value;
    let bN = document.getElementById('inv_b_n').value; let bE = document.getElementById('inv_b_e').value;
    document.getElementById('inv_a_n').value = bN; document.getElementById('inv_a_e').value = bE;
    document.getElementById('inv_b_n').value = aN; document.getElementById('inv_b_e').value = aE;
    if (bN !== "" && bE !== "" && aN !== "" && aE !== "") window.calcInverse();
};

window.isBrgDmsMode = false;

window.toggleBearingMode = function() {
    window.isBrgDmsMode = !window.isBrgDmsMode;
    let btn = document.getElementById('btn_brg_mode');
    let decDiv = document.getElementById('inv_brg_dec_div');
    let dmsDiv = document.getElementById('inv_brg_dms_div');

    if (window.isBrgDmsMode) {
        btn.innerText = "Mode: DMS";
        btn.style.background = "#dbeafe";
        decDiv.style.display = 'none';
        dmsDiv.style.display = 'flex';
    } else {
        btn.innerText = "Mode: Decimal";
        btn.style.background = "#e2e8f0";
        decDiv.style.display = 'block';
        dmsDiv.style.display = 'none';
    }
};

window.calcInverse = function() {
    let n1 = parseFloat(document.getElementById('inv_a_n').value); let e1 = parseFloat(document.getElementById('inv_a_e').value);
    let n2 = parseFloat(document.getElementById('inv_b_n').value); let e2 = parseFloat(document.getElementById('inv_b_e').value);
    if (isNaN(n1) || isNaN(e1) || isNaN(n2) || isNaN(e2)) return alert("Please enter valid coordinates for both Point A and B.");

    let result = calcGridInverse(n1, e1, n2, e2);

    document.getElementById('inv_dist').value = result.dist.toFixed(4);
    document.getElementById('inv_brg_dec').value = result.bearing.toFixed(4);

    let d = Math.floor(result.bearing);
    let minFloat = (result.bearing - d) * 60;
    let m = Math.floor(minFloat);
    let s = ((minFloat - m) * 60).toFixed(2);

    document.getElementById('inv_brg_d').value = d;
    document.getElementById('inv_brg_m').value = m;
    document.getElementById('inv_brg_s').value = s;

    let resBox = document.getElementById('inv_result_dms');
    resBox.style.display = "block";
    resBox.innerText = `Brg: ${d}° ${m}' ${s}" | Dist: ${result.dist.toFixed(3)}m`;
    resBox.style.background = "rgba(16, 185, 129, 0.1)"; resBox.style.borderColor = "rgba(16, 185, 129, 0.3)"; resBox.style.color = "#059669";
};

window.calcTraverse = function() {
    let n1 = parseFloat(document.getElementById('inv_a_n').value); let e1 = parseFloat(document.getElementById('inv_a_e').value);
    let dist = parseFloat(document.getElementById('inv_dist').value);

    let brgDec = 0;
    if (window.isBrgDmsMode) {
        let d = parseFloat(document.getElementById('inv_brg_d').value) || 0;
        let m = parseFloat(document.getElementById('inv_brg_m').value) || 0;
        let s = parseFloat(document.getElementById('inv_brg_s').value) || 0;
        brgDec = d + (m / 60) + (s / 3600);
    } else {
        brgDec = parseFloat(document.getElementById('inv_brg_dec').value);
    }

    if (isNaN(n1) || isNaN(e1) || isNaN(dist) || isNaN(brgDec)) return alert("Please enter Point A, Distance, and Bearing.");

    let result = calcGridTraverse(n1, e1, dist, brgDec);

    document.getElementById('inv_b_n').value = result.n.toFixed(4); document.getElementById('inv_b_e').value = result.e.toFixed(4);

    let resBox = document.getElementById('inv_result_dms');
    resBox.style.display = "block";
    resBox.innerText = `✅ Target Point B Calculated!`;
    resBox.style.background = "rgba(59, 130, 246, 0.1)"; resBox.style.borderColor = "rgba(59, 130, 246, 0.3)"; resBox.style.color = "#1e40af";
};


// ==========================================
// --- GRADIENT UI LOGIC ---
// ==========================================

window.clearGradient = function() {
    document.getElementById('grad_dist').value = "";
    document.getElementById('grad_z1').value = "";
    document.getElementById('grad_z2').value = "";
    document.getElementById('grad_pct').value = "";
    document.getElementById('grad_result').style.display = "none";
};

window.calcGradientFromZ = function() {
    let dist = parseFloat(document.getElementById('grad_dist').value);
    let z1 = parseFloat(document.getElementById('grad_z1').value);
    let z2 = parseFloat(document.getElementById('grad_z2').value);

    if (isNaN(dist) || isNaN(z1) || isNaN(z2)) {
        return alert("Please enter Distance, Z1, and Z2.");
    }
    if (dist <= 0) return alert("Distance must be greater than zero.");

    let pct = calcGradientPercentage(dist, z1, z2);
    document.getElementById('grad_pct').value = pct.toFixed(3);

    let resBox = document.getElementById('grad_result');
    resBox.style.display = "block";

    let direction = (pct >= 0) ? "UP (Rise) 📈" : "DOWN (Fall) 📉";
    let ratio = Math.abs(100 / pct);
    resBox.innerHTML = `Direction: ${direction}<br>Gradient: <b>${pct.toFixed(3)} %</b><br>Ratio (1 : N) = <b>1 : ${ratio.toFixed(2)}</b>`;
};

window.calcZ2FromGradient = function() {
    let dist = parseFloat(document.getElementById('grad_dist').value);
    let z1 = parseFloat(document.getElementById('grad_z1').value);
    let gradInput = document.getElementById('grad_pct').value.trim();

    if (isNaN(dist) || isNaN(z1) || gradInput === "") {
        return alert("Please enter Distance, Z1, and Gradient (% or 1:N).");
    }

    let pct = 0;
    if (gradInput.includes(":")) {
        let parts = gradInput.split(":");
        if (parts.length === 2) {
            let nVal = parseFloat(parts[1]);
            if (!isNaN(nVal) && nVal !== 0) {
                pct = (1 / nVal) * 100;
            } else {
                return alert("Invalid Ratio format. Example: 1:40 or 1:-50");
            }
        }
    } else {
        pct = parseFloat(gradInput);
        if (isNaN(pct)) return alert("Invalid Gradient value.");
    }

    let z2 = calcZ2FromPercentage(dist, z1, pct);
    document.getElementById('grad_z2').value = z2.toFixed(3);

    let resBox = document.getElementById('grad_result');
    resBox.style.display = "block";
    resBox.innerHTML = `✅ End Elevation (Z2) Calculated:<br><span style="font-size:16px;"><b>${z2.toFixed(3)} m</b></span><br><span style="font-size:12px; color:#1e40af;">(Using Gradient: ${pct.toFixed(3)}%)</span>`;
};

// ==========================================
// --- TOPO / RECORDED POINTS ON MAP ---
// ==========================================

window.plotRecordedPointsOnMap = function() {
    if (!window.leafletMap) return;
    if (!window.recordedLayerGroup) { window.recordedLayerGroup = L.layerGroup().addTo(window.leafletMap); }
    window.recordedLayerGroup.clearLayers();

    window.recordedPointsBank.forEach((pt, index) => {
        // အရင် Data အဟောင်းများကြောင့် (pt.wLa မရှိဘဲ pt.lat သာရှိနေပါက) Error မတက်စေရန်
        let pLat = pt.wLa !== undefined ? pt.wLa : pt.lat;
        let pLon = pt.wLo !== undefined ? pt.wLo : pt.lon;
        if (pLat === undefined || pLon === undefined || isNaN(pLat) || isNaN(pLon)) return;

        let topoIcon = L.divIcon({
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            html: '<div style="width:14px; height:14px; background:#fef08a; border:3px solid #000; border-radius:50%; margin:11px auto; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>'
        });

        let ptMarker = L.marker([pLat, pLon], { icon: topoIcon });
        ptMarker.bindTooltip(pt.p, { permanent: true, direction: 'right', className: 'topo-tooltip', offset: [10, 0] });

        ptMarker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);

            // ပေတံ (Measure Tool) ယူထားရင် Popup မပြဘဲ Distance တိုင်းမည်
            if (window.isMeasuring) {
                window.leafletMap.fireEvent('click', {latlng: e.latlng});
            }
            else {
                let popupContent = `<div style="text-align:center; padding: 5px; min-width: 120px;">
                                    <b style="font-size:14px; color:#f59e0b;">Point: ${pt.p}</b><br>
                                    <span style="font-size:12px; color:#1e3a8a;">Code: ${pt.d || 'None'}</span><br>`;

                if (window.activeApp === 3) { popupContent += `<button class="so-popup-btn" style="background:#2563eb; width:100%; margin-top:8px;" onclick="window.startMapSetOutFromTopo(${index})">🎯 Set Out</button>`; }
                else if (window.activeApp === 4) { popupContent += `<button class="so-popup-btn" style="background:#10b981; width:100%; margin-top:8px;" onclick="window.addTopoPointToArea(${index})">➕ Add to Area</button>`; }
                else { popupContent += `<button class="so-popup-btn" style="background:#ef4444; width:100%; margin-top:8px;" onclick="window.deleteRecordedPoint(${index})">🗑️ Delete Point</button>`; }

                popupContent += `</div>`;
                L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(window.leafletMap);
            }
        });
        ptMarker.addTo(window.recordedLayerGroup);
    });
};