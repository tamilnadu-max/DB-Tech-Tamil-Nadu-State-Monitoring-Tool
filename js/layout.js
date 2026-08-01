/**
 * layout.js — wires up the shell chrome that's duplicated across dashboard.html,
 * center.html, batch.html and student.html: auth guard, sidebar toggle, clock,
 * role box, live-pulse refresh strip, and the manual refresh button.
 */
const Layout = {
  init(){
    const session = Auth.requireSession();
    if(!session) return null;

    const roleBox = document.getElementById("role-box");
    if(roleBox){
      const roleDef = APP_CONFIG.ROLES[session.role];
      roleBox.innerHTML = `
        <div class="role-name">${Utils.escapeHtml(roleDef.label)}</div>
        <div>${session.role === "center" ? Utils.escapeHtml(session.center) : "All Tamil Nadu centers"}</div>
        <button id="logout-btn" type="button">Switch role</button>`;
      document.getElementById("logout-btn").addEventListener("click", () => Auth.logout());
    }

    const clockEl = document.getElementById("live-clock");
    if(clockEl) Utils.updateClock(clockEl);

    const menuToggle = document.getElementById("menu-toggle");
    const sidebar = document.getElementById("sidebar");
    if(menuToggle && sidebar){
      menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
      document.addEventListener("click", (e) => {
        if(window.innerWidth > 980) return;
        if(!sidebar.contains(e.target) && !menuToggle.contains(e.target)) sidebar.classList.remove("open");
      });
    }

    const refreshBtn = document.getElementById("refresh-btn");
    if(refreshBtn){
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.classList.add("spin");
        await Api.refreshNow();
        refreshBtn.classList.remove("spin");
        Utils.toast("Dashboard refreshed", "ok");
      });
    }

    const strip = document.getElementById("pulse-strip");
    const fill = document.getElementById("pulse-fill");
    const lastUpdated = document.getElementById("last-updated");
    if(fill){
      Api.onTick(secondsLeft => {
        const total = Api.getRefreshSeconds();
        fill.style.transform = `scaleX(${Math.max(0, secondsLeft / total)})`;
      });
    }
    Api.onData((data, err) => {
      if(strip){ strip.classList.add("flash"); setTimeout(() => strip.classList.remove("flash"), 500); }
      if(lastUpdated){
        if(err){
          lastUpdated.textContent = "Showing last cached data — connection issue";
          Utils.toast(err, "err");
        }else if(data?.generatedAt){
          const t = new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
          lastUpdated.textContent = `Live · Sheet last read at ${t} IST`;
        }
      }
    });

    Api.start();

    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("service-worker.js").catch(() => { /* offline shell is optional */ });
    }

    return session;
  }
};
