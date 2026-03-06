# episodes/ — Episode Data

Each episode lives in its own folder named `EP-XX` (e.g. `EP-01`, `EP-02`, ..., `EP-10`).

## Required Files

Every episode folder must contain exactly three files:

| File | Description |
|------|-------------|
| `audio.mp3` | Podcast audio file |
| `article.pdf` | Source article (the published paper the podcast is based on) |
| `transcript.json` | Podcast transcript with metadata |

The app discovers episodes automatically at startup. Folders missing any of the three files are skipped with a warning.

## transcript.json Format

```json
{
  "metadata": {
    "title": "Episode Title"
  },
  "transcript": "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
}
```

- `metadata.title` — displayed in the UI and admin dashboard
- `transcript` — full podcast text; paragraphs are split on double newlines (`\n\n`)
- Other fields (e.g. `tts_config`, `ssml_hints`) are ignored

## Git

Episode content (audio, PDF, transcript) is **not committed to git** (files are too large). Only `.gitkeep` placeholder files are tracked to preserve the folder structure. Episode data is mounted as a read-only Docker volume in production.
