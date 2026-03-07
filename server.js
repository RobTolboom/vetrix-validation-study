/**
 * Vetrix Validation Webapp — Express server entry point.
 *
 * This webapp is used in a medical research study where anaesthesiologists
 * evaluate AI-generated podcast episodes on presentation quality, content
 * accuracy, and clinical relevance. Each episode is evaluated by 5 raters.
 *
 * Routes:
 *   Pages:  / (landing), /consent, /registered, /evaluate, /complete, /admin
 *   API:    /api/register, /api/assign, /api/submit, /api/episode/:code/*
 *   Admin:  /api/admin/progress, /api/admin/export (Basic Auth protected)
 */

const express = require('express');
const path = require('path');
const { getEpisodes, getTranscript, getEpisodePath } = require('./lib/episodes');
const { read, writeAtomic, withLock, getAssignedRaters, cleanupStaleAssignments } = require('./lib/submissions');
const { validateSubmission } = require('./lib/validation');
const { responsesToCsv } = require('./lib/csv-export');
const { registerParticipant, findParticipant, verifyPassword } = require('./lib/participants');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim();

if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD missing. Set a strong ADMIN_PASSWORD environment variable before starting the server.');
  process.exit(1);
}

app.use(express.json());
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// --- Page routes (serve static HTML) ---

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/consent', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'consent.html'));
});

app.get('/registered', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registered.html'));
});

app.get('/consent-print', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'consent-print.html'));
});

app.get('/evaluate', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'evaluate.html'));
});

app.get('/complete', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'complete.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- Episode file routes (audio, PDF, transcript) ---

app.get('/api/episode/:code/transcript', (req, res) => {
  const code = req.params.code;
  if (!getEpisodes().includes(code)) {
    return res.status(404).json({ error: 'Aflevering niet gevonden.' });
  }
  try {
    const transcript = getTranscript(code);
    res.json(transcript);
  } catch (err) {
    console.error(`Error reading transcript for ${code}:`, err);
    res.status(500).json({ error: 'Kan transcript niet laden.' });
  }
});

app.get('/api/episode/:code/audio', (req, res) => {
  const code = req.params.code;
  if (!getEpisodes().includes(code)) {
    return res.status(404).json({ error: 'Aflevering niet gevonden.' });
  }
  const filePath = path.join(getEpisodePath(code), 'audio.mp3');
  res.sendFile(filePath);
});

app.get('/api/episode/:code/article', (req, res) => {
  const code = req.params.code;
  if (!getEpisodes().includes(code)) {
    return res.status(404).json({ error: 'Aflevering niet gevonden.' });
  }
  const filePath = path.join(getEpisodePath(code), 'article.pdf');
  res.sendFile(filePath);
});

// --- Registration ---
// POST /api/register — register a new participant with informed consent.
// Assigns a sequential rater code and derives a password from MD5.

app.post('/api/register', async (req, res) => {
  const body = req.body;

  try {
    const result = await withLock(() => {
      const data = read();
      return registerParticipant(data, body);
    });

    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Registration error:', err);
    res.status(503).json({ error: 'Server is bezet, probeer het opnieuw.' });
  }
});

// --- Assignment ---
// POST /api/assign — authenticate rater and assign an available episode.
// Uses file locking to prevent race conditions. Algorithm:
//   1. Verify rater code exists and password matches
//   2. Filter episodes: <5 assignments AND not yet assigned to this rater
//   3. Sort by fewest assignments (for even distribution), random on tie
//   4. Return { episode, title, role } or { done: true } if none available

app.post('/api/assign', async (req, res) => {
  const { rater, password } = req.body;

  if (!rater || typeof rater !== 'string' || !rater.trim()) {
    return res.status(400).json({ error: 'Beoordelaarscode is verplicht.' });
  }
  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ error: 'Wachtwoord is verplicht.' });
  }

  const raterTrimmed = rater.trim();

  // Verify participant exists
  const participant = findParticipant(raterTrimmed);
  if (!participant) {
    return res.status(401).json({ error: 'Onbekende beoordelaarscode. Heeft u zich al aangemeld?' });
  }

  // Verify password
  if (!verifyPassword(raterTrimmed, password.trim())) {
    return res.status(401).json({ error: 'Onjuist wachtwoord.' });
  }

  try {
    const result = await withLock(() => {
      const data = read();
      const episodes = getEpisodes();

      // Ensure all episodes have an assignments entry
      for (const ep of episodes) {
        if (!data.assignments[ep]) data.assignments[ep] = [];
      }

      // Find available episodes: <5 assignments AND not assigned to this rater
      const available = episodes.filter(ep => {
        const raters = getAssignedRaters(data.assignments, ep);
        return raters.length < 5 && !raters.includes(raterTrimmed);
      });

      if (available.length === 0) {
        return { done: true };
      }

      // Pick episode with fewest assignments (even distribution), random on tie
      available.sort((a, b) => {
        const diff = getAssignedRaters(data.assignments, a).length - getAssignedRaters(data.assignments, b).length;
        if (diff !== 0) return diff;
        return Math.random() - 0.5;
      });

      const chosen = available[0];
      data.assignments[chosen].push({ rater: raterTrimmed, assigned_at: new Date().toISOString() });
      writeAtomic(data);

      const { title } = getTranscript(chosen);
      return { episode: chosen, title, role: participant.role };
    });

    res.json(result);
  } catch (err) {
    console.error('Assignment error:', err);
    res.status(503).json({ error: 'Server is bezet, probeer het opnieuw.' });
  }
});

