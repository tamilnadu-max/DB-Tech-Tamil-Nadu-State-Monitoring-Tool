/**
 * config.js
 * Central configuration for the DB Tech Tamil Nadu Live Operations Dashboard.
 * Edit APPS_SCRIPT_URL if you redeploy the Apps Script backend.
 * Nothing else in the app should hardcode the endpoint or refresh interval.
 */
const APP_CONFIG = {
  // Deployed Google Apps Script Web App (doGet) endpoint — the only data source.
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbywej2oOS8CZ-Gym6cmyPPkxW8SlZ5fc6MIn8zU8LxUfQTFAfdxXY_qOzv4nDXglHL8Qg/exec",

  // Auto-refresh cadence in seconds.
  REFRESH_SECONDS: 300,

  // The five centers this dashboard is scoped to. Names must match the "Centers"
  // sheet tab exactly — the app never invents a center that isn't in the sheet.
  CENTERS: ["DB Tech Kilpauk", "DB Tech Trichy", "DB Tech Manikandam", "DB Tech Amsam", "DB Tech Marthandam"],

  // Weighting used by the Center Performance Score (must sum to 100).
  PERFORMANCE_WEIGHTS: {
    attendance: 0.30,
    lms: 0.20,
    assessment: 0.20,
    wadhwani: 0.15,
    documentation: 0.10,
    residential: 0.05
  },

  // Alert thresholds.
  THRESHOLDS: {
    attendanceCritical: 80,   // % — below this triggers an alert
    dropoutWarning: 10,       // % — above this triggers an alert
    residentialCapacityWarning: 100 // % utilization
  },

  // Client-side role gating for this static demo. This is a UI convenience only —
  // see README "Security note" for why real deployments need a proper auth backend.
  ROLES: {
    national: { label: "National Team", scope: "all", pages: ["dashboard","center","batch","student"] },
    state:    { label: "State Team (Tamil Nadu)", scope: "all", pages: ["dashboard","center","batch","student"] },
    center:   { label: "Center Team", scope: "single", pages: ["dashboard","center","batch","student"] }
  },

  STORAGE_KEYS: {
    session: "dbtech_session_v1",
    lastData: "dbtech_last_data_v1"
  }
};
