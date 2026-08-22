// --- MATH FUNCTIONS & CONSTANTS ---
const v_a = 6378137, v_f = 1/298.257223563;
const v_oLa = 1.3666666666666667 * Math.PI / 180;
const v_oLo = 103.83333333333333 * Math.PI / 180;
const v_N = 38744.572, v_E = 28001.642;

function v_cM(l) { let e = 2*v_f - v_f*v_f; return v_a * ((1 - e/4 - 3*e*e/64 - 5*Math.pow(e,3)/256)*l - (3*e/8 + 3*e*e/32 + 45*Math.pow(e,3)/1024)*Math.sin(2*l) + (15*e*e/256 + 45*Math.pow(e,3)/1024)*Math.sin(4*l)); }
function calc_v2_fwd(la, lo) { let e = 2*v_f - v_f*v_f, l = la*Math.PI/180; let dL = (lo*Math.PI/180) - v_oLo; let s = Math.sin(l), c = Math.cos(l), t = Math.tan(l); let v = v_a / Math.sqrt(1 - e*s*s); let p = v_a*(1-e) / Math.pow(1 - e*s*s, 1.5); let ps = v/p, M = v_cM(l), Mo = v_cM(v_oLa); let N = v_N + (M - Mo + v*s*c*dL*dL/2 + v*s*Math.pow(c,3)*Math.pow(dL,4)/24*(4*ps*ps + ps - t*t)); let E = v_E + (v*dL*c + v*Math.pow(dL,3)*Math.pow(c,3)/6*(ps - t*t)); return {N: N, E: E}; }
function calc_v2_rev(E, N) { let e = 2*v_f - v_f*v_f; let M = v_cM(v_oLa) + (N - v_N); let n = v_f/(2-v_f); let G = v_a*(1-n)*(1-n*n)*(1 + 9/4*n*n)*Math.PI/180; let u = (M/G)*(Math.PI/180); let l = u + (3*n/2 - 27/32*Math.pow(n,3))*Math.sin(2*u) + (21/16*n*n)*Math.sin(4*u); let s = Math.sin(l), c = Math.cos(l), t = Math.tan(l); let v = v_a / Math.sqrt(1 - e*s*s); let p = v_a*(1-e) / Math.pow(1 - e*s*s, 1.5); let dE = E - v_E; let lat = (l - (t/p)*(dE*dE/(2*v))) * 180/Math.PI; let lon = (v_oLo + (dE/(v*c) - Math.pow(dE,3)/(6*Math.pow(v,3)*c)*(1 + 2*t*t))) * 180/Math.PI; return {lat: lat, lon: lon}; }

const m_DX=-246.632, m_DY=-784.833, m_DZ=-276.923;
const m_WGS={a:6378137, f:1/298.257223563};
const m_EVE={a:6377276.345, f:1/300.8017};

