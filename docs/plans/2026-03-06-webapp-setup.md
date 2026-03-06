# Webapp Setup — Vetrix Podcast Validation Study

## Goal
Build a web application for anaesthesiologists to evaluate AI-generated podcast episodes as part of a validation study.

## Scope
- Node.js/Express server with JSON file storage
- Landing page with rater code entry
- Episode auto-assignment (max 5 raters per episode)
- Evaluation form with audio player, PDF viewer, and transcript paragraphs
- Server-side submission with validation and file locking
- Admin dashboard with progress overview and CSV export
- Docker deployment for Synology NAS

## Tasks
- [x] Project init (package.json, dependencies)
- [x] Episode discovery module (lib/episodes.js)
- [x] Submissions module with file locking (lib/submissions.js)
- [x] Server-side validation (lib/validation.js)
- [x] CSV export (lib/csv-export.js)
- [x] Express server with all routes (server.js)
- [x] Landing page (landing.html + landing.js)
- [x] Evaluation page (evaluate.html + evaluate.js)
- [x] Complete page (complete.html)
- [x] Admin dashboard (admin.html + admin.js)
- [x] Shared CSS (style.css)
- [x] Dockerfile + docker-compose.yml
- [x] README.md

## Risks
- Concurrent writes to submissions.json: mitigated by proper-lockfile
- Episode files not present: auto-discovery skips incomplete episodes

## Acceptance Criteria
- Rater can log in, get assigned an episode, listen, read, score, and submit
- Server validates all fields and prevents duplicate submissions
- Admin can view progress and download CSV
- App runs in Docker with persistent data volumes
