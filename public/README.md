# public/ — Frontend

Static HTML pages, CSS, and client-side JavaScript. Served by Express.

## Pages

| File | Route | Description |
|------|-------|-------------|
| `landing.html` | `/` | Rater enters their code and role to receive an episode assignment |
| `evaluate.html` | `/evaluate` | Main scoring form (audio, PDF, sections A/B/C) |
| `complete.html` | `/complete` | Thank-you page after successful submission |
| `admin.html` | `/admin` | Admin dashboard with progress overview and CSV export |

## Assets

| Directory | Contents |
|-----------|----------|
| `css/style.css` | Shared stylesheet for all pages |
| `js/landing.js` | Landing page logic (assignment request, sessionStorage) |
| `js/evaluate.js` | Scoring form logic (transcript rendering, Likert scales, submission) |
| `js/admin.js` | Admin dashboard logic (progress table, CSV download) |

## Notes

- All user-facing text is in **Dutch** (target audience: Dutch-speaking medical professionals)
- No build step — plain HTML/CSS/JS, served as-is
- Assignment data is passed between pages via `sessionStorage`