function m_llh2xyz(la, lo, h, ell) { let p = la*Math.PI/180, l = lo*Math.PI/180; let e = 2*ell.f - ell.f*ell.f; let N = ell.a / Math.sqrt(1 - e*Math.sin(p)*Math.sin(p)); return { x: (N+h)*Math.cos(p)*Math.cos(l), y: (N+h)*Math.cos(p)*Math.sin(l), z: (N*(1-e)+h)*Math.sin(p) }; }
function m_xyz2llh(x, y, z, ell) { let e = 2*ell.f - ell.f*ell.f; let lo = Math.atan2(y, x), p = Math.sqrt(x*x + y*y); let la = Math.atan2(z, p*(1-e)), la0, N, h; do { la0 = la; N = ell.a / Math.sqrt(1 - e*Math.sin(la)*Math.sin(la)); h = p/Math.cos(la) - N; la = Math.atan2(z, p*(1 - e*(N/(N+h)))); } while (Math.abs(la - la0) > 1e-15); return {lat: la*180/Math.PI, lon: lo*180/Math.PI}; }
function m_project(la, lo, z, ell) { let a = ell.a, f = ell.f, e = 2*f - f*f; let p = la*Math.PI/180, lm = lo*Math.PI/180; let cm = (z*6 - 183)*Math.PI/180; let ep = e/(1-e); let N = a / Math.sqrt(1 - e*Math.sin(p)*Math.sin(p)); let T = Math.pow(Math.tan(p), 2); let C = ep * Math.pow(Math.cos(p), 2); let A = (lm - cm) * Math.cos(p); let M = a * ((1 - e/4 - 3*e*e/64 - 5*Math.pow(e,3)/256)*p - (3*e/8 + 3*e*e/32 + 45*Math.pow(e,3)/1024)*Math.sin(2*p) + (15*e*e/256 + 45*Math.pow(e,3)/1024)*Math.sin(4*p) - (35*Math.pow(e,3)/3072)*Math.sin(6*p)); let easting = 500000 + 0.9996 * N * (A + (1 - T + C)*Math.pow(A,3)/6 + (5 - 18*T + T*T + 72*C - 58*ep)*Math.pow(A,5)/120); let northing = 0.9996 * (M + N*Math.tan(p)*(A*A/2 + (5 - T + 9*C + 4*C*C)*Math.pow(A,4)/24 + (61 - 58*T + T*T + 600*C - 330*ep)*Math.pow(A,6)/720)); return {e: easting, n: northing}; }
function m_inverse(E, N, z, ell) { let a = ell.a, f = ell.f, e = 2*f - f*f; let x = E - 500000; let cm = (z*6 - 183)*Math.PI/180; let M = N / 0.9996; let mu = M / (a*(1 - e/4 - 3*e*e/64 - 5*Math.pow(e,3)/256)); let e1 = (1 - Math.sqrt(1 - e)) / (1 + Math.sqrt(1 - e)); let p1 = mu + (3*e1/2 - 27*Math.pow(e1,3)/32)*Math.sin(2*mu) + (21*e1*e1/16 - 55*Math.pow(e1,4)/32)*Math.sin(4*mu) + (151*Math.pow(e1,3)/96)*Math.sin(6*mu); let N1 = a / Math.sqrt(1 - e*Math.sin(p1)*Math.sin(p1)); let T1 = Math.pow(Math.tan(p1), 2); let R1 = a*(1 - e) / Math.pow(1 - e*Math.sin(p1)*Math.sin(p1), 1.5); let D = x / (N1*0.9996); let C1 = (e/(1 - e)) * Math.pow(Math.cos(p1), 2); let lat = (p1 - (N1*Math.tan(p1)/R1)*(D*D/2 - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*(e/(1-e)))*Math.pow(D,4)/24 + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*(e/(1-e)) - 3*C1*C1)*Math.pow(D,6)/720)) * 180/Math.PI; let lon = (cm + (D - (1 + 2*T1 + C1)*Math.pow(D,3)/6 + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*(e/(1-e)) + 24*T1*T1)*Math.pow(D,5)/120)/Math.cos(p1)) * 180/Math.PI; return {lat: lat, lon: lon}; }

const baseMyanmarGrid=[[-51,-49.6,-48.2,-46.9,-45.5,-44.1,-42.8,-41.5,-40.1,-38.8,-37.5],[-51.8,-50.4,-49,-47.6,-46.3,-44.9,-43.6,-42.3,-41,-39.7,-38.4],[-52.5,-51.1,-49.8,-48.4,-47.1,-45.8,-44.5,-43.2,-41.9,-40.6,-39.4],[-53.1,-51.8,-50.5,-49.2,-47.9,-46.6,-45.3,-44,-42.7,-41.4,-40.2],[-53.8,-52.5,-51.2,-49.9,-48.6,-47.3,-46,-44.8,-43.5,-42.2,-41],[-54.4,-53.1,-51.8,-50.5,-49.3,-48,-46.7,-45.5,-44.2,-43,-41.8],[-54.9,-53.7,-52.4,-51.2,-49.9,-48.7,-47.4,-46.2,-44.9,-43.7,-42.5],[-55.3,-54.1,-52.9,-51.7,-50.4,-49.2,-48,-46.8,-45.6,-44.4,-43.2],[-55.7,-54.5,-53.3,-52.1,-50.9,-49.7,-48.5,-47.4,-46.2,-45.1,-43.9],[-55.9,-54.8,-53.6,-52.4,-51.3,-50.1,-49,-47.8,-46.7,-45.6,-44.5],[-56.1,-55,-53.8,-52.7,-51.6,-50.5,-49.4,-48.3,-47.2,-46.1,-45],[-56.1,-55,-53.9,-52.8,-51.7,-50.7,-49.6,-48.6,-47.5,-46.5,-45.4],[-56,-55,-53.9,-52.9,-51.8,-50.8,-49.8,-48.8,-47.8,-46.8,-45.8],[-55.8,-54.8,-53.7,-52.7,-51.7,-50.8,-49.8,-48.9,-47.9,-47,-46.1],[-55.5,-54.5,-53.5,-52.6,-51.6,-50.7,-49.8,-48.9,-48,-47.2,-46.3],[-55.1,-54.1,-53.1,-52.2,-51.3,-50.4,-49.6,-48.7,-47.9,-47.1,-46.4],[-54.6,-53.7,-52.7,-51.9,-51,-50.2,-49.4,-48.6,-47.9,-47.2,-46.4],[-54,-53.1,-52.2,-51.4,-50.5,-49.8,-49,-48.3,-47.7,-47,-46.3],[-53.3,-52.4,-51.5,-50.8,-50,-49.3,-48.6,-48,-47.4,-46.8,-46.2],[-52.5,-51.6,-50.8,-50.1,-49.4,-48.8,-48.1,-47.6,-47,-46.5,-45.9],[-51.6,-50.8,-50,-49.4,-48.7,-48.1,-47.5,-47,-46.5,-46.1,-45.6]];
const baseSgGrid=[[8.5,9.2],[7.8,8.4]];
function expandTo025Grid(g){let r=[];for(let i=0;i<(g.length-1)*4+1;i++){let R=[];let r0=Math.floor(i/4),r1=Math.min(r0+1,g.length-1),dr=i/4-r0;for(let j=0;j<(g[0].length-1)*4+1;j++){let c0=Math.floor(j/4),c1=Math.min(c0+1,g[0].length-1),dc=j/4-c0;R.push(g[r0][c0]*(1-dr)*(1-dc)+g[r0][c1]*(1-dr)*dc+g[r1][c0]*dr*(1-dc)+g[r1][c1]*dr*dc);}r.push(R);}return r;}
const myanmarGeoid={lat0:9,lon0:92,dLat:0.25,dLon:0.25,grid:expandTo025Grid(baseMyanmarGrid)};
const sgGeoid={lat0:1,lon0:103,dLat:0.25,dLon:0.25,grid:expandTo025Grid(baseSgGrid)};