// --- Submission ---
// POST /api/submit — validate and persist a completed evaluation.
// Uses file locking. Checks for duplicate (episode + rater) before saving.

app.post('/api/submit', async (req, res) => {
  const body = req.body;
  const normalizedBody = {
    ...body,
    rater: typeof body?.rater === 'string' ? body.rater.trim() : body?.rater,
  };
  const episodes = getEpisodes();
  const errors = validateSubmission(normalizedBody, episodes);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    await withLock(() => {
      const data = read();
      const participant = (data.participants || []).find(p => p.code === normalizedBody.rater);

      if (!participant) {
        throw { status: 403, message: 'Onbekende beoordelaarscode.' };
      }

      if (participant.role !== normalizedBody.role) {
        throw { status: 400, message: 'Functie komt niet overeen met geregistreerde deelnemer.' };
      }

      const assignedRaters = getAssignedRaters(data.assignments, normalizedBody.episode);
      if (!assignedRaters.includes(normalizedBody.rater)) {
        throw { status: 403, message: 'Deze aflevering is niet aan uw beoordelaarscode toegewezen.' };
      }

      // Prevent duplicate submissions for the same episode + rater combination
      const duplicate = data.responses.find(
        r => r.episode === normalizedBody.episode && r.rater === normalizedBody.rater
      );
      if (duplicate) {
        throw { status: 409, message: 'U heeft deze aflevering al beoordeeld.' };
      }

      // Build response record with sanitized B entries
      const response = {
        episode: normalizedBody.episode,
        rater: normalizedBody.rater,
        role: participant.role,
        date: normalizedBody.date,
        submitted_at: new Date().toISOString(),
        A: normalizedBody.A,
        B: normalizedBody.B.map(b => ({
          paragraph: b.paragraph,
          score: b.nvt ? null : b.score,
          note: b.note || '',
          ...(b.nvt ? { nvt: true } : {}),
        })),
        C: normalizedBody.C,
      };

      data.responses.push(response);
      writeAtomic(data);
    });

    res.json({ success: true });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Submit error:', err);
    res.status(503).json({ error: 'Server is bezet, probeer het opnieuw.' });
  }
});

// --- Admin middleware (HTTP Basic Auth) ---

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).json({ error: 'Authenticatie vereist.' });
  }

  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const [, password] = decoded.split(':');

  if (password !== ADMIN_PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).json({ error: 'Ongeldig wachtwoord.' });
  }

  next();
}

// GET /api/admin/progress — return assignment/completion status per episode + participants
app.get('/api/admin/progress', adminAuth, (_req, res) => {
  const data = read();
  const episodes = getEpisodes();
  const progress = episodes.map(ep => {
    const raters = getAssignedRaters(data.assignments, ep);
    const completed = data.responses.filter(r => r.episode === ep);
    let title = ep;
    try { title = getTranscript(ep).title; } catch {}
    return {
      episode: ep,
      title,
      assigned: raters.length,
      completed: completed.length,
      raters,
    };
  });

  const totalCompleted = data.responses.length;
  const totalTarget = episodes.length * 5;

  // Include participants without exposing derived passwords
  const participants = (data.participants || []).map(p => ({
    code: p.code,
    name: p.name,
    role: p.role,
    consent_date: p.consent_date,
    registered_at: p.registered_at,
  }));

  res.json({ progress, totalCompleted, totalTarget, participants });
});

// GET /api/admin/export — download all responses as CSV
app.get('/api/admin/export', adminAuth, (_req, res) => {
  const data = read();
  if (data.responses.length === 0) {
    return res.status(404).json({ error: 'Nog geen beoordelingen.' });
  }
  const csv = responsesToCsv(data.responses);
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="vetrix-responses.csv"');
  res.send(csv);
});

// --- Server startup ---

const episodeCount = getEpisodes().length;
if (episodeCount === 0) {
  console.error('No complete episodes found in /episodes. Add episode directories with audio.mp3, article.pdf, and transcript.json.');
}

app.listen(PORT, () => {
  console.log(`Vetrix Validation Webapp running on port ${PORT}`);
  console.log(`Episodes available: ${episodeCount}`);
  console.log('Admin password: configured via ADMIN_PASSWORD env var');

  // Cleanup stale assignments (no response after 24h) — run on start and every hour
  cleanupStaleAssignments().catch(err => {
    console.error('Cleanup error:', err);
  });
  setInterval(() => {
    cleanupStaleAssignments().catch(err => {
      console.error('Cleanup error:', err);
    });
  }, 60 * 60 * 1000);
});
