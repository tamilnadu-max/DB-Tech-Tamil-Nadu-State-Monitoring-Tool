/**
 * api.js
 * Single source of truth for talking to the Google Apps Script backend.
 * The backend does all aggregation (KPIs, center scores, trends) so this
 * file just fetches, caches, and fans the result out to subscribers on a
 * fixed interval — nothing here is hardcoded from sheet data.
 *
 * Expected JSON shape returned by Code.gs (see apps-script/Code.gs + README):
 * { generatedAt, kpis, centers[], batches[], students[], attendance, wadhwani, residential, performance }
 */
const Api = (function(){
  let cache = null;
  let lastError = null;
  let timer = null;
  let countdown = APP_CONFIG.REFRESH_SECONDS;
  const subscribers = [];       // called with (data)
  const tickSubscribers = [];   // called with (secondsRemaining)

  function loadCachedFallback(){
    try{
      const raw = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.lastData);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  function saveCache(data){
    cache = data;
    try{ localStorage.setItem(APP_CONFIG.STORAGE_KEYS.lastData, JSON.stringify(data)); }catch(e){ /* storage full — ignore */ }
  }

  async function fetchOnce(){
    const url = APP_CONFIG.APPS_SCRIPT_URL;
    if(!url || url.indexOf("PASTE_") === 0){
      throw new Error("Apps Script URL is not configured yet — see README setup guide.");
    }
    // Cache-bust: browsers can silently cache identical GET requests to the
    // same Apps Script /exec URL, which makes sheet edits look like they
    // "aren't reflecting". Appending a changing param plus cache: "no-store"
    // forces every refresh to actually hit Google again.
    const bustedUrl = url + (url.indexOf("?") === -1 ? "?" : "&") + "_ts=" + Date.now();
    const res = await fetch(bustedUrl, { method: "GET", redirect: "follow", cache: "no-store" });
    if(!res.ok) throw new Error("API responded with status " + res.status);
    const json = await res.json();
    if(json.error) throw new Error(json.error);
    return json;
  }

  // A single transient failure (brief network blip, or Google momentarily
  // rate-limiting a very active Apps Script deployment) shouldn't surface as
  // a visible error toast — retry once after a short pause before giving up.
  async function fetchWithRetry(){
    try{
      return await fetchOnce();
    }catch(err){
      await new Promise(r => setTimeout(r, 1200));
      return await fetchOnce();
    }
  }

  async function refresh(){
    try{
      const data = await fetchWithRetry();
      saveCache(data);
      lastError = null;
      subscribers.forEach(fn => { try{ fn(data, null); }catch(e){ console.error(e); } });
    }catch(err){
      lastError = err.message || String(err);
      const fallback = cache || loadCachedFallback();
      subscribers.forEach(fn => { try{ fn(fallback, lastError); }catch(e){ console.error(e); } });
    }
    countdown = APP_CONFIG.REFRESH_SECONDS;
    return cache;
  }

  function startAutoRefresh(){
    if(timer) return;
    refresh();
    timer = setInterval(() => {
      countdown -= 1;
      tickSubscribers.forEach(fn => fn(countdown));
      if(countdown <= 0) refresh();
    }, 1000);
  }

  return {
    onData(fn){ subscribers.push(fn); if(cache || loadCachedFallback()) fn(cache || loadCachedFallback(), lastError); },
    onTick(fn){ tickSubscribers.push(fn); },
    start(){ startAutoRefresh(); },
    refreshNow(){ return refresh(); },
    getCache(){ return cache || loadCachedFallback(); },
    getError(){ return lastError; },
    getRefreshSeconds(){ return APP_CONFIG.REFRESH_SECONDS; }
  };
})();