function getOfflineEGM96(la,lo){let m=null;if(la>=9&&la<=29&&lo>=92&&lo<=102)m=myanmarGeoid;else if(la>=1&&la<=2&&lo>=103&&lo<=104)m=sgGeoid;if(!m)return 0;let r=(la-m.lat0)/m.dLat,c=(lo-m.lon0)/m.dLon,r0=Math.floor(r),c0=Math.floor(c),dr=r-r0,dc=c-c0;let r1=r0+1>=m.grid.length?r0:r0+1,c1=c0+1>=m.grid[0].length?c0:c0+1;return (m.grid[r0][c0]*(1-dc)+m.grid[r0][c1]*dc)*(1-dr)+(m.grid[r1][c0]*(1-dc)+m.grid[r1][c1]*dc)*dr;}

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }
function calcDistance(lat1, lon1, lat2, lon2) { let R = 6371e3, dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1); let a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2); return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); }
function calcBearing(lat1, lon1, lat2, lon2) { let dLon = toRad(lon2-lon1); lat1 = toRad(lat1); lat2 = toRad(lat2); let y = Math.sin(dLon) * Math.cos(lat2); let x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon); return (toDeg(Math.atan2(y, x)) + 360) % 360; }
function m_toDMS(dd,isLat){ let a=Math.abs(dd),d=Math.floor(a),m=Math.floor((a-d)*60),s=((a-d-m/60)*3600).toFixed(3); return `${d}° ${m}' ${s}" ${isLat?(dd>=0?"N":"S"):(dd>=0?"E":"W")}`; }
function getUTMZoneString(la,lo){let z=Math.floor((lo+180)/6)+1,h=la>=0?'N':'S',b="CDEFGHJKLMNPQRSTUVWXX".charAt(Math.min(Math.max(Math.floor((la+80)/8),0),20));return `Zone ${z}${h} (${b})`;}

// ==========================================
// --- AREA CALCULATION (SHOELACE FORMULA) ---
// ==========================================
function calcPolygonArea(points) {
    let numPoints = points.length;
    // အနည်းဆုံး Point ၃ ခု (တြိဂံပုံ) ရှိမှ ဧရိယာတွက်လို့ရပါမည်
    if (numPoints < 3) return 0.0;

    let area = 0.0;
    for (let i = 0; i < numPoints; i++) {
        let j = (i + 1) % numPoints; // နောက်ဆုံး Point ကို ပထမ Point နှင့် ပြန်ဆက်ရန်
        // Easting(X) နှင့် Northing(Y) ကို ကြက်ခြေခတ် မြှောက်ခြင်း
        area += (points[i].e * points[j].n) - (points[j].e * points[i].n);
    }

    // အနုတ်ထွက်နေပါက အပေါင်းပြောင်း၍ ၂ ဖြင့်စားပါမည်
    return Math.abs(area) / 2.0;
}

