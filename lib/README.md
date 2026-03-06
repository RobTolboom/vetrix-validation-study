# lib/ — Backend Modules

Server-side modules used by `server.js`.

| Module | Description |
|--------|-------------|
| `episodes.js` | Episode discovery (scans `episodes/EP-XX/` at startup) and transcript parsing |
| `submissions.js` | Read/write `data/submissions.json` with atomic writes and file-level locking |
| `validation.js` | Server-side validation of evaluation submissions |
| `csv-export.js` | Convert responses to CSV format for admin export |

## Key Design Decisions

- **File locking**: `proper-lockfile` provides a mutex during concurrent writes to `submissions.json`
- **Atomic writes**: data is written to a `.tmp` file, then renamed to prevent corruption
- **Episode caching**: episodes are discovered once at startup and cached in memory
- **Stale cleanup**: assignments without a response after 24 hours are automatically removed
