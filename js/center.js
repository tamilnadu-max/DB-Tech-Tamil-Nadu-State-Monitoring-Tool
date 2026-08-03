/**
 * center.js — renders center.html for the center named in ?name=... .
 * If the signed-in user is a Center Team member, access is restricted to
 * their own assigned center regardless of the URL parameter.
 */
(function(){
  const session = Layout.init();
  if(!session) return;

  const params = new URLSearchParams(window.location.search);
  let centerName = params.get("name") || session.center || APP_CONFIG.CENTERS[0];
  if(session.role === "center" && centerName !== session.center) centerName = session.center;

  document.getElementById("center-title").textContent = centerName;

  function statusPill(bool){ return Utils.pillYesNo(bool); }

  Api.onData((data) => {
    if(!data) return;
    const center = (data.centers||[]).find(c => c.centerName === centerName);
    if(!center){
      Utils.qs(".content").innerHTML = `<div class="empty-state"><i data-icon="alertTriangle"></i><div>No data found for "${Utils.escapeHtml(centerName)}" yet. Check the sheet has a matching row in the Centers tab.</div></div>`;
      Icons.hydrate();
      return;
    }
    const batches = (data.batches||[]).filter(b => b.center === centerName);
    const students = (data.students||[]).filter(s => s.center === centerName);

    // KPIs
    const defs = [
      { key:"activeBatches", label:"Running Batches", icon:"layers" },
      { key:"totalEnrolled", label:"Student Count", icon:"users" },
      { key:"attendancePct", label:"Attendance %", icon:"target", pct:true },
      { key:"dropouts", label:"Dropouts", icon:"alertTriangle", cls:"crit" },
      { key:"residentialStudents", label:"Residential Students", icon:"bed" },
      { key:"performanceScore", label:"Performance Score", icon:"award", cls: Utils.scoreColor(center.performanceScore||0) }
    ];
    document.getElementById("center-kpi-grid").innerHTML = defs.map(d => `
      <div class="kpi-card ${d.cls||''}">
        <div class="top-row"><div class="kpi-icon"><i data-icon="${d.icon}"></i></div></div>
        <div class="kpi-value">${d.pct ? Utils.fmtPct(center[d.key]) : Utils.fmtInt(center[d.key])}</div>
        <div class="kpi-label">${d.label}</div>
      </div>`).join("");
    Icons.hydrate();

    // Profile
    document.getElementById("center-profile").innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
        <div><div class="kpi-label">Coordinator</div><div style="font-weight:700;margin-top:4px;">${Utils.escapeHtml(center.coordinator||"—")}</div></div>
        <div><div class="kpi-label">Trainers</div><div style="font-weight:700;margin-top:4px;">${Utils.escapeHtml((center.trainers||[]).join(", ")||"—")}</div></div>
        <div><div class="kpi-label">LMS 1 / LMS 2 completed</div><div style="font-weight:700;margin-top:4px;">${Utils.fmtInt(center.lms1Completed)} / ${Utils.fmtInt(center.lms2Completed)}</div></div>
        <div><div class="kpi-label">Assessment completed</div><div style="font-weight:700;margin-top:4px;">${Utils.fmtInt(center.assessmentCompleted)}</div></div>
        <div><div class="kpi-label">Wadhwani progress</div><div style="font-weight:700;margin-top:4px;">${Utils.fmtPct(center.wadhwaniCompletionPct||0)}</div></div>
        <div><div class="kpi-label">Residential status</div><div style="font-weight:700;margin-top:4px;">${Utils.fmtInt(center.residentialOccupied)} / ${Utils.fmtInt(center.residentialCapacity)} occupied</div></div>
      </div>`;

    // Charts
    const pal = ChartFactory.palette;
    const centerHeat = (data.attendance.heatmap||[]).filter(h => h.center === centerName).sort((a,b)=>a.date.localeCompare(b.date)).slice(-14);
    ChartFactory.upsert("chart-center-attendance", {
      type:"line",
      data:{ labels:centerHeat.map(h=>h.date.slice(5)), datasets:[{ label:"Attendance %", data:centerHeat.map(h=>h.pct), borderColor:pal.blue, backgroundColor:"rgba(0,62,126,.1)", fill:true, tension:.35 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{min:0,max:100,grid:ChartFactory.baseGrid()}, x:{grid:{display:false}} } }
    });
    ChartFactory.upsert("chart-center-progress", {
      type:"bar",
      data:{ labels:["LMS 1","LMS 2","Assessment"], datasets:[{ data:[center.lms1Completed, center.lms2Completed, center.assessmentCompleted], backgroundColor:[pal.blue,pal.blueLight,pal.orange], borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{grid:ChartFactory.baseGrid()}, x:{grid:{display:false}} } }
    });
    const w = (data.wadhwani.byCenter||[]).find(c=>c.center===centerName) || {};
    ChartFactory.upsert("chart-center-wadhwani", {
      type:"bar",
      data:{ labels:["Reg","S1","S2","S3","S4","S5","Final","Cert"], datasets:[{ data:[w.registered,w.s1,w.s2,w.s3,w.s4,w.s5,w.finalAssessment,w.certificates].map(Utils.n), backgroundColor:pal.blueLight, borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{grid:ChartFactory.baseGrid()}, x:{grid:{display:false}} } }
    });
    ChartFactory.upsert("chart-center-residential", {
      type:"doughnut",
      data:{ labels:["Occupied","Available"], datasets:[{ data:[center.residentialOccupied||0, Math.max(0,(center.residentialCapacity||0)-(center.residentialOccupied||0))], backgroundColor:[pal.blue,"#E1E7EF"] }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:"66%" }
    });

    // Batches table
    Utils.qs("#table-center-batches tbody").innerHTML = batches.map(b => `<tr>
      <td>${Utils.escapeHtml(b.batchId)}</td><td>${Utils.escapeHtml(b.course)}</td><td>${Utils.escapeHtml(b.trainer)}</td>
      <td>${Utils.escapeHtml(b.startDate)}</td><td>${Utils.escapeHtml(b.endDate)}</td>
      <td>${Utils.fmtInt(b.enrolled)}</td><td>${Utils.fmtInt(b.presentToday)}</td><td>${Utils.fmtPct(b.attendancePct)}</td>
      <td class="${b.overallAttendancePct < 85 ? 'attendance-below-guideline' : ''}">${Utils.fmtPct(b.overallAttendancePct)}${b.overallAttendancePct < 85 ? ' ⚠️' : ''}</td>
      <td>${Utils.fmtInt(b.dropouts)}</td>
    </tr>`).join("") || `<tr><td colspan="10" class="empty-state">No batches found for this center.</td></tr>`;

    // Students table
    Utils.qs("#table-center-students tbody").innerHTML = students.map(s => `<tr>
      <td>${Utils.escapeHtml(s.studentId)}</td><td>${Utils.escapeHtml(s.studentName)}</td><td>${Utils.escapeHtml(s.batchId)}</td>
      <td>${Utils.fmtPct(s.attendancePct)}</td><td>${statusPill(s.todayStatus==="Present")}</td>
      <td>${statusPill(s.lms1)}</td><td>${statusPill(s.lms2)}</td><td>${statusPill(s.assessment)}</td>
    </tr>`).join("") || `<tr><td colspan="8" class="empty-state">No students found for this center.</td></tr>`;
  });
})();