// ==========================================
// --- COGO CALCULATIONS (GRID INVERSE & TRAVERSE) ---
// ==========================================

// Decimal Degree မှ DMS String သို့ ပြောင်းရန်
function toDmsString(dec) {
    let d = Math.floor(dec);
    let minFloat = (dec - d) * 60;
    let m = Math.floor(minFloat);
    let s = ((minFloat - m) * 60).toFixed(2);
    return `${d}° ${m}' ${s}"`;
}

// 1. Grid Inverse (N1, E1 -> N2, E2 မှ Distance, Bearing ရှာခြင်း)
function calcGridInverse(n1, e1, n2, e2) {
    let dN = n2 - n1;
    let dE = e2 - e1;

    // Distance (Pythagoras)
    let dist = Math.sqrt((dN * dN) + (dE * dE));

    // Bearing (atan2)
    let angleRad = Math.atan2(dE, dN);
    let bearingDeg = angleRad * (180 / Math.PI);
    if (bearingDeg < 0) bearingDeg += 360;

    return { dist: dist, bearing: bearingDeg };
}

// 2. Grid Traverse (N1, E1 + Dist + Bearing မှ N2, E2 ရှာခြင်း)
function calcGridTraverse(n1, e1, dist, bearingDeg) {
    let angleRad = bearingDeg * (Math.PI / 180);

    // Calculate Northing & Easting
    let n2 = n1 + (dist * Math.cos(angleRad));
    let e2 = e1 + (dist * Math.sin(angleRad));

    return { n: n2, e: e2 };
}

// ==========================================
// --- GRADIENT CALCULATIONS ---
// ==========================================

function calcGradientPercentage(dist, z1, z2) {
    if (dist === 0) return 0;
    let dZ = z2 - z1;
    return (dZ / dist) * 100;
}

function calcZ2FromPercentage(dist, z1, pct) {
    return z1 + (dist * (pct / 100));
}

// ==========================================
// --- 3D BOWDITCH TRAVERSE ADJUSTMENT ---
// ==========================================

