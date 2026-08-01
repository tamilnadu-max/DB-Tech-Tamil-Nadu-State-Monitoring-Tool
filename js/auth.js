/**
 * auth.js
 * Lightweight client-side "session" so pages can restrict what a role sees.
 * NOTE: this is a UI convenience for a static site, not real security.
 * A center-team user can still open dev tools and see other centers' data
 * returned by the API. For genuine access control, front the Apps Script
 * endpoint with real authentication (see README "Security note").
 */
const Auth = {
  getSession(){
    try{
      const raw = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.session);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  },
  setSession(session){
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.session, JSON.stringify(session));
  },
  clearSession(){
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.session);
  },
  requireSession(){
    const s = this.getSession();
    if(!s){
      window.location.href = "index.html";
      return null;
    }
    return s;
  },
  // Returns the list of center names the current session may view.
  allowedCenters(){
    const s = this.getSession();
    if(!s) return [];
    if(s.role === "center") return [s.center];
    return APP_CONFIG.CENTERS;
  },
  canView(centerName){
    const allowed = this.allowedCenters();
    return allowed.includes(centerName);
  },
  logout(){
    this.clearSession();
    window.location.href = "index.html";
  }
};
