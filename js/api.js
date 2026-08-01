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
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    if(!res.ok) throw new Error("API responded with status " + res.status);
    const json = await res.json();
    if(json.error) throw new Error(json.error);
    return json;
  }

  async function refresh(){
    try{
      const data = await fetchOnce();
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