function adjust3dTraverse(type, startCtrl, endCtrl, rawPoints) {
    let n0 = startCtrl.n, e0 = startCtrl.e, z0 = startCtrl.z;
    let n_last = endCtrl.n, e_last = endCtrl.e, z_last = endCtrl.z;

    let D_sum = 0.0;
    let NF = 0.0, EF = 0.0, ZF = 0.0;
    let n_prev = n0, e_prev = e0, z_prev = z0;

    let adjust_data = [];

    // 1. horizontal distance & misclosure တွက်ချက်ခြင်း
    for (let i = 0; i < rawPoints.length; i++) {
        let pt = rawPoints[i];
        let dist = Math.sqrt((pt.e - e_prev)**2 + (pt.n - n_prev)**2); // 2D Horizontal distance
        let d_n = pt.n - n_prev;
        let d_e = pt.e - e_prev;
        let d_z = pt.z - z_prev;

        D_sum += dist;
        NF += d_n;
        EF += d_e;
        ZF += d_z;

        adjust_data.push({
            p: pt.p,
            n_obs: pt.n,
            e_obs: pt.e,
            z_obs: pt.z,
            dist: dist,
            d: pt.d
        });

        n_prev = pt.n; e_prev = pt.e; z_prev = pt.z;
    }

    // 2. Misclosures တွက်ထုတ်ခြင်း (LISP အတိုင်း တွက်နည်းတူတူပါပဲ)
    NF = NF - (n_last - n0);
    EF = EF - (e_last - e0);
    ZF = ZF - (z_last - z0);

    let LCE = Math.sqrt(NF*NF + EF*EF);
    let RP = D_sum > 0 ? LCE / D_sum : 0;

    // 3. Compass/Bowditch Rule အရ အမှားကို အချိုးကျ ခွဲဝေပြင်ဆင်ခြင်း
    let adjusted_points = [];
    let D_accum = 0.0;

    for (let i = 0; i < adjust_data.length; i++) {
        let data = adjust_data[i];
        D_accum += data.dist;

        let N_accum_corr = -NF * (D_accum / D_sum);
        let E_accum_corr = -EF * (D_accum / D_sum);
        let Z_accum_corr = -ZF * (D_accum / D_sum);

        let n_new = data.n_obs + N_accum_corr;
        let e_new = data.e_obs + E_accum_corr;
        let z_new = data.z_obs + Z_accum_corr;

        let NF_corr = N_accum_corr;
        let EF_corr = E_accum_corr;
        let ZF_corr = Z_accum_corr;

        // နောက်ဆုံးမှတ်ကို Control End Point နဲ့ အတိအကျ ကိုက်ညှိပေးခြင်း
        if (i === adjust_data.length - 1) {
            n_new = n_last;
            e_new = e_last;
            z_new = z_last;
        }

        adjusted_points.push({
            p: data.p,
            n_obs: data.n_obs,
            e_obs: data.e_obs,
            z_obs: data.z_obs,
            n_adj: n_new,
            e_adj: e_new,
            z_adj: z_new,
            dn_corr: NF_corr,
            de_corr: EF_corr,
            dz_corr: ZF_corr,
            d: data.d
        });
    }

    // 4. Horizontal Accuracy Classifications (1:R)
    let R_val = RP > 0 ? 1.0 / RP : 0;
    let class_text = "";
    let status_text = "";

    if (R_val >= 50000) { class_text = "First-Order (1:50,000+)"; status_text = "Pass (High Accuracy)"; }
    else if (R_val >= 20000) { class_text = "Second-Order (1:20,000 to 1:50,000)"; status_text = "Pass"; }
    else if (R_val >= 10000) { class_text = "Third-Order (1:10,000 to 1:20,000)"; status_text = "Acceptable"; }
    else { class_text = "Below 1:10,000"; status_text = "Review/Re-survey Required"; }

    // 5. Vertical Accuracy Classifications (mm*sqrt(K))
    let K_val = D_sum / 1000.0; // K in km
    let ZF_abs = Math.abs(ZF);
    let vert_class = "Below Construction Grade";
    let vert_status = "Review/Re-survey Required";

    if (K_val > 0) {
        let sqrtK = Math.sqrt(K_val);
        if (ZF_abs <= 0.003 * sqrtK) { vert_class = "First-Order (3mm/sqrt(K))"; vert_status = "Pass (High Precision)"; }
        else if (ZF_abs <= 0.007 * sqrtK) { vert_class = "Second-Order (7mm/sqrt(K))"; vert_status = "Pass"; }
        else if (ZF_abs <= 0.012 * sqrtK) { vert_class = "Third-Order (12mm/sqrt(K))"; vert_status = "Acceptable"; }
        else if (ZF_abs <= 0.020 * sqrtK) { vert_class = "Construction Grade (20mm/sqrt(K))"; vert_status = "Acceptable"; }
    }

   // (အပေါ်က Code တွေ အတူတူပါပဲ၊ အောက်ဆုံးက return အပိုင်းကို အစားထိုးပါ)
    
    return {
        adjusted_points: adjusted_points,
        D_sum: D_sum,
        LCE: LCE,
        RP: RP,
        R_val: R_val,
        class_text: class_text,
        status_text: status_text,
        ZF: ZF,
        vert_class: vert_class,
        vert_status: vert_status,
        NF: NF, // <-- အသစ်ထည့်ထားသည် (Delta N)
        EF: EF, // <-- အသစ်ထည့်ထားသည် (Delta E)
        num_stations: rawPoints.length // <-- အသစ်ထည့်ထားသည်
    };
}

// ==========================================
// --- PILE 3-POINTS CIRCLE CENTER FORMULA ---
// ==========================================
function calcCircleCenterFrom3Points(n1, e1, n2, e2, n3, e3) {
    // Math Formula for Circumcenter (Easting = X, Northing = Y)
    let d = 2 * (e1 * (n2 - n3) + e2 * (n3 - n1) + e3 * (n1 - n2));
    if (d === 0) return null; // Points are in a straight line

    let u1 = (e1 * e1 + n1 * n1);
    let u2 = (e2 * e2 + n2 * n2);
    let u3 = (e3 * e3 + n3 * n3);

    let ce = (u1 * (n2 - n3) + u2 * (n3 - n1) + u3 * (n1 - n2)) / d;
    let cn = (u1 * (e3 - e2) + u2 * (e1 - e3) + u3 * (e2 - e1)) / d;
    
    // Radius (Distance from Center to Pt1)
    let r = Math.sqrt(Math.pow(ce - e1, 2) + Math.pow(cn - n1, 2));

    return { n: cn, e: ce, r: r };
}