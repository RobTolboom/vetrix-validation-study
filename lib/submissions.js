const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

const DEFAULT_DATA = { assignments: {}, responses: [] };

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function read() {
  ensureDataDir();
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  try {
    const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    const backup = SUBMISSIONS_FILE + `.corrupt.${Date.now()}`;
    console.error(`Corrupted submissions.json — backing up to ${backup}`);
    fs.copyFileSync(SUBMISSIONS_FILE, backup);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function writeAtomic(data) {
  ensureDataDir();
  const tmp = SUBMISSIONS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, SUBMISSIONS_FILE);
}

async function withLock(fn) {
  ensureDataDir();
  // Ensure the file exists before locking
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    writeAtomic(JSON.parse(JSON.stringify(DEFAULT_DATA)));
  }
  const release = await lockfile.lock(SUBMISSIONS_FILE, {
    retries: { retries: 5, minTimeout: 200, maxTimeout: 2000 },
    stale: 10000,
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}

// --- Assignment helpers for the new {rater, assigned_at} format ---

function getAssignedRaters(assignments, episode) {
  const list = assignments[episode] || [];
  return list.map(entry => typeof entry === 'string' ? entry : entry.rater);
}

function cleanupStaleAssignments(maxAgeMs = 24 * 60 * 60 * 1000) {
  const data = read();
  const now = Date.now();
  let removed = 0;

  for (const ep of Object.keys(data.assignments)) {
    const original = data.assignments[ep] || [];
    data.assignments[ep] = original.filter(entry => {
      // Legacy string entries: keep if they have a matching response
      if (typeof entry === 'string') {
        return data.responses.some(r => r.episode === ep && r.rater === entry);
      }
      // Has a response? Always keep.
      if (data.responses.some(r => r.episode === ep && r.rater === entry.rater)) {
        return true;
      }
      // No response — check age
      const age = now - new Date(entry.assigned_at).getTime();
      if (age > maxAgeMs) {
        removed++;
        return false;
      }
      return true;
    });
  }

  if (removed > 0) {
    writeAtomic(data);
    console.log(`Cleanup: removed ${removed} stale assignment(s) older than ${Math.round(maxAgeMs / 3600000)}h without response.`);
  }
  return removed;
}

module.exports = { read, writeAtomic, withLock, getAssignedRaters, cleanupStaleAssignments };
