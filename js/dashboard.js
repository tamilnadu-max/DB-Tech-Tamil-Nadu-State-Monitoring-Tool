/**
 * dashboard.js — renders every section of dashboard.html from the JSON the
 * Apps Script backend returns. No values are hardcoded: every number here
 * traces back to data.kpis / data.centers / data.batches / data.students /
 * data.attendance / data.wadhwani / data.residential / data.performance.
 */
(function(){
  const session = Layout.init();
  if(!session) return;

  const isCenterScope = session.role === "center";
  const P = APP_CONFIG.PERFORMANCE_WEIGHTS;

  // ---- Tabs ----
  function activateTab(tabName){
    Utils.qsa(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
    Utils.qsa(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + tabName));
  }
  Utils.qsa(".tab-btn").forEach(btn => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));

  const jumpMap = { "nav-jump-centers":"centers", "nav-jump-performance":"performance", "nav-jump-reports":"reports" };
  Object.keys(jumpMap).forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener("click", (e) => { e.preventDefault(); activateTab(jumpMap[id]); document.getElementById("sidebar").classList.remove("open"); });
  });

  const KPI_DEFS = [
    { key:"totalCenters", label:"Total Centers", icon:"building" },
    { key:"activeBatches", label:"Active Batches", icon:"layers" },
    { key:"totalEnrolled", label:"Total Enrolled", icon:"users" },
    { key:"activeStudents", label:"In-Class (Active) Students", icon:"users", cls:"good" },
    { key:"completedStudents", label:"Completed Students", icon:"award" },
    { key:"presentToday", label:"Students Present Today", icon:"check", cls:"good" },
    { key:"absentToday", label:"Students Absent Today", icon:"alertTriangle", cls:"warn" },
    { key:"activeAttendancePct", label:"Attendance % (Active Batches)", icon:"target", pct:true },
    { key:"completedAttendancePct", label:"Attendance % (Completed Batches)", icon:"target", pct:true },
    { key:"totalDropouts", label:"Total Dropouts", icon:"alertTriangle", cls:"crit" },
    { key:"lms1Completed", label:"LMS 1 Completed", icon:"bookOpen" },
    { key:"lms2Completed", label:"LMS 2 Completed", icon:"bookOpen" },
    { key:"assessmentCompleted", label:"3rd Party Assessment Completed", icon:"clipboard" },
    { key:"residentialStudents", label:"Residential Students", icon:"bed" },
    { key:"placementReady", label:"Placement Ready Students", icon:"award", cls:"good" },
    { key:"wadhwaniRegistered", label:"Wadhwani Registered", icon:"users" },
    { key:"wadhwaniS1", label:"Wadhwani Session 1 Completed", icon:"check" },
    { key:"wadhwaniS2", label:"Wadhwani Session 2 Completed", icon:"check" },
    { key:"wadhwaniS3", label:"Wadhwani Session 3 Completed", icon:"check" },
    { key:"wadhwaniS4", label:"Wadhwani Session 4 Completed", icon:"check" },
    { key:"wadhwaniS5", label:"Wadhwani Session 5 Completed", icon:"check" },
    { key:"wadhwaniFinalAssessment", label:"Wadhwani Final Assessment Completed", icon:"clipboard" },
    { key:"wadhwaniCertificates", label:"Wadhwani Certificates Downloaded", icon:"award", cls:"good" },
    { key:"centersUpdatedToday", label:"Centers Updated Today", icon:"building", cls:"good" },
    { key:"pendingAttendanceUpdates", label:"Pending Attendance Updates", icon:"alertTriangle", cls:"warn" }
  ];

  function relevanceClass(key, value){
    if(value === undefined || value === null || isNaN(value)) return "";
    if(["attendancePct","activeAttendancePct","completedAttendancePct"].includes(key)){
      return value >= 80 ? "good" : value >= 60 ? "warn" : "crit";
    }
    if(key === "pendingAttendanceUpdates") return value > 0 ? "crit" : "good";
    if(key === "absentToday") return value === 0 ? "good" : "warn";
    if(key === "totalDropouts") return value === 0 ? "good" : "";
    return "";
  }

  function kpiCardHtml(def, value, trend){
    const displayVal = def.pct ? Utils.fmtPct(value) : Utils.fmtInt(value);
    const cls = relevanceClass(def.key, value) || def.cls || "";
    return `<div class="kpi-card ${cls}">
      <div class="top-row">
        <div class="kpi-icon"><i data-icon="${def.icon}"></i></div>
        ${Utils.trendBadge(trend)}
      </div>
      <div class="kpi-value">${displayVal}</div>
      <div class="kpi-label">${def.label}</div>
    </div>`;
  }

  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animateCountUp(el, target, isPct){
    if(prefersReducedMotion || !isFinite(target)){ el.textContent = isPct ? Utils.fmtPct(target) : Utils.fmtInt(target); return; }
    const start = 0, duration = 600, startTime = performance.now();
    function tick(now){
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      el.textContent = isPct ? Utils.fmtPct(current) : Utils.fmtInt(Math.round(current));
      if(progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderKpiGrid(container, defs, kpis){
    container.innerHTML = defs.map(d => kpiCardHtml(d, kpis[d.key], kpis.trend?.[d.key])).join("");
    Icons.hydrate(container);
    Utils.qsa(".kpi-value", container).forEach((el, i) => {
      const def = defs[i];
      animateCountUp(el, Utils.n(kpis[def.key]), !!def.pct);
    });
  }

  function scoreBadgeHtml(score){
    const cls = Utils.scoreColor(score);
    return `<span class="badge ${cls}">${Utils.badgeLabel(score)} · ${score.toFixed(1)}</span>`;
  }

  function centerCardHtml(c){
    return `<div class="center-card" data-center="${Utils.escapeHtml(c.centerName)}">
      <h4>${Utils.escapeHtml(c.centerName)}</h4>
      ${scoreBadgeHtml(c.performanceScore ?? 0)}
      <div class="mini-grid">
        <div class="mini-stat">Active batches<b>${Utils.fmtInt(c.activeBatches)}</b></div>
        <div class="mini-stat">Total enrolled<b>${Utils.fmtInt(c.totalEnrolled)}</b></div>
        <div class="mini-stat">Present today<b>${Utils.fmtInt(c.presentToday)}</b></div>
        <div class="mini-stat">Attendance %<b>${Utils.fmtPct(c.attendancePct)}</b></div>
        <div class="mini-stat">Dropouts<b>${Utils.fmtInt(c.dropouts)}</b></div>
        <div class="mini-stat">Residential<b>${Utils.fmtInt(c.residentialStudents)}</b></div>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, c.wadhwaniCompletionPct||0)}%"></div></div>
      <div class="mini-stat" style="margin-top:6px;">Wadhwani progress · ${Utils.fmtPct(c.wadhwaniCompletionPct||0)}</div>
    </div>`;
  }

  function renderCenterGrids(centers){
    const html = centers.map(centerCardHtml).join("") || `<div class="empty-state">No center data yet.</div>`;
    ["center-grid-overview","center-grid-full"].forEach(id => {
      const el = document.getElementById(id);
      el.innerHTML = html;
      Utils.qsa(".center-card", el).forEach(card => {
        card.addEventListener("click", () => {
          window.location.href = "center.html?name=" + encodeURIComponent(card.dataset.center);
        });
      });
    });
  }

  function renderCharts(data, centers){
    const pal = ChartFactory.palette;

    ChartFactory.upsert("chart-attendance-week", {
      type:"line",
      data:{ labels:(data.attendance.weeklyTrend||[]).map(d=>d.date),
        datasets:[{ label:"Attendance %", data:(data.attendance.weeklyTrend||[]).map(d=>d.pct),
          borderColor:pal.blue, backgroundColor:"rgba(0,62,126,.1)", fill:true, tension:.35, pointRadius:3 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ y:{ min:0, max:100, grid:ChartFactory.baseGrid() }, x:{ grid:{display:false} } } }
    });

    ChartFactory.upsert("chart-center-compare", {
      type:"bar",
      data:{ labels:centers.map(c=>c.centerName.replace("DB Tech ","")),
        datasets:[{ label:"Attendance %", data:centers.map(c=>c.attendancePct), backgroundColor:pal.blue, borderRadius:6, maxBarThickness:36 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ y:{ min:0, max:100, grid:ChartFactory.baseGrid() }, x:{ grid:{display:false} } } }
    });

    const lmsTotal = data.kpis.lms1Completed + data.kpis.lms2Completed;
    ChartFactory.upsert("chart-lms", {
      type:"doughnut",
      data:{ labels:["LMS 1 Completed","LMS 2 Completed","Total Enrolled"],
        datasets:[{ data:[data.kpis.lms1Completed, data.kpis.lms2Completed, Math.max(0,data.kpis.totalEnrolled-lmsTotal)],
          backgroundColor:[pal.blue, pal.blueLight, "#E1E7EF"] }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:"66%" }
    });

    ChartFactory.upsert("chart-assessment", {
      type:"doughnut",
      data:{ labels:["Completed","Pending"],
        datasets:[{ data:[data.kpis.assessmentCompleted, Math.max(0,data.kpis.totalEnrolled-data.kpis.assessmentCompleted)],
          backgroundColor:[pal.orange, "#E1E7EF"] }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:"66%" }
    });

    // Centers tab
    const ranked = [...centers].sort((a,b)=>b.performanceScore-a.performanceScore);
    ChartFactory.upsert("chart-center-rank", {
      type:"bar",
      data:{ labels:ranked.map(c=>c.centerName.replace("DB Tech ","")),
        datasets:[{ label:"Performance score", data:ranked.map(c=>c.performanceScore),
          backgroundColor:ranked.map(c=>({good:pal.green,warn:pal.amber,crit:pal.red}[Utils.scoreColor(c.performanceScore)])), borderRadius:6 }] },
      options:{ indexAxis:"y", responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ x:{ min:0, max:100, grid:ChartFactory.baseGrid() }, y:{ grid:{display:false} } } }
    });

    ChartFactory.upsert("chart-enrollment", {
      type:"line",
      data:{ labels:(data.attendance.monthlyTrend||[]).map(d=>d.date),
        datasets:[{ label:"Attendance % (proxy for activity)", data:(data.attendance.monthlyTrend||[]).map(d=>d.pct),
          borderColor:pal.orange, backgroundColor:"rgba(245,130,32,.12)", fill:true, tension:.3, pointRadius:0 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ y:{ min:0, max:100, grid:ChartFactory.baseGrid() }, x:{ grid:{display:false}, ticks:{maxTicksLimit:8} } } }
    });

    // Wadhwani
    const w = data.wadhwani;
    ChartFactory.upsert("chart-wadhwani-funnel", {
      type:"bar",
      data:{ labels:["Registered","S1","S2","S3","S4","S5","Final","Certificate"],
        datasets:[{ data:[w.registered,w.s1,w.s2,w.s3,w.s4,w.s5,w.finalAssessment,w.certificates], backgroundColor:pal.blue, borderRadius:6 }] },
      options:{ indexAxis:"y", responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ x:{ grid:ChartFactory.baseGrid() }, y:{ grid:{display:false} } } }
    });

    // Residential
    ChartFactory.upsert("chart-residential", {
      type:"bar",
      data:{ labels:(data.residential.byCenter||[]).map(c=>c.center.replace("DB Tech ","")),
        datasets:[{ label:"Utilization %", data:(data.residential.byCenter||[]).map(c=>c.utilizationPct),
          backgroundColor:(data.residential.byCenter||[]).map(c=> c.utilizationPct>=100?pal.red : c.utilizationPct>=85?pal.amber:pal.green), borderRadius:6 }] },
      options:{ indexAxis:"y", responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ x:{ min:0, grid:ChartFactory.baseGrid() }, y:{ grid:{display:false} } } }
    });

    // Attendance tab
    ChartFactory.upsert("chart-att-weekly", {
      type:"line",
      data:{ labels:(data.attendance.weeklyTrend||[]).map(d=>d.date),
        datasets:[{ label:"Attendance %", data:(data.attendance.weeklyTrend||[]).map(d=>d.pct),
          borderColor:pal.blue, backgroundColor:"rgba(0,62,126,.1)", fill:true, tension:.35 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ y:{min:0,max:100, grid:ChartFactory.baseGrid()}, x:{grid:{display:false}} } }
    });
    ChartFactory.upsert("chart-att-monthly", {
      type:"line",
      data:{ labels:(data.attendance.monthlyTrend||[]).map(d=>d.date),
        datasets:[{ label:"Attendance %", data:(data.attendance.monthlyTrend||[]).map(d=>d.pct),
          borderColor:pal.orange, backgroundColor:"rgba(245,130,32,.1)", fill:true, tension:.3, pointRadius:0 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ y:{min:0,max:100, grid:ChartFactory.baseGrid()}, x:{grid:{display:false}, ticks:{maxTicksLimit:8}} } }
    });
    ChartFactory.upsert("chart-att-center", {
      type:"bar",
      data:{ labels:(data.attendance.byCenter||[]).map(c=>c.center.replace("DB Tech ","")),
        datasets:[{ label:"Attendance %", data:(data.attendance.byCenter||[]).map(c=>c.pct), backgroundColor:pal.blueLight, borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ y:{min:0,max:100, grid:ChartFactory.baseGrid()}, x:{grid:{display:false}} } }
    });
    const byBatch = (data.attendance.byBatch||[]).slice(0,12);
    ChartFactory.upsert("chart-att-batch", {
      type:"bar",
      data:{ labels:byBatch.map(b=>b.batch),
        datasets:[
          { label:"Present", data:byBatch.map(b=>b.present), backgroundColor:pal.green, stack:"s" },
          { label:"Absent", data:byBatch.map(b=>b.absent), backgroundColor:pal.red, stack:"s" }
        ] },
      options:{ responsive:true, maintainAspectRatio:false,
        scales:{ x:{ stacked:true, grid:{display:false} }, y:{ stacked:true, grid:ChartFactory.baseGrid() } } }
    });
  }

  function renderHeatmap(heatmap, centerNames){
    const el = document.getElementById("heatmap");
    if(!heatmap || !heatmap.length){ el.innerHTML = `<div class="empty-state">No heat-map data available yet.</div>`; return; }
    const dates = [...new Set(heatmap.map(h=>h.date))].sort().slice(-14);
    const cellColor = pct => pct>=90?"#1F9254":pct>=80?"#6BAE7C":pct>=70?"#C8880A":"#D64545";
    let html = `<div style="overflow-x:auto;"><table class="data-table"><thead><tr><th>Center</th>${dates.map(d=>`<th>${d.slice(5)}</th>`).join("")}</tr></thead><tbody>`;
    centerNames.forEach(center => {
      html += `<tr><td>${Utils.escapeHtml(center.replace("DB Tech ",""))}</td>`;
      dates.forEach(d => {
        const rec = heatmap.find(h=>h.date===d && h.center===center);
        const pct = rec ? rec.pct : null;
        html += `<td style="padding:4px;"><div title="${pct!==null?pct+'%':'No data'}" style="width:30px;height:22px;border-radius:5px;background:${pct!==null?cellColor(pct):'#EAEFF5'};"></div></td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    el.innerHTML = html;
  }

  function renderWadhwaniTable(byCenter){
    const tbody = Utils.qs("#table-wadhwani tbody");
    tbody.innerHTML = (byCenter||[]).map(c => `<tr>
      <td>${Utils.escapeHtml(c.center)}</td><td>${Utils.fmtInt(c.registered)}</td>
      <td>${Utils.fmtInt(c.s1)}</td><td>${Utils.fmtInt(c.s2)}</td><td>${Utils.fmtInt(c.s3)}</td>
      <td>${Utils.fmtInt(c.s4)}</td><td>${Utils.fmtInt(c.s5)}</td>
      <td>${Utils.fmtInt(c.finalAssessment)}</td><td>${Utils.fmtInt(c.certificates)}</td>
      <td>${Utils.fmtPct(c.completionPct)}</td>
      <td><span class="pill ${c.status==='green'?'yes':c.status==='yellow'?'mid':'no'}">${c.status}</span></td>
    </tr>`).join("") || `<tr><td colspan="11" class="empty-state">No Wadhwani data yet.</td></tr>`;
  }

  function renderResidentialBars(byCenter){
    const el = document.getElementById("residential-bars");
    el.innerHTML = (byCenter||[]).map(c => `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
          <b>${Utils.escapeHtml(c.center)}</b><span>${Utils.fmtInt(c.occupied)} / ${Utils.fmtInt(c.capacity)} (${Utils.fmtPct(c.utilizationPct)})</span>
        </div>
        <div class="gauge-track" style="width:100%;">
          <div class="gauge-fill" style="width:${Math.min(100,c.utilizationPct)}%;background:${c.utilizationPct>=100?'var(--db-red)':c.utilizationPct>=85?'var(--db-amber)':'var(--db-green)'};"></div>
        </div>
      </div>`).join("") || `<div class="empty-state">No residential data yet.</div>`;
  }

  function renderPerformance(perf){
    const rankEl = document.getElementById("performance-ranking");
    rankEl.innerHTML = (perf.ranking||[]).map(r => `
      <div class="rank-row">
        <div class="rank-num">#${r.rank}</div>
        <div class="name">${Utils.escapeHtml(r.center)}</div>
        <div class="gauge-track"><div class="gauge-fill" style="width:${r.score}%;background:${r.badge==='Green'?'var(--db-green)':r.badge==='Yellow'?'var(--db-amber)':'var(--db-red)'};"></div></div>
        <div class="score">${r.score.toFixed(1)}</div>
      </div>`).join("") || `<div class="empty-state">No ranking data yet.</div>`;

    const alertEl = document.getElementById("alert-list");
    alertEl.innerHTML = (perf.alerts||[]).map(a => `
      <div class="alert-item ${a.level}"><span class="dot"></span><b>${Utils.escapeHtml(a.center)}</b> ${Utils.escapeHtml(a.message)} <span class="meta">${a.level==='crit'?'Critical':'Warning'}</span></div>
    `).join("") || `<div class="empty-state">No active alerts — all centers within thresholds.</div>`;
  }

  // ---- Scoping for Center-Team role ----
  function scopeForSession(data){
    if(!isCenterScope) return data;
    const center = session.center;
    const centers = (data.centers||[]).filter(c => c.centerName === center);
    const batches = (data.batches||[]).filter(b => b.center === center);
    const students = (data.students||[]).filter(s => s.center === center);
    const c0 = centers[0] || {};
    const activeBatchIds = new Set(batches.filter(b => b.status === "Active").map(b => b.batchId));
    const completedBatchIds = new Set(batches.filter(b => b.status === "Completed").map(b => b.batchId));
    const kpis = {
      totalCenters: 1,
      activeBatches: batches.filter(b => b.status !== "Completed" && b.status !== "Closed").length,
      totalEnrolled: students.length,
      activeStudents: students.filter(s => s.status !== "Dropout" && activeBatchIds.has(s.batchId)).length,
      completedStudents: students.filter(s => s.status !== "Dropout" && completedBatchIds.has(s.batchId)).length,
      presentToday: batches.reduce((s,b)=>s+Utils.n(b.presentToday),0),
      absentToday: batches.reduce((s,b)=>s+Utils.n(b.absentToday),0),
      attendancePct: c0.attendancePct ?? 0,
      activeAttendancePct: c0.attendancePct ?? 0,
      completedAttendancePct: 0,
      totalDropouts: students.filter(s => s.status === "Dropout").length,
      lms1Completed: students.filter(s => s.lms1).length,
      lms2Completed: students.filter(s => s.lms2).length,
      assessmentCompleted: students.filter(s => s.assessment).length,
      residentialStudents: students.filter(s => s.residential).length,
      placementReady: students.filter(s => s.placementReady).length,
      wadhwaniRegistered: students.filter(s => s.wadhwaniRegistered).length,
      wadhwaniS1: students.filter(s => s.wadhwaniS1).length,
      wadhwaniS2: students.filter(s => s.wadhwaniS2).length,
      wadhwaniS3: students.filter(s => s.wadhwaniS3).length,
      wadhwaniS4: students.filter(s => s.wadhwaniS4).length,
      wadhwaniS5: students.filter(s => s.wadhwaniS5).length,
      wadhwaniFinalAssessment: students.filter(s => s.wadhwaniFinalAssessment).length,
      wadhwaniCertificates: students.filter(s => s.wadhwaniCertificate).length,
      centersUpdatedToday: c0.updatedToday ? 1 : 0,
      pendingAttendanceUpdates: c0.updatedToday ? 0 : 1,
      trend: {}
    };
    return {
      ...data, centers, batches, students, kpis,
      attendance: (() => {
        const centerHeatmap = (data.attendance.heatmap||[]).filter(h=>h.center===center).sort((a,b)=>a.date.localeCompare(b.date));
        return {
          today: c0.attendancePct ?? 0,
          yesterday: c0.attendancePct ?? 0,
          activePct: c0.attendancePct ?? 0,
          completedPct: 0,
          weeklyTrend: centerHeatmap.map(h => ({ date: h.date, pct: h.pct })).slice(-7),
          monthlyTrend: centerHeatmap.map(h => ({ date: h.date, pct: h.pct })).slice(-30),
          byCenter: (data.attendance.byCenter||[]).filter(c=>c.center===center),
          byBatch: (data.attendance.byBatch||[]).filter(b=>b.center===center),
          heatmap: centerHeatmap
        };
      })(),
      wadhwani: { ...data.wadhwani, byCenter: (data.wadhwani.byCenter||[]).filter(c=>c.center===center) },
      residential: { ...data.residential, byCenter: (data.residential.byCenter||[]).filter(c=>c.center===center) },
      performance: {
        ranking: (data.performance.ranking||[]).filter(r=>r.center===center),
        alerts: (data.performance.alerts||[]).filter(a=>a.center===center)
      },
      overdue: (data.overdue||[]).filter(o => o.center === center),
      teamPerformance: {
        trainers: (data.teamPerformance?.trainers||[]).filter(t => t.center === center),
        fieldOfficers: (data.teamPerformance?.fieldOfficers||[]).filter(f => f.center === center)
      },
      mobilization: (data.mobilization||[]).filter(m => m.center === center)
    };
  }

  // ---- Overview filter bar: narrow to one center and/or one batch client-side ----
  function applyOverviewFilters(data, centerVal, batchVal){
    if(!centerVal && !batchVal) return data;
    let centers = data.centers||[], batches = data.batches||[], students = data.students||[];
    if(centerVal){
      centers = centers.filter(c => c.centerName === centerVal);
      batches = batches.filter(b => b.center === centerVal);
      students = students.filter(s => s.center === centerVal);
    }
    if(batchVal){
      batches = batches.filter(b => b.batchId === batchVal);
      students = students.filter(s => s.batchId === batchVal);
      const batchCenters = new Set(batches.map(b => b.center));
      centers = centers.filter(c => batchCenters.has(c.centerName));
    }
    const centerNames = new Set(centers.map(c => c.centerName));
    const presentToday = batches.reduce((s,b)=>s+Utils.n(b.presentToday),0);
    const absentToday = batches.reduce((s,b)=>s+Utils.n(b.absentToday),0);
    const attendancePct = (presentToday+absentToday) > 0 ? Math.round((presentToday/(presentToday+absentToday))*1000)/10 : 0;
    const wadhwaniRegistered = students.filter(s=>s.wadhwaniRegistered).length;
    const wadhwaniCertificates = students.filter(s=>s.wadhwaniCertificate).length;

    const kpis = {
      ...data.kpis,
      totalCenters: centers.length,
      activeBatches: batches.filter(b => b.status!=="Completed" && b.status!=="Closed").length,
      totalEnrolled: students.length,
      presentToday, absentToday, attendancePct,
      totalDropouts: students.filter(s=>s.status==="Dropout").length,
      lms1Completed: students.filter(s=>s.lms1).length,
      lms2Completed: students.filter(s=>s.lms2).length,
      assessmentCompleted: students.filter(s=>s.assessment).length,
      residentialStudents: students.filter(s=>s.residential).length,
      placementReady: students.filter(s=>s.placementReady).length,
      wadhwaniRegistered,
      wadhwaniS1: students.filter(s=>s.wadhwaniS1).length,
      wadhwaniS2: students.filter(s=>s.wadhwaniS2).length,
      wadhwaniS3: students.filter(s=>s.wadhwaniS3).length,
      wadhwaniS4: students.filter(s=>s.wadhwaniS4).length,
      wadhwaniS5: students.filter(s=>s.wadhwaniS5).length,
      wadhwaniFinalAssessment: students.filter(s=>s.wadhwaniFinalAssessment).length,
      wadhwaniCertificates,
      centersUpdatedToday: centers.filter(c=>c.updatedToday).length,
      pendingAttendanceUpdates: centers.filter(c=>!c.updatedToday).length
    };

    const wadhwani = {
      registered: wadhwaniRegistered, s1: kpis.wadhwaniS1, s2: kpis.wadhwaniS2, s3: kpis.wadhwaniS3,
      s4: kpis.wadhwaniS4, s5: kpis.wadhwaniS5, finalAssessment: kpis.wadhwaniFinalAssessment,
      certificates: wadhwaniCertificates,
      completionPct: wadhwaniRegistered > 0 ? Math.round((wadhwaniCertificates/wadhwaniRegistered)*1000)/10 : 0,
      byCenter: (data.wadhwani.byCenter||[]).filter(c => centerNames.has(c.center))
    };

    const capacity = centers.reduce((s,c)=>s+Utils.n(c.residentialCapacity),0);
    const occupied = centers.reduce((s,c)=>s+Utils.n(c.residentialOccupied),0);
    const residential = {
      capacity, occupied, available: Math.max(0, capacity-occupied),
      utilizationPct: capacity > 0 ? Math.round((occupied/capacity)*1000)/10 : 0,
      byCenter: (data.residential.byCenter||[]).filter(c => centerNames.has(c.center))
    };

    const attendance = {
      ...data.attendance,
      byCenter: (data.attendance.byCenter||[]).filter(c => centerNames.has(c.center)),
      byBatch: (data.attendance.byBatch||[]).filter(b =>
        (!centerVal || b.center === centerVal) && (!batchVal || b.batch === batchVal)),
      heatmap: (data.attendance.heatmap||[]).filter(h => centerNames.has(h.center))
    };

    const performance = {
      ranking: (data.performance.ranking||[]).filter(r => centerNames.has(r.center)),
      alerts: (data.performance.alerts||[]).filter(a => centerNames.has(a.center))
    };

    return { ...data, centers, batches, students, kpis, wadhwani, residential, attendance, performance };
  }

  let latest = null;
  let lastSessionScoped = null;
  const ovEls = {
    center: document.getElementById("ov-center"),
    batch: document.getElementById("ov-batch"),
    clear: document.getElementById("ov-clear")
  };

  function fillOverviewSelect(el, values){
    const current = el.value;
    el.innerHTML = `<option value="">${el.id==="ov-center" ? "All centers" : "All batches"}</option>` +
      values.map(v => `<option value="${Utils.escapeHtml(v)}">${Utils.escapeHtml(v)}</option>`).join("");
    if(values.includes(current)) el.value = current;
  }

  function renderOverdueBanner(overdue){
    const el = document.getElementById("overdue-banner-container");
    if(!el) return;
    if(!overdue.length){ el.innerHTML = ""; return; }
    el.innerHTML = `<div class="overdue-banner compact">
      <h4><i data-icon="alertTriangle"></i> ${overdue.length} center${overdue.length>1?"s":""} overdue for batch restart</h4>
      <div class="overdue-chip-row">
        ${overdue.map(o => `<span class="overdue-chip" title="Last batch ${Utils.escapeHtml(o.lastBatchId)} ended ${Utils.escapeHtml(o.lastBatchEnd)}">
          ${Utils.escapeHtml(o.center)} <b>${o.daysOverdue}d</b>
        </span>`).join("")}
      </div>
    </div>`;
    Icons.hydrate(el);
  }

  async function submitMobilization(center, mobilized, completed, btn){
    btn.disabled = true;
    try{
      const bustedUrl = APP_CONFIG.APPS_SCRIPT_URL;
      const res = await fetch(bustedUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids a CORS preflight against Apps Script
        body: JSON.stringify({ action: "updateMobilization", center, mobilized, completed })
      });
      const json = await res.json();
      if(!json.ok) throw new Error(json.error || "Update failed");
      Utils.toast("Mobilization updated", "ok");
      Api.refreshNow();
    }catch(err){
      Utils.toast("Could not save: " + err.message, "err");
    }finally{
      btn.disabled = false;
    }
  }

  function renderMobilization(mobilization, centers){
    const el = document.getElementById("mobilization-container");
    if(!el) return;
    const byCenter = {};
    mobilization.forEach(m => { byCenter[m.center] = m; });

    if(isCenterScope){
      const centerName = session.center;
      const m = byCenter[centerName] || { mobilized: 0, completed: 0, lastUpdated: "—" };
      el.innerHTML = `<div class="mobilization-card">
        <h4 style="margin:0 0 4px;font-size:14.5px;">${Utils.escapeHtml(centerName)}</h4>
        <div class="hint">Last updated: ${Utils.escapeHtml(m.lastUpdated || "—")}</div>
        <div class="mobilization-form">
          <label>Students mobilized<input type="number" min="0" id="mob-mobilized" value="${m.mobilized}"></label>
          <label>Students completed<input type="number" min="0" id="mob-completed" value="${m.completed}"></label>
          <button class="btn btn-primary" id="mob-save">Save update</button>
        </div>
      </div>`;
      document.getElementById("mob-save").addEventListener("click", () => {
        const mobilized = Number(document.getElementById("mob-mobilized").value || 0);
        const completed = Number(document.getElementById("mob-completed").value || 0);
        submitMobilization(centerName, mobilized, completed, document.getElementById("mob-save"));
      });
    }else{
      const rows = centers.map(c => byCenter[c.centerName] || { center: c.centerName, mobilized: 0, completed: 0, lastUpdated: "—" });
      el.innerHTML = `<div class="mobilization-card">
        <div class="table-wrap"><table class="data-table"><thead><tr>
          <th>Center</th><th>Mobilized</th><th>Completed</th><th>Last updated</th>
        </tr></thead><tbody>
          ${rows.map(r => `<tr><td>${Utils.escapeHtml(r.center)}</td><td>${Utils.fmtInt(r.mobilized)}</td><td>${Utils.fmtInt(r.completed)}</td><td>${Utils.escapeHtml(r.lastUpdated||"—")}</td></tr>`).join("")
          || `<tr><td colspan="4" class="empty-state">No mobilization data yet.</td></tr>`}
        </tbody></table></div>
      </div>`;
    }
  }

  function renderDashboard(sessionScoped){
    lastSessionScoped = sessionScoped;
    fillOverviewSelect(ovEls.center, [...new Set(sessionScoped.centers.map(c=>c.centerName))].sort());
    fillOverviewSelect(ovEls.batch, [...new Set(sessionScoped.batches.map(b=>b.batchId))].sort());

    const data = applyOverviewFilters(sessionScoped, ovEls.center.value, ovEls.batch.value);
    latest = data;
    data.kpis.activeAttendancePct = data.attendance.activePct;
    data.kpis.completedAttendancePct = data.attendance.completedPct;

    renderOverdueBanner(data.overdue || []);
    renderMobilization(data.mobilization || [], sessionScoped.centers || []);

    renderKpiGrid(document.getElementById("kpi-grid"), KPI_DEFS, data.kpis);
    renderCenterGrids(data.centers);
    renderCharts(data, data.centers);
    renderHeatmap(data.attendance.heatmap, data.centers.map(c=>c.centerName));
    renderWadhwaniTable(data.wadhwani.byCenter);
    renderResidentialBars(data.residential.byCenter);
    renderPerformance(data.performance);

    renderKpiGrid(document.getElementById("kpi-wadhwani"), [
      { key:"registered", label:"Wadhwani Registered", icon:"users" },
      { key:"s1", label:"Session 1 Completed", icon:"check" },
      { key:"s2", label:"Session 2 Completed", icon:"check" },
      { key:"s3", label:"Session 3 Completed", icon:"check" },
      { key:"s4", label:"Session 4 Completed", icon:"check" },
      { key:"s5", label:"Session 5 Completed", icon:"check" },
      { key:"finalAssessment", label:"Final Assessment Completed", icon:"clipboard" },
      { key:"certificates", label:"Certificates Downloaded", icon:"award", cls:"good" },
      { key:"completionPct", label:"Completion %", icon:"target", pct:true }
    ], data.wadhwani);

    renderKpiGrid(document.getElementById("kpi-residential"), [
      { key:"capacity", label:"Residential Capacity", icon:"bed" },
      { key:"occupied", label:"Occupied", icon:"users" },
      { key:"available", label:"Available", icon:"check", cls:"good" },
      { key:"utilizationPct", label:"Utilization %", icon:"target", pct:true }
    ], data.residential);

    renderKpiGrid(document.getElementById("kpi-attendance"), [
      { key:"today", label:"Today's Attendance", icon:"check", pct:true, cls:"good" },
      { key:"yesterday", label:"Yesterday's Attendance", icon:"target", pct:true }
    ], data.attendance);
  }

  Api.onData((raw, err) => {
    if(!raw) return;
    renderDashboard(scopeForSession(raw));
  });

  [ovEls.center, ovEls.batch].forEach(el => el.addEventListener("change", () => {
    if(lastSessionScoped) renderDashboard(lastSessionScoped);
  }));
  ovEls.clear.addEventListener("click", () => {
    ovEls.center.value = ""; ovEls.batch.value = "";
    if(lastSessionScoped) renderDashboard(lastSessionScoped);
  });

  document.querySelectorAll("[data-report]").forEach(btn => {
    btn.addEventListener("click", () => {
      if(!latest){ Utils.toast("No data loaded yet", "err"); return; }
      const type = btn.dataset.report;
      const stamp = new Date().toISOString().slice(0,10);
      if(type==="pdf"){ Utils.exportPdf(); return; }
      if(type==="daily" || type==="weekly" || type==="monthly"){
        const src = type==="daily" ? [{ date:"Today", pct:latest.attendance.today }, { date:"Yesterday", pct:latest.attendance.yesterday }]
          : type==="weekly" ? latest.attendance.weeklyTrend : latest.attendance.monthlyTrend;
        Utils.exportCsv(src, [{key:"date",label:"Date"},{key:"pct",label:"Attendance %"}], `attendance-${type}-${stamp}.csv`);
        return;
      }
      const centerHeaders = [
        {key:"centerName",label:"Center"},{key:"activeBatches",label:"Active Batches"},{key:"totalEnrolled",label:"Total Enrolled"},
        {key:"presentToday",label:"Present Today"},{key:"attendancePct",label:"Attendance %"},{key:"dropouts",label:"Dropouts"},
        {key:"performanceScore",label:"Performance Score"}
      ];
      const batchHeaders = [
        {key:"batchId",label:"Batch ID"},{key:"course",label:"Course"},{key:"center",label:"Center"},{key:"trainer",label:"Trainer"},
        {key:"enrolled",label:"Enrolled"},{key:"presentToday",label:"Present Today"},{key:"attendancePct",label:"Attendance %"},{key:"dropouts",label:"Dropouts"}
      ];
      if(type==="center-csv") Utils.exportCsv(latest.centers, centerHeaders, `center-summary-${stamp}.csv`);
      if(type==="center-xls") Utils.exportExcel(latest.centers, centerHeaders, `center-summary-${stamp}.xls`);
      if(type==="batch-csv") Utils.exportCsv(latest.batches, batchHeaders, `batch-report-${stamp}.csv`);
      if(type==="batch-xls") Utils.exportExcel(latest.batches, batchHeaders, `batch-report-${stamp}.xls`);
    });
  });
})();
