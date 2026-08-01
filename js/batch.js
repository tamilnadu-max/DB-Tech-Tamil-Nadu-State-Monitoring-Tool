/**
 * batch.js — filterable, searchable, sortable batch table driven entirely
 * by data.batches from the live sheet.
 */
(function(){
  const session = Layout.init();
  if(!session) return;

  let allRows = [];
  let sortKey = null, sortDir = 1;

  const els = {
    search: document.getElementById("f-search"),
    center: document.getElementById("f-center"),
    course: document.getElementById("f-course"),
    trainer: document.getElementById("f-trainer"),
    project: document.getElementById("f-project"),
    date: document.getElementById("f-date"),
    clear: document.getElementById("f-clear"),
    exportBtn: document.getElementById("f-export"),
    tbody: Utils.qs("#table-batches tbody"),
    rowCount: document.getElementById("row-count")
  };

  function fillSelect(el, values){
    const current = el.value;
    el.innerHTML = `<option value="">All ${el.id.replace("f-","")}s</option>` +
      values.map(v => `<option value="${Utils.escapeHtml(v)}">${Utils.escapeHtml(v)}</option>`).join("");
    el.value = current;
  }

  function uniqueSorted(rows, key){ return [...new Set(rows.map(r=>r[key]).filter(Boolean))].sort(); }

  function applyFilters(){
    const q = els.search.value.trim().toLowerCase();
    const allowedCenters = Auth.allowedCenters();
    let rows = allRows.filter(b => allowedCenters.includes(b.center));
    if(els.center.value) rows = rows.filter(b => b.center === els.center.value);
    if(els.course.value) rows = rows.filter(b => b.course === els.course.value);
    if(els.trainer.value) rows = rows.filter(b => b.trainer === els.trainer.value);
    if(els.project.value) rows = rows.filter(b => b.project === els.project.value);
    if(els.date.value) rows = rows.filter(b => b.startDate <= els.date.value && (!b.endDate || b.endDate >= els.date.value));
    if(q) rows = rows.filter(b => [b.batchId,b.course,b.trainer,b.project,b.center].join(" ").toLowerCase().includes(q));
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
    els.tbody.innerHTML = rows.map(b => `<tr>
      <td>${Utils.escapeHtml(b.batchId)}</td><td>${Utils.escapeHtml(b.course)}</td><td>${Utils.escapeHtml(b.project)}</td>
      <td>${Utils.escapeHtml(b.startDate)}</td><td>${Utils.escapeHtml(b.endDate)}</td><td>${Utils.escapeHtml(b.trainer)}</td>
      <td><a href="center.html?name=${encodeURIComponent(b.center)}" style="color:var(--db-blue);font-weight:600;">${Utils.escapeHtml(b.center)}</a></td>
      <td>${Utils.fmtInt(b.enrolled)}</td><td>${Utils.fmtInt(b.presentToday)}</td><td>${Utils.fmtInt(b.absentToday)}</td>
      <td>${Utils.fmtPct(b.attendancePct)}</td><td>${Utils.fmtInt(b.dropouts)}</td>
      <td>${Utils.pillYesNo(b.lms1Completed)}</td><td>${Utils.pillYesNo(b.lms2Completed)}</td><td>${Utils.pillYesNo(b.assessmentCompleted)}</td>
      <td>${Utils.fmtInt(b.residentialCount)}</td><td>${Utils.escapeHtml(b.wadhwaniStatus||"—")}</td>
      <td>${Utils.escapeHtml(b.remarks||"—")}</td>
    </tr>`).join("") || `<tr><td colspan="18" class="empty-state">No batches match these filters.</td></tr>`;
    els.rowCount.textContent = `${rows.length} of ${allRows.length} batches`;
  }

  Utils.qsa("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      sortDir = (sortKey === key) ? -sortDir : 1;
      sortKey = key;
      render();
    });
  });

  [els.search].forEach(el => el.addEventListener("input", Utils.debounce(render, 200)));
  [els.center, els.course, els.trainer, els.project, els.date].forEach(el => el.addEventListener("change", render));
  els.clear.addEventListener("click", () => {
    els.search.value = ""; els.center.value = ""; els.course.value = ""; els.trainer.value = ""; els.project.value = ""; els.date.value = "";
    render();
  });
  els.exportBtn.addEventListener("click", () => {
    const rows = applyFilters();
    Utils.exportCsv(rows, [
      {key:"batchId",label:"Batch ID"},{key:"course",label:"Course"},{key:"project",label:"Project"},
      {key:"startDate",label:"Start"},{key:"endDate",label:"End"},{key:"trainer",label:"Trainer"},{key:"center",label:"Center"},
      {key:"enrolled",label:"Enrolled"},{key:"presentToday",label:"Present"},{key:"absentToday",label:"Absent"},
      {key:"attendancePct",label:"Attendance %"},{key:"dropouts",label:"Dropouts"},{key:"residentialCount",label:"Residential"},
      {key:"wadhwaniStatus",label:"Wadhwani"},{key:"remarks",label:"Remarks"}
    ], `batches-${new Date().toISOString().slice(0,10)}.csv`);
  });

  Api.onData((data) => {
    if(!data) return;
    allRows = (data.batches||[]).filter(b => Auth.allowedCenters().includes(b.center));
    fillSelect(els.center, uniqueSorted(allRows, "center"));
    fillSelect(els.course, uniqueSorted(allRows, "course"));
    fillSelect(els.trainer, uniqueSorted(allRows, "trainer"));
    fillSelect(els.project, uniqueSorted(allRows, "project"));
    render();
  });
})();
