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
    { key:"presentToday", label:"Students Present Today", icon:"check", cls:"good" },
    { key:"absentToday", label:"Students Absent Today", icon:"alertTriangle", cls:"warn" },
    { key:"attendancePct", label:"Overall Attendance %", icon:"target", pct:true },
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

  function kpiCardHtml(def, value, trend){
    const displayVal = def.pct ? Utils.fmtPct(value) : Utils.fmtInt(value);
    return `<div class="kpi-card ${def.cls||''}">
      <div class="top-row">
        <div class="kpi-icon"><i data-icon="${def.icon}"></i></div>
        ${Utils.trendBadge(trend)}
      </div>
      <div class="kpi-value">${displayVal}</div>
      <div class="kpi-label">${def.label}</div>
    </div>`;
  }

  function renderKpiGrid(container, defs, kpis){
    container.innerHTML = defs.map(d => kpiCardHtml(d, kpis[d.key], kpis.trend?.[d.key])).join("");
    Icons.hydrate(container);
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
    const kpis = {
      ...data.kpis,
      totalCenters: 1,
      activeBatches: c0.activeBatches ?? batches.length,
      totalEnrolled: c0.totalEnrolled ?? students.length,
      presentToday: batches.reduce((s,b)=>s+Utils.n(b.presentToday),0),
      absentToday: batches.reduce((s,b)=>s+Utils.n(b.absentToday),0),
      attendancePct: c0.attendancePct ?? 0,
      totalDropouts: c0.dropouts ?? 0,
      lms1Completed: c0.lms1Completed ?? 0,
      lms2Completed: c0.lms2Completed ?? 0,
      assessmentCompleted: c0.assessmentCompleted ?? 0,
      residentialStudents: c0.residentialStudents ?? 0,
      centersUpdatedToday: c0.updatedToday ? 1 : 0,
      trend: {}
    };
    return {
      ...data, centers, batches, students, kpis,
      attendance: {
        ...data.attendance,
        byCenter: (data.attendance.byCenter||[]).filter(c=>c.center===center),
        byBatch: (data.attendance.byBatch||[]).filter(b=>b.center===center),
        heatmap: (data.attendance.heatmap||[]).filter(h=>h.center===center)
      },
      wadhwani: { ...data.wadhwani, byCenter: (data.wadhwani.byCenter||[]).filter(c=>c.center===center) },
      residential: { ...data.residential, byCenter: (data.residential.byCenter||[]).filter(c=>c.center===center) },
      performance: {
        ranking: (data.performance.ranking||[]).filter(r=>r.center===center),
        alerts: (data.performance.alerts||[]).filter(a=>a.center===center)
      }
    };
  }

  let latest = null;

  Api.onData((raw, err) => {
    if(!raw) return;
    const data = scopeForSession(raw);
    latest = data;

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
