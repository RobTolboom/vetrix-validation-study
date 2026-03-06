# Vetrix Podcast Validation Webapp

A web application for the **Vetrix Anesthesiology** validation study. Anaesthesiologists and residents evaluate AI-generated podcast episodes on presentation quality, content accuracy, and clinical relevance.

## Study Design

- **10 podcast episodes**, each based on a published anaesthesiology article
- **5 independent raters** per episode (anaesthesiologists or residents)
- **3-section scoring form**: presentation quality (A), per-paragraph accuracy (B), global assessment (C)
- All scores use a **5-point Likert scale** with anchored descriptors

## Language

All code comments and documentation are in English. The **user-facing interface** (form labels, instructions, error messages, button text) is entirely in **Dutch**, as the study targets Dutch-speaking anaesthesiologists and residents.

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Plain HTML/CSS/JS (no framework)
- **Storage**: JSON file (`data/submissions.json`) with file-level locking
- **Deployment**: Docker on Synology NAS

## Quick Start

### Local Development

```bash
npm install
ADMIN_PASSWORD=secret node server.js
```

Open http://localhost:3000

### Docker

```bash
cp .env.example .env
# Edit .env — set ADMIN_PASSWORD

docker-compose up --build -d
```

## Adding Episodes

Place each episode in the `episodes/` directory:

```
episodes/
  EP-01/
    audio.mp3          # Podcast audio file
    article.pdf        # Source article (PDF)
    transcript.json    # Podcast transcript (see format below)
  EP-02/
    ...
```

Only directories matching `EP-XX` with all three files present are served. The app discovers episodes automatically at startup.

### transcript.json Format

```json
{
  "metadata": {
    "title": "Episode Title"
  },
  "transcript": "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
}
```

Paragraphs are split on double newlines (`\n\n`). Other fields in the JSON (e.g. `tts_config`, `ssml_hints`) are ignored.

## User Flow

### New Participants (Registration)

1. Open the webapp and click **"Aanmelden als nieuwe deelnemer"**
2. Read the informatiebrief (10 sections covering study purpose, procedures, risks, privacy)
3. Complete the toestemmingsverklaring: check all 5 consent boxes, enter name and role
4. Receive a **rater code** (e.g. R-01) and **password** (3-character, derived from MD5 hash)
5. Use these credentials to log in

### Raters (Evaluation)

1. Open the webapp and log in with rater code + password
2. An available episode is automatically assigned
3. **Step 1**: Listen to the podcast
4. **Step 2**: Score Section A (presentation quality) — before reading the article
5. **Step 3**: Read the source article (embedded PDF)
6. **Step 4**: Score Section B (per-paragraph accuracy) — after reading the article
7. **Step 5**: Score Section C (global assessment)
8. Submit the evaluation

Each episode is assigned to a maximum of 5 raters. Episodes are distributed evenly (fewest-first algorithm).

### Admin Dashboard

Navigate to `/admin` and log in with the configured password. The dashboard shows:

- **Participants**: all registered raters with code, name, role, password, and registration date
- **Progress**: per-episode assignment/completion counts with rater codes
- **CSV export**: download all responses

## Architecture

```
Webapp/
├── server.js              # Express app (routes, assignment logic, admin API)
├── lib/
│   ├── episodes.js        # Episode discovery and transcript parsing
│   ├── submissions.js     # JSON file storage with atomic writes and locking
│   ├── participants.js    # Participant registration, code generation, password derivation
│   ├── validation.js      # Server-side form validation
│   └── csv-export.js      # Responses → CSV conversion
├── public/
│   ├── landing.html       # Rater login page (code + password)
│   ├── consent.html       # Registration with informed consent
│   ├── registered.html    # Registration success (shows credentials)
│   ├── evaluate.html      # Main scoring form
│   ├── complete.html      # Thank-you / next-episode page
│   ├── admin.html         # Admin dashboard (participants + progress)
│   ├── css/style.css      # Shared stylesheet
│   └── js/
│       ├── landing.js     # Login logic
│       ├── consent.js     # Registration + consent logic
│       ├── evaluate.js    # Scoring form logic
│       └── admin.js       # Admin dashboard logic
├── episodes/              # Episode data (Docker: read-only volume)
│   └── EP-XX/{audio.mp3, article.pdf, transcript.json}
├── data/                  # Persistent storage (Docker: read-write volume)
│   └── submissions.json
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/register` | — | Register new participant with informed consent |
| `POST` | `/api/assign` | — | Authenticate rater and assign an available episode |
| `POST` | `/api/submit` | — | Submit a completed evaluation |
| `GET` | `/api/episode/:code/transcript` | — | Get parsed transcript paragraphs |
| `GET` | `/api/episode/:code/audio` | — | Stream podcast audio |
| `GET` | `/api/episode/:code/article` | — | Serve source article PDF |
| `GET` | `/api/admin/progress` | Basic Auth | Participants + study progress per episode |
| `GET` | `/api/admin/export` | Basic Auth | Download all responses as CSV |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ADMIN_PASSWORD` | `admin` | Password for the admin dashboard (Basic Auth) |

## Concurrency & Data Safety

- **File locking**: `proper-lockfile` provides a mutex on `submissions.json` during assignment and submission
- **Atomic writes**: data is written to a `.tmp` file, then renamed (prevents corruption on crash)
- **Duplicate prevention**: server rejects submissions for the same (episode, rater) pair
- **Stale cleanup**: assignments without a response after 24 hours are automatically removed (runs hourly)

## Scoring Instrument

### Section A — Presentation Quality (before reading the article)
- **A1** — Audio clarity
- **A2** — Structure and flow
- **A3** — Tone and register
- **A4** — Engagement factor

### Section B — Content Accuracy (after reading the article)
- Per-paragraph accuracy score (1-5 Likert)
- Paragraph 1 may be marked "Not applicable" (intro/hook not from source article)

### Section C — Global Assessment
- **C1** — Clinical relevance
- **C2** — Content completeness
