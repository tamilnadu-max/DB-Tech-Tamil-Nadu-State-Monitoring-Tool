/**
 * import-attendance.js
 * Parses a Student Attendance Register .xlsx (uploaded directly by the
 * center team) entirely in the browser using SheetJS, and bulk-writes the
 * result into the Attendance tab via the Apps Script doPost endpoint —
 * so nobody has to type attendance in one row at a time.
 *
 * Expected register layout (matches the standard DB Tech register format):
 *   - a "CenterName : <text>" cell somewhere near the top
 *   - a "Domain : <course>" cell
 *   - a "Batch Code : <id>(...)" cell
 *   - a header row with month labels ("July 2026", "August 2026", ...)
 *   - the next row down with day headers like "7\nTue", "8\nWed", ...
 *   - a "Student Name" / "Enrollment No" header on that same row
 *   - one row per student below that, with "P" marking present days
 */
(function(){
  const session = Layout.init();
  if(!session) return;

  const fileInput = document.getElementById("file-input");
  const previewEl = document.getElementById("preview-container");

  const MONTH_MAP = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

  function findCellContaining(matrix, needle){
    for(let r = 0; r < matrix.length; r++){
      for(let c = 0; c < matrix[r].length; c++){
        const v = matrix[r][c];
        if(typeof v === "string" && v.indexOf(needle) !== -1) return { r, c, value: v };
      }
    }
    return null;
  }

  function extractAfterColon(text){
    const idx = text.indexOf(":");
    return idx === -1 ? "" : text.slice(idx + 1).trim();
  }

  function mapCenterName(rawText){
    // Register text looks like "Don Bosco Tech - Trichy(TAMIL NADU)" — match
    // it against APP_CONFIG.CENTERS by whichever center name's city keyword
    // appears in the raw text.
    const cleaned = rawText.replace(/\(.*?\)/g, "").replace(/don\s*bosco\s*tech/i, "").replace(/[-–]/g, " ").trim().toLowerCase();
    let best = null;
    APP_CONFIG.CENTERS.forEach(c => {
      const keyword = c.replace(/^DB Tech\s*/i, "").trim().toLowerCase();
      if(keyword && cleaned.indexOf(keyword) !== -1) best = c;
    });
    return best;
  }

  function parseDayHeader(cellText, monthIndex, year){
    // cellText looks like "7\nTue" or "7 Tue"
    const m = String(cellText).match(/^(\d{1,2})/);
    if(!m || monthIndex === null) return null;
    const day = Number(m[1]);
    const weekdayMatch = String(cellText).match(/(mon|tue|wed|thu|fri|sat|sun)/i);
    const weekday = weekdayMatch ? weekdayMatch[1].toLowerCase() : null;
    const date = new Date(year, monthIndex, day);
    const iso = date.getFullYear() + "-" + String(date.getMonth()+1).padStart(2,"0") + "-" + String(date.getDate()).padStart(2,"0");
    return { iso, weekday };
  }

  function parseRegister(matrix){
    const centerHit = findCellContaining(matrix, "CenterName");
    const domainHit = findCellContaining(matrix, "Domain");
    const batchHit = findCellContaining(matrix, "Batch Code");
    const dateRangeHit = findCellContaining(matrix, "StartDate");

    if(!centerHit || !batchHit) throw new Error("Could not find CenterName / Batch Code in this file — is it the standard register format?");

    const rawCenter = extractAfterColon(centerHit.value);
    const mappedCenter = mapCenterName(rawCenter);
    const domain = domainHit ? extractAfterColon(domainHit.value) : "";
    const batchCodeRaw = extractAfterColon(batchHit.value);
    const batchId = (batchCodeRaw.match(/[\w]+/) || [""])[0]; // "260276(B4)" -> "260276"

    let startDateStr = "", endDateStr = "";
    if(dateRangeHit){
      const sm = dateRangeHit.value.match(/StartDate\s*:\s*([\d/]+)/i);
      const em = dateRangeHit.value.match(/EndDate\s*:\s*([\d/]+)/i);
      if(sm) startDateStr = sm[1];
      if(em) endDateStr = em[1];
    }

    // Find the header row: the one containing "Student Name" and "Enrollment No".
    let headerRowIdx = -1, colStudentId = -1, colStudentName = -1;
    for(let r = 0; r < matrix.length; r++){
      const rowStr = matrix[r].map(v => String(v||"")).join("|");
      if(rowStr.indexOf("Student Name") !== -1 && rowStr.indexOf("Enrollment") !== -1){
        headerRowIdx = r;
        matrix[r].forEach((v, c) => {
          if(String(v||"").indexOf("Enrollment") !== -1) colStudentId = c;
          if(String(v||"").indexOf("Student Name") !== -1) colStudentName = c;
        });
        break;
      }
    }
    if(headerRowIdx === -1) throw new Error("Could not find the 'Student Name' / 'Enrollment No' header row.");

    // The month-label row is directly above the header row.
    const monthRowIdx = headerRowIdx - 1;
    const monthCols = []; // { col, monthIndex, year }
    matrix[monthRowIdx].forEach((v, c) => {
      if(typeof v !== "string") return;
      const m = v.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
      if(!m) return;
      const monthIndex = MONTH_MAP[m[1].slice(0,3).toLowerCase()];
      if(monthIndex === undefined) return;
      monthCols.push({ col: c, monthIndex, year: Number(m[2]) });
    });
    if(!monthCols.length) throw new Error("Could not find month headers (e.g. 'July 2026') above the day-of-week row.");

    // Build column -> {iso, weekday} map for every date column on the header row.
    const dateForCol = {};
    for(let c = 0; c < matrix[headerRowIdx].length; c++){
      const cell = matrix[headerRowIdx][c];
      if(cell === "" || cell === null || cell === undefined) continue;
      // find which month block this column belongs to (last monthCols entry with col <= c)
      let active = null;
      monthCols.forEach(mc => { if(mc.col <= c) active = mc; });
      if(!active) continue;
      const parsed = parseDayHeader(cell, active.monthIndex, active.year);
      if(parsed) dateForCol[c] = parsed;
    }

    const todayIso = new Date().toLocaleDateString("en-CA"); // en-CA gives YYYY-MM-DD

    // Student rows: everything below the header row with a value in the Enrollment column.
    const students = [];
    for(let r = headerRowIdx + 1; r < matrix.length; r++){
      const sid = matrix[r][colStudentId];
      const sname = matrix[r][colStudentName];
      if(!sid && !sname) continue;
      if(!sid) continue;
      const records = [];
      Object.keys(dateForCol).forEach(colStr => {
        const col = Number(colStr);
        const { iso, weekday } = dateForCol[col];
        if(weekday === "sun") return;       // skip Sundays entirely
        if(iso > todayIso) return;          // never mark future dates
        const cell = String(matrix[r][col] || "").trim();
        const status = cell === "P" ? "Present" : "Absent";
        records.push({ date: iso, status });
      });
      students.push({ studentId: String(sid).trim(), studentName: String(sname||"").trim(), records });
    }

    return { rawCenter, mappedCenter, domain, batchId, startDateStr, endDateStr, students };
  }

  function summarize(parsed){
    const totalRecords = parsed.students.reduce((s,st) => s + st.records.length, 0);
    const presentCount = parsed.students.reduce((s,st) => s + st.records.filter(r=>r.status==="Present").length, 0);
    return { totalRecords, presentCount, absentCount: totalRecords - presentCount };
  }

  function renderPreview(parsed){
    const stats = summarize(parsed);
    const centerWarning = !parsed.mappedCenter
      ? `<div class="overdue-row" style="margin-top:10px;"><span>Could not match "${Utils.escapeHtml(parsed.rawCenter)}" to a known center — check APP_CONFIG.CENTERS.</span></div>`
      : "";
    const scopeWarning = (session.role === "center" && parsed.mappedCenter && parsed.mappedCenter !== session.center)
      ? `<div class="overdue-row" style="margin-top:10px;"><span>This register is for <b>${Utils.escapeHtml(parsed.mappedCenter)}</b>, but you're signed in as <b>${Utils.escapeHtml(session.center)}</b>. Import is blocked.</span></div>`
      : "";
    const canImport = parsed.mappedCenter && !scopeWarning;

    previewEl.innerHTML = `<div class="panel panel-pad">
      <h3 style="font-size:14.5px;margin-bottom:10px;">Preview before importing</h3>
      <div class="mini-grid" style="margin-bottom:10px;">
        <div class="mini-stat">Center<b>${Utils.escapeHtml(parsed.mappedCenter || "Not matched")}</b></div>
        <div class="mini-stat">Domain / Course<b>${Utils.escapeHtml(parsed.domain || "—")}</b></div>
        <div class="mini-stat">Batch ID<b>${Utils.escapeHtml(parsed.batchId || "—")}</b></div>
        <div class="mini-stat">Students found<b>${Utils.fmtInt(parsed.students.length)}</b></div>
        <div class="mini-stat">Attendance rows to write<b>${Utils.fmtInt(stats.totalRecords)}</b></div>
        <div class="mini-stat">Present / Absent<b>${Utils.fmtInt(stats.presentCount)} / ${Utils.fmtInt(stats.absentCount)}</b></div>
      </div>
      ${centerWarning}${scopeWarning}
      <button class="btn btn-primary" id="import-btn" ${canImport ? "" : "disabled"}><i data-icon="upload"></i> Import ${Utils.fmtInt(stats.totalRecords)} rows</button>
      <div id="import-progress" class="hint" style="margin-top:10px;"></div>
    </div>`;
    Icons.hydrate(previewEl);

    const btn = document.getElementById("import-btn");
    if(btn) btn.addEventListener("click", () => runImport(parsed));
  }

  async function runImport(parsed){
    const btn = document.getElementById("import-btn");
    const progressEl = document.getElementById("import-progress");
    btn.disabled = true;

    const allRows = [];
    parsed.students.forEach(st => {
      st.records.forEach(rec => {
        allRows.push({ studentId: st.studentId, center: parsed.mappedCenter, batchId: parsed.batchId, date: rec.date, status: rec.status });
      });
    });

    const CHUNK = 400;
    let inserted = 0, updated = 0;
    for(let i = 0; i < allRows.length; i += CHUNK){
      const chunk = allRows.slice(i, i + CHUNK);
      progressEl.textContent = `Importing ${Math.min(i+CHUNK, allRows.length)} of ${allRows.length}…`;
      try{
        const res = await fetch(APP_CONFIG.APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "importAttendance", rows: chunk })
        });
        const json = await res.json();
        if(!json.ok) throw new Error(json.error || "Import failed");
        inserted += json.inserted; updated += json.updated;
      }catch(err){
        progressEl.textContent = `Failed partway through: ${err.message}. ${inserted} inserted, ${updated} updated before the error.`;
        btn.disabled = false;
        return;
      }
    }
    progressEl.textContent = `Done — ${inserted} new rows added, ${updated} existing rows updated.`;
    Utils.toast("Attendance imported", "ok");
    Api.refreshNow();
  }

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    previewEl.innerHTML = `<div class="panel panel-pad">Reading file…</div>`;
    try{
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
      const parsed = parseRegister(matrix);
      renderPreview(parsed);
    }catch(err){
      previewEl.innerHTML = `<div class="panel panel-pad"><div class="overdue-row"><span>${Utils.escapeHtml(err.message)}</span></div></div>`;
    }
  });
})();
