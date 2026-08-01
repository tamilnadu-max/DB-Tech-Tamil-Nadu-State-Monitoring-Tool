# DB Tech Tamil Nadu — Live Operations Dashboard

A static, mobile-responsive operations dashboard for DB Tech's five Tamil Nadu
skilling centers. Built with HTML/CSS/JavaScript (ES6) + Chart.js on the
frontend and Google Apps Script + Google Sheets as the only backend/data
source. No database, no build step, no paid libraries.

```
db-tech-dashboard/
├── index.html            Sign-in / role selection
├── dashboard.html        Overview, Centers, Wadhwani, Residential, Attendance,
│                         Performance, and Reports tabs
├── center.html           Center detail page (?name=DB Tech Kilpauk)
├── batch.html            Batch dashboard with filters
├── student.html          Student dashboard with search + filters
├── manifest.json         PWA manifest
├── service-worker.js     Offline app-shell cache (never caches live API data)
├── css/style.css         Design system (all colors/type/layout tokens)
├── js/
│   ├── config.js         Apps Script URL, refresh interval, roles, weights
│   ├── icons.js           Inline SVG icon set + data-icon hydration
│   ├── auth.js            Client-side session + role scoping
│   ├── utils.js           Formatting, CSV/Excel export, toast, clock
│   ├── api.js             Fetch + cache + 60s auto-refresh pub/sub
│   ├── charts.js          Chart.js theme + upsert-in-place helper
│   ├── layout.js          Shared shell wiring (sidebar, clock, pulse strip)
│   ├── dashboard.js       dashboard.html controller
│   ├── center.js          center.html controller
│   ├── batch.js           batch.html controller
│   └── student.js         student.html controller
├── assets/logo.png        DB Tech logo (header + favicon)
├── apps-script/Code.gs    Backend: reads the Sheet, returns aggregated JSON
└── docs/
    ├── DB_Tech_Sample_Sheet_Template.xlsx   Starter Sheet with 4 tabs
    └── build_sample_sheet.py               Script that generated it
```

## 1. How data flows

```
Google Sheet (Centers / Batches / Students / Attendance tabs)
        │  read on every request
        ▼
Apps Script Web App (Code.gs, doGet)  ──►  aggregates KPIs, center scores,
        │  JSON over HTTPS                  trends, alerts — nothing is
        ▼                                   pre-computed in the sheet
Static site (fetch every 60s via js/api.js)
        │
        ▼
KPI cards, charts, tables — all derived from the JSON, nothing hardcoded
```

Every number on screen traces back to a sheet cell. Editing the sheet and
waiting up to 60 seconds (or pressing **Refresh**) is the only way to change
what the dashboard shows.

## 2. Set up the Google Sheet

Open `docs/DB_Tech_Sample_Sheet_Template.xlsx`, then in Google Sheets:
**File → Import → Upload**, choose *"Insert new sheet(s)"*, and import it (or
recreate the four tabs by hand using the column headers below). Column order
does not matter — headers are matched by name, not position.

| Tab | Columns |
|---|---|
| **Centers** | CenterID, CenterName, Coordinator, Trainers *(comma-separated)*, ResidentialCapacity |
| **Batches** | BatchID, Center, Course, Project, Trainer, StartDate, EndDate, Status, DocumentationComplete, Remarks |
| **Students** | StudentID, StudentName, Center, BatchID, Status *(Active/Dropout)*, Residential, LMS1, LMS2, Assessment, PlacementReady, WadhwaniRegistered, WadhwaniS1..S5, WadhwaniFinalAssessment, WadhwaniCertificate |
| **Attendance** | Date, StudentID, Center, BatchID, Status *(Present/Absent)* — one row per student per day, appended daily |

`CenterName` values must exactly match the five centers configured in
`js/config.js → APP_CONFIG.CENTERS` (DB Tech Kilpauk, Trichy, Manikandam,
Amsam, Marthandam). Yes/No columns accept `Yes/No`, `TRUE/FALSE`, or `1/0`.

The sheet already provided for this project is:
`https://docs.google.com/spreadsheets/d/1-eInSfKVq7-FVVutEHq0auko4gPYUiDdxb6i6N-5wdQ/edit`
— add the four tabs above to it if they don't already exist.

## 3. Deploy the Apps Script backend

1. In the Google Sheet: **Extensions → Apps Script**.
2. Delete the default `Code.gs` content and paste in `apps-script/Code.gs`
   from this project.
