# Contributing

Guidelines for contributing to the Vetrix Validation Webapp.

## Development Setup

```bash
git clone <repository-url>
cd Webapp
npm install
node server.js
```

You need at least one complete episode in `episodes/EP-XX/` (with `audio.mp3`, `article.pdf`, `transcript.json`) for the app to function.

## Branch Strategy

- **`main`** — production-ready code
- **Feature branches** — `feat/<description>` for new features
- **Bugfix branches** — `fix/<description>` for bug fixes
- **Documentation branches** — `docs/<description>` for documentation changes

Never commit directly to `main`. Always create a branch and open a PR.

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add paragraph N/A button for intro paragraphs
fix: resolve beforeunload handler not being removed on submit
docs: add English code comments to all source files
refactor: extract assignment logic into helper function
chore: update dependencies
```

## Project Structure

- **`server.js`** — Express app entry point with all routes
- **`lib/`** — Backend modules (episodes, submissions, validation, CSV export)
- **`public/`** — Frontend (HTML pages, CSS, client-side JS)
- **`episodes/`** — Episode data (not committed to git)
- **`data/`** — Runtime data storage (not committed to git)

## Code Style

- **Language**: JavaScript (Node.js, no TypeScript)
- **Comments**: English
- **UI text**: Dutch (the study targets Dutch-speaking medical professionals)
- **No build step**: plain JS, no transpilation, no bundler
- **Minimal dependencies**: only `express` and `proper-lockfile` in production

## Testing

Currently no automated test suite. Manual verification:

1. Start the server with a test episode
2. Complete the rater flow (landing → evaluate → complete)
3. Verify `data/submissions.json` contains the response
4. Check the admin dashboard at `/admin`
5. Download and inspect the CSV export
