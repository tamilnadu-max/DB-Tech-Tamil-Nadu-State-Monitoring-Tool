/**
 * mark-attendance.js
 * Lets the center team mark Present/Absent for every student in one of
 * their own center's ACTIVE batches (active status is read straight from
 * the Batches tab, auto-corrected server-side if the end date has passed),
 * for a chosen date, then bulk-submits it to the Attendance tab.
 */
(function(){
  const session = Layout.init();
  if(!session) return;

  const els = {
    center: document.getElementById("f-center"),
    batch: document.getElementById("f-batch"),
    date: document.getElementById("f-date"),
    markAllPresent: document.getElementById("mark-all-present"),
    markAllAbsent: document.getElementById("mark-all-absent"),
    container: document.getElementById("attendance-container")
  };

  const todayIso = new Date().toLocaleDateString("en-CA");
  els.date.value = todayIso;
  els.date.max = todayIso;

  let latestData = null;
  let currentStudents = []; // [{studentId, studentName, status}]

  function populateCenterSelect(){
    const allowed = Auth.allowedCenters();
    els.center.innerHTML = allowed.map(c => `<option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>`).join("");
    if(session.role === "center"){ els.center.value = session.center; els.center.disabled = true; }
  }

  function populateBatchSelect(){
    if(!latestData) return;
    const center = els.center.value;
    // Only ACTIVE batches (per the Batches tab Status, auto-corrected if the
    // end date has already passed) — completed/closed batches don't take
    // new attendance here.
    const activeBatches = (latestData.batches||[]).filter(b => b.center === center && b.status === "Active");
    els.batch.innerHTML = `<option value="">Select a batch</option>` +
      activeBatches.map(b => `<option value="${Utils.escapeHtml(b.batchId)}">${Utils.escapeHtml(b.course)} — ${Utils.escapeHtml(b.batchId)}</option>`).join("");
    loadStudentsForBatch();
  }

  function loadStudentsForBatch(){
    const batchId = els.batch.value;
    if(!batchId){
      currentStudents = [];
      renderTable();
      return;
    }
    const students = (latestData.students||[]).filter(s => s.batchId === batchId && s.status !== "Dropout");
    currentStudents = students.map(s => ({ studentId: s.studentId, studentName: s.studentName, status: "Present" }));
    renderTable();
  }

  function renderTable(){
    if(!els.batch.value){
      els.container.innerHTML = `<div class="panel panel-pad empty-state">Select a batch to load its students.</div>`;
      return;
    }
    if(!currentStudents.length){
      els.container.innerHTML = `<div class="panel panel-pad empty-state">No active students found in this batch.</div>`;
      return;
    }

    els.container.innerHTML = `<div class="panel panel-pad">
      <div class="hint" style="margin-bottom:10px;">Marking attendance for <b>${Utils.escapeHtml(els.date.value)}</b> — defaults to Present, tap to mark Absent.</div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Student ID</th><th>Name</th><th>Status</th></tr></thead>
        <tbody id="attendance-rows">
          ${currentStudents.map((s,i) => `<tr>
            <td>${Utils.escapeHtml(s.studentId)}</td>
            <td>${Utils.escapeHtml(s.studentName)}</td>
            <td><button type="button" class="status-toggle ${s.status==="Present"?"present":"absent"}" data-idx="${i}">${s.status}</button></td>
          </tr>`).join("")}
        </tbody>
      </table></div>
      <button class="btn btn-primary" id="submit-attendance" style="margin-top:14px;"><i data-icon="check"></i> Submit attendance for ${Utils.fmtInt(currentStudents.length)} students</button>
      <div id="submit-progress" class="hint" style="margin-top:10px;"></div>
    </div>`;
    Icons.hydrate(els.container);

    Utils.qsa(".status-toggle", els.container).forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        currentStudents[idx].status = currentStudents[idx].status === "Present" ? "Absent" : "Present";
        btn.textContent = currentStudents[idx].status;
        btn.className = "status-toggle " + (currentStudents[idx].status === "Present" ? "present" : "absent");
      });
    });

    document.getElementById("submit-attendance").addEventListener("click", submitAttendance);
  }

  async function submitAttendance(){
    const btn = document.getElementById("submit-attendance");
    const progressEl = document.getElementById("submit-progress");
    btn.disabled = true;
    progressEl.textContent = "Submitting…";

    const rows = currentStudents.map(s => ({
      studentId: s.studentId, center: els.center.value, batchId: els.batch.value,
      date: els.date.value, status: s.status
    }));

    try{
      const res = await fetch(APP_CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "markAttendance", rows })
      });
      const json = await res.json();
      if(!json.ok) throw new Error(json.error || "Submit failed");
      progressEl.textContent = `Saved — ${json.inserted} new, ${json.updated} updated.`;
      Utils.toast("Attendance saved", "ok");
      Api.refreshNow();
    }catch(err){
      progressEl.textContent = `Failed: ${err.message}`;
      btn.disabled = false;
    }
  }

  els.center.addEventListener("change", populateBatchSelect);
  els.batch.addEventListener("change", loadStudentsForBatch);
  els.date.addEventListener("change", () => { if(els.batch.value) loadStudentsForBatch(); });
  els.markAllPresent.addEventListener("click", () => {
    currentStudents.forEach(s => s.status = "Present");
    renderTable();
  });
  els.markAllAbsent.addEventListener("click", () => {
    currentStudents.forEach(s => s.status = "Absent");
    renderTable();
  });

  populateCenterSelect();

  Api.onData((data) => {
    if(!data) return;
    latestData = data;
    populateBatchSelect();
  });
})();