3. Confirm the `SHEET_ID` constant at the top matches your sheet's ID (the
   long string in the sheet's URL between `/d/` and `/edit`).
4. **Deploy → New deployment → type: Web app.**
   - Execute as: **Me**
   - Who has access: **Anyone** (required so the static site can fetch it
     without a Google login prompt)
5. Click **Deploy**, authorize the requested permissions, and copy the
   `.../exec` URL it gives you.
6. Paste that URL into `js/config.js → APP_CONFIG.APPS_SCRIPT_URL`.

A deployment you have already used for this project:
`https://script.google.com/macros/s/AKfycbwvtww-Bc-x8dF3QtYCGT-85aHcmf99anrgJoa6Kp6MH9Xg1R6P5GgAG9955a3zYb8Y-Q/exec`
— if you edit `Code.gs` afterwards, use **Deploy → Manage deployments → Edit
→ New version** so the same `/exec` URL picks up your changes (a brand-new
deployment gets a *different* URL, and `config.js` would need updating).

## 4. Host the static site

### GitHub Pages
1. Push this folder to a GitHub repository.
2. **Settings → Pages → Source:** deploy from the `main` branch, root folder.
3. Your dashboard will be live at `https://<username>.github.io/<repo>/`.

### Netlify
1. Drag-and-drop this folder onto [app.netlify.com/drop](https://app.netlify.com/drop),
   or connect the GitHub repo for continuous deploys.
2. No build command is needed — this is a static site (publish directory: `/`).

Either host works with the PWA manifest/service worker as-is, since both
serve over HTTPS (a requirement for service workers).

## 5. Security note — please read before production use

This dashboard implements **three roles** (National Team, State Team, Center
Team) entirely in client-side JavaScript (`js/auth.js`), stored in
`localStorage`. That is a **UI convenience**, not an access-control boundary:
because the Apps Script Web App is deployed as "Anyone can access," a Center
Team user (or anyone with the URL) can call the API directly and see every
center's data in the browser network tab. For a genuine security boundary,
put a real identity provider in front of this — for example:

- Deploy the Web App as "Anyone within [your Google Workspace domain]" if
  every user has a DB Tech Google account, and check `Session.getActiveUser()`
  server-side to filter the response by the caller's assigned center; or
- Front the Apps Script URL with Firebase Auth / Google Identity Services and
  verify a token in `doGet(e)` before returning data.

Until one of those is in place, treat this dashboard's roles as a navigation
convenience for trusted internal users, not a data-privacy control.

## 6. What "no paid libraries" means for exports

- **CSV** — generated in-browser, no dependency.
- **Excel** — exported as an HTML table saved with an `.xls` extension, which
  Excel and Google Sheets both open correctly. This avoids pulling in a paid
  or heavyweight Excel-writing library for a static site.
- **PDF** — uses the browser's native print dialog (`window.print()`) against
  a screen you're already looking at; choose "Save as PDF" as the destination.

## 7. Auto-refresh & the live-pulse strip

`js/api.js` fetches the Apps Script endpoint every `APP_CONFIG.REFRESH_SECONDS`
(60 by default) and fans the result out to every open page via a small
pub/sub. The thin bar under the header (`.pulse-strip`) drains over that same
60 seconds and flashes on each successful refresh — it's a literal "live
sync" indicator for a live-operations dashboard. If the fetch fails (network
issue, wrong URL, sheet permissions), the app falls back to the last
successful response cached in `localStorage` and shows a toast — the
dashboard never blanks out on a transient error.

## 8. Known simplifications (documented, not hidden)

- **Weekly/monthly attendance trend lines** are state-wide even when a Center
  Team member is signed in — the backend does not currently split the
  historical trend by center. KPI cards, tables, and the heat map *are*
  correctly scoped to one center.
- **Alert thresholds** for "LMS pending," "Assessment pending," and
  "Wadhwani sessions pending" (all set at 50% completion in `Code.gs →
  THRESHOLDS`) are reasonable defaults, not numbers specified in the brief —
  adjust them in `apps-script/Code.gs` to match DB Tech's actual policy.
  Attendance-below-80% and dropouts-above-10% use the exact thresholds given.
- **Center Performance Score** documentation-compliance component uses each
  batch's `DocumentationComplete` column as a proxy; add more granular
  columns if compliance should be tracked per document type.

## 9. Local preview

Any static file server works, e.g. from this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. (Opening `index.html` directly via
`file://` also works, but some browsers restrict `localStorage` on `file://`
— a local server is recommended.)
