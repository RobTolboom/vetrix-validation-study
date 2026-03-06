# Vetrix Podcast Validation Webapp

Webapp voor de validatiestudie van AI-gegenereerde anesthesiologie-podcasts. Beoordelaars evalueren podcastafleveringen op presentatiekwaliteit, inhoudelijke accuraatheid en klinische relevantie.

## Quickstart

### Lokaal draaien

```bash
npm install
ADMIN_PASSWORD=geheim node server.js
```

Open http://localhost:3000

### Docker

```bash
# Maak een .env bestand aan
cp .env.example .env
# Pas ADMIN_PASSWORD aan in .env

docker-compose up --build -d
```

## Afleveringen toevoegen

Plaats voor elke aflevering een map in `episodes/`:

```
episodes/
  EP-01/
    audio.mp3          # Podcast audio
    article.pdf        # Bronartikel
    transcript.json    # Transcript (zie formaat hieronder)
  EP-02/
    ...
```

Alleen mappen met alle drie bestanden worden aangeboden. De app ontdekt afleveringen automatisch bij het opstarten.

### transcript.json formaat

```json
{
  "metadata": {
    "title": "Titel van de aflevering"
  },
  "transcript": "Eerste paragraaf.\n\nTweede paragraaf.\n\nDerde paragraaf."
}
```

Paragrafen worden gesplitst op `\n\n`. Overige velden (tts_config, ssml_hints, etc.) worden genegeerd.

## Gebruik

### Beoordelaars
1. Open de webapp en voer uw beoordelaarscode in
2. Een beschikbare aflevering wordt automatisch toegewezen
3. Beluister de podcast, lees het artikel, vul het scoreformulier in
4. Verstuur de beoordeling

Elke aflevering wordt door maximaal 5 beoordelaars geëvalueerd.

### Admin
Ga naar `/admin` en log in met het ingestelde wachtwoord. Het dashboard toont:
- Voortgang per aflevering (aantal beoordelingen)
- Download van alle resultaten als CSV

## Omgevingsvariabelen

| Variabele | Standaard | Beschrijving |
|-----------|-----------|--------------|
| `PORT` | `3000` | Server poort |
| `ADMIN_PASSWORD` | `admin` | Wachtwoord voor het admin dashboard |

## Data

Beoordelingen worden opgeslagen in `data/submissions.json`. Dit bestand wordt automatisch aangemaakt. Bij gebruik van Docker wordt de `data/` map als volume gemount zodat gegevens behouden blijven bij een rebuild.
