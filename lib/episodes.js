const fs = require('fs');
const path = require('path');

const EPISODES_DIR = path.join(__dirname, '..', 'episodes');
const REQUIRED_FILES = ['audio.mp3', 'article.pdf', 'transcript.json'];
const EPISODE_PATTERN = /^EP-\d{2}$/;

let cachedEpisodes = null;

function discoverEpisodes() {
  if (!fs.existsSync(EPISODES_DIR)) {
    console.error(`Episodes directory not found: ${EPISODES_DIR}`);
    return [];
  }

  const entries = fs.readdirSync(EPISODES_DIR, { withFileTypes: true });
  const episodes = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !EPISODE_PATTERN.test(entry.name)) continue;

    const epDir = path.join(EPISODES_DIR, entry.name);
    const missingFiles = REQUIRED_FILES.filter(
      f => !fs.existsSync(path.join(epDir, f))
    );

    if (missingFiles.length > 0) {
      console.warn(`Skipping ${entry.name}: missing ${missingFiles.join(', ')}`);
      continue;
    }

    episodes.push(entry.name);
  }

  episodes.sort();
  console.log(`Discovered ${episodes.length} complete episode(s): ${episodes.join(', ') || 'none'}`);
  return episodes;
}

function getEpisodes() {
  if (!cachedEpisodes) {
    cachedEpisodes = discoverEpisodes();
  }
  return cachedEpisodes;
}

function getTranscript(episodeCode) {
  const filePath = path.join(EPISODES_DIR, episodeCode, 'transcript.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  const title = data.metadata?.title || episodeCode;
  const paragraphs = data.transcript
    .split('\n\n')
    .filter(p => p.trim().length > 0)
    .map((text, i) => ({ id: i + 1, text: text.trim() }));

  return { title, paragraphs };
}

function getEpisodePath(episodeCode) {
  return path.join(EPISODES_DIR, episodeCode);
}

module.exports = { getEpisodes, getTranscript, getEpisodePath };
