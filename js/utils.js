/**
 * utils.js — shared formatting, export, and small UI helpers used across pages.
 */
const Utils = (function(){
  function n(v){ return (v === null || v === undefined || isNaN(v)) ? 0 : Number(v); }

  function fmtInt(v){ return n(v).toLocaleString("en-IN"); }

  function fmtPct(v, digits=1){ return n(v).toFixed(digits) + "%"; }

  function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  function trendBadge(trend){
    if(!trend || !trend.dir || trend.dir === "flat"){
      return `<span class="trend flat">→ ${trend?.label ?? "0%"}</span>`;
    }
    const arrow = trend.dir === "up" ? "↑" : "↓";
    return `<span class="trend ${trend.dir}">${arrow} ${trend.label}</span>`;
  }

  function scoreColor(score){
    if(score >= 85) return "good";
    if(score >= 70) return "warn";
    return "crit";
  }
  function badgeLabel(score){
    if(score >= 85) return "Green";
    if(score >= 70) return "Yellow";
    return "Red";
  }

  function pillYesNo(val){
    const isYes = val === true || val === "Yes" || val === "Y" || val === 1 || val === "1";
    return `<span class="pill ${isYes ? "yes" : "no"}">${isYes ? "Yes" : "No"}</span>`;
  }

  function debounce(fn, wait=250){
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  function toast(msg, kind="ok"){
    let el = document.getElementById("app-toast");
    if(!el){
      el = document.createElement("div");
      el.id = "app-toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.className = `toast show ${kind}`;
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function updateClock(el){
    const tick = () => {
      const now = new Date();
      const date = now.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });
      const time = now.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
      el.innerHTML = `${date}<br><strong>${time} IST</strong>`;
    };
    tick();
    setInterval(tick, 1000);
  }

  // --- Export helpers (no paid libraries: CSV/XLS via Blob, PDF via print) ---
  function toCsv(rows, headers){
    const esc = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
    const lines = [headers.map(esc).join(",")];
    rows.forEach(r => lines.push(headers.map(h => esc(r[h.key ?? h])).join(",")));
    return lines.join("\n");
  }

  function downloadBlob(content, filename, mime){
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv(rows, headers, filename){
    downloadBlob(toCsv(rows, headers), filename, "text/csv;charset=utf-8;");
    toast(`Exported ${filename}`, "ok");
  }

  function exportExcel(rows, headers, filename){
    // Lightweight Excel-compatible export (HTML table saved as .xls) — no paid library needed.
    const esc = v => Utils.escapeHtml(v ?? "");
    let html = "<table><tr>" + headers.map(h => `<th>${esc(h.label ?? h)}</th>`).join("") + "</tr>";
    rows.forEach(r => { html += "<tr>" + headers.map(h => `<td>${esc(r[h.key ?? h])}</td>`).join("") + "</tr>"; });
    html += "</table>";
    downloadBlob(html, filename, "application/vnd.ms-excel");
    toast(`Exported ${filename}`, "ok");
  }

  function exportPdf(){
    window.print();
  }

  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  return { n, fmtInt, fmtPct, escapeHtml, trendBadge, scoreColor, badgeLabel, pillYesNo,
           debounce, toast, updateClock, exportCsv, exportExcel, exportPdf, qs, qsa };
})();
