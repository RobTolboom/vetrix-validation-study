const express = require('express');
const path = require('path');
const fs = require('fs');
const { getEpisodes, getTranscript, getEpisodePath } = require('./lib/episodes');
const { read, writeAtomic, withLock } = require('./lib/submissions');
const { validateSubmission } = require('./lib/validation');
const { responsesToCsv } = require('./lib/csv-export');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

app.use(express.json());
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// --- Page routes ---

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
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

// --- Episode file routes ---

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

// --- Assignment ---

app.post('/api/assign', async (req, res) => {
  const { rater, role } = req.body;

  if (!rater || typeof rater !== 'string' || !rater.trim()) {
    return res.status(400).json({ error: 'Beoordelaarscode is verplicht.' });
  }
  if (!['Anesthesioloog', 'AIOS anesthesiologie'].includes(role)) {
    return res.status(400).json({ error: 'Selecteer een geldige functie.' });
  }

  const raterTrimmed = rater.trim();

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
        const assigned = data.assignments[ep] || [];
        return assigned.length < 5 && !assigned.includes(raterTrimmed);
      });

      if (available.length === 0) {
        return { done: true };
      }

      // Pick episode with fewest assignments (even distribution), random on tie
      available.sort((a, b) => {
        const diff = (data.assignments[a]?.length || 0) - (data.assignments[b]?.length || 0);
        if (diff !== 0) return diff;
        return Math.random() - 0.5;
      });

      const chosen = available[0];
      data.assignments[chosen].push(raterTrimmed);
      writeAtomic(data);

      const { title } = getTranscript(chosen);
      return { episode: chosen, title };
    });

    res.json(result);
  } catch (err) {
    console.error('Assignment error:', err);
    res.status(503).json({ error: 'Server is bezet, probeer het opnieuw.' });
  }
});

// --- Submission ---

app.post('/api/submit', async (req, res) => {
  const body = req.body;
  const episodes = getEpisodes();
  const errors = validateSubmission(body, episodes);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    await withLock(() => {
      const data = read();

      // Check for duplicate submission
      const duplicate = data.responses.find(
        r => r.episode === body.episode && r.rater === body.rater
      );
      if (duplicate) {
        throw { status: 409, message: 'U heeft deze aflevering al beoordeeld.' };
      }

      // Build response record
      const response = {
        episode: body.episode,
        rater: body.rater,
        role: body.role,
        date: body.date,
        submitted_at: new Date().toISOString(),
        A: body.A,
        B: body.B.map(b => ({
          paragraph: b.paragraph,
          score: b.score,
          note: b.note || '',
        })),
        C: body.C,
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

// --- Admin middleware ---

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

app.get('/api/admin/progress', adminAuth, (_req, res) => {
  const data = read();
  const episodes = getEpisodes();
  const progress = episodes.map(ep => {
    const assigned = data.assignments[ep] || [];
    const completed = data.responses.filter(r => r.episode === ep);
    let title = ep;
    try { title = getTranscript(ep).title; } catch {}
    return {
      episode: ep,
      title,
      assigned: assigned.length,
      completed: completed.length,
      raters: assigned,
    };
  });

  const totalCompleted = data.responses.length;
  const totalTarget = episodes.length * 5;

  res.json({ progress, totalCompleted, totalTarget });
});

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

// --- Start ---

const episodeCount = getEpisodes().length;
if (episodeCount === 0) {
  console.error('No complete episodes found in /episodes. Add episode directories with audio.mp3, article.pdf, and transcript.json.');
}

app.listen(PORT, () => {
  console.log(`Vetrix Validation Webapp running on port ${PORT}`);
  console.log(`Episodes available: ${episodeCount}`);
  console.log(`Admin password: ${ADMIN_PASSWORD === 'admin' ? '⚠️  Using default (set ADMIN_PASSWORD env var)' : '✓ Custom password set'}`);
});
