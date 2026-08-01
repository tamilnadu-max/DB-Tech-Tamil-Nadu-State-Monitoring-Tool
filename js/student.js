/**
 * student.js — searchable, filterable student table driven entirely by
 * data.students from the live sheet.
 */
(function(){
  const session = Layout.init();
  if(!session) return;

  let allRows = [];
  let sortKey = null, sortDir = 1;

  const els = {
    search: document.getElementById("f-search"),
    center: document.getElementById("f-center"),
    batch: document.getElementById("f-batch"),
    status: document.getElementById("f-status"),
    residential: document.getElementById("f-residential"),
    clear: document.getElementById("f-clear"),
    exportBtn: document.getElementById("f-export"),
    tbody: Utils.qs("#table-students tbody"),
    rowCount: document.getElementById("row-count")
  };

  function fillSelect(el, values, label){
    const current = el.value;
    el.innerHTML = `<option value="">All ${label}</option>` + values.map(v => `<option value="${Utils.escapeHtml(v)}">${Utils.escapeHtml(v)}</option>`).join("");
    el.value = current;
  }
  function uniqueSorted(rows, key){ return [...new Set(rows.map(r=>r[key]).filter(Boolean))].sort(); }

  function wadhwaniProgressLabel(s){
    const stages = ["wadhwaniS1","wadhwaniS2","wadhwaniS3","wadhwaniS4","wadhwaniS5"];
    const done = stages.filter(k => s[k]).length;
    if(!s.wadhwaniRegistered) return "Not registered";
    if(s.wadhwaniCertificate) return "Certified";
    if(s.wadhwaniFinalAssessment) return "Final assessment done";
    return `${done} / 5 sessions`;
  }

  function applyFilters(){
    const q = els.search.value.trim().toLowerCase();
    const allowedCenters = Auth.allowedCenters();
    let rows = allRows.filter(s => allowedCenters.includes(s.center));
    if(els.center.value) rows = rows.filter(s => s.center === els.center.value);
    if(els.batch.value) rows = rows.filter(s => s.batchId === els.batch.value);
    if(els.status.value) rows = rows.filter(s => s.todayStatus === els.status.value);
    if(els.residential.value) rows = rows.filter(s => (s.residential ? "Yes" : "No") === els.residential.value);
    if(q) rows = rows.filter(s => [s.studentId,s.studentName,s.batchId,s.center].join(" ").toLowerCase().includes(q));
    if(sortKey){
      rows = [...rows].sort((a,b) => {
        const av = a[sortKey], bv = b[sortKey];
        if(typeof av === "number") return (av-bv)*sortDir;
        return String(av||"").localeCompare(String(bv||"")) * sortDir;
      });
    }
    return rows;
  }

  function render(){
    const rows = applyFilters();
    els.tbody.innerHTML = rows.map(s => `<tr>
      <td>${Utils.escapeHtml(s.studentName)}</td><td>${Utils.escapeHtml(s.studentId)}</td><td>${Utils.escapeHtml(s.batchId)}</td>
      <td>${Utils.fmtPct(s.attendancePct)}</td>
      <td><span class="pill ${s.todayStatus==='Present'?'yes':'no'}">${Utils.escapeHtml(s.todayStatus||"—")}</span></td>
      <td>${Utils.pillYesNo(s.lms1)}</td><td>${Utils.pillYesNo(s.lms2)}</td><td>${Utils.pillYesNo(s.assessment)}</td>
      <td>${Utils.escapeHtml(wadhwaniProgressLabel(s))}</td>
      <td><span class="pill ${s.residential?'yes':'mid'}">${s.residential?"Residential":"Day scholar"}</span></td>
    </tr>`).join("") || `<tr><td colspan="10" class="empty-state">No students match these filters.</td></tr>`;
    els.rowCount.textContent = `${rows.length} of ${allRows.length} students`;
  }

  Utils.qsa("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      sortDir = (sortKey === key) ? -sortDir : 1;
      sortKey = key;
      render();
    });
  });

  els.search.addEventListener("input", Utils.debounce(render, 200));
  [els.center, els.batch, els.status, els.residential].forEach(el => el.addEventListener("change", render));
  els.clear.addEventListener("click", () => {
    els.search.value=""; els.center.value=""; els.batch.value=""; els.status.value=""; els.residential.value="";
    render();
  });
  els.exportBtn.addEventListener("click", () => {
    const rows = applyFilters().map(s => ({ ...s, wadhwaniProgress: wadhwaniProgressLabel(s), residentialLabel: s.residential ? "Residential" : "Day scholar" }));
    Utils.exportCsv(rows, [
      {key:"studentName",label:"Student Name"},{key:"studentId",label:"Student ID"},{key:"batchId",label:"Batch"},
      {key:"attendancePct",label:"Attendance %"},{key:"todayStatus",label:"Today's Status"},
      {key:"lms1",label:"LMS 1"},{key:"lms2",label:"LMS 2"},{key:"assessment",label:"Assessment"},
      {key:"wadhwaniProgress",label:"Wadhwani Progress"},{key:"residentialLabel",label:"Residential Status"}
    ], `students-${new Date().toISOString().slice(0,10)}.csv`);
  });

  Api.onData((data) => {
    if(!data) return;
    allRows = (data.students||[]).filter(s => Auth.allowedCenters().includes(s.center));
    fillSelect(els.center, uniqueSorted(allRows,"center"), "centers");
    fillSelect(els.batch, uniqueSorted(allRows,"batchId"), "batches");
    render();
  });
})();
