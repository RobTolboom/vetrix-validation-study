/**
 * Submission storage module — read/write submissions.json with file locking.
 *
 * All study data (assignments and evaluation responses) is stored in a single
 * JSON file. Concurrent access is protected by proper-lockfile, and writes
 * are atomic (write to .tmp, then fs.rename).
 *
 * Data schema:
 *   { assignments: { [episode]: Array<{ rater, assigned_at }> },
 *     responses:   Array<EvaluationResponse> }
 */

const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

const DEFAULT_DATA = { assignments: {}, responses: [] };

/** Create the data/ directory if it does not exist. */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Read submissions.json from disk. Returns a deep-cloned default structure
 * if the file does not exist. If the file is corrupted, it is backed up
 * and the default structure is returned.
 */
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

/**
 * Atomically write data to submissions.json.
 * Writes to a .tmp file first, then renames — this prevents partial writes
 * from corrupting the file on crash or power loss.
 */
function writeAtomic(data) {
  ensureDataDir();
  const tmp = SUBMISSIONS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, SUBMISSIONS_FILE);
}

/**
 * Execute a function while holding an exclusive file lock on submissions.json.
 * Used by /api/assign and /api/submit to prevent race conditions.
 * Returns 503 to clients if the lock cannot be acquired within ~10 seconds.
 */
async function withLock(fn) {
  ensureDataDir();
  // Ensure the file exists before locking (lockfile requires an existing file)
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

/**
 * Extract rater codes from an episode's assignment list.
 * Supports both the current format ({ rater, assigned_at }) and legacy
 * plain-string entries for backwards compatibility.
 *
 * @param {object} assignments - The assignments object from submissions.json
 * @param {string} episode - Episode code (e.g. 'EP-01')
 * @returns {string[]} Array of rater codes
 */
function getAssignedRaters(assignments, episode) {
  const list = assignments[episode] || [];
  return list.map(entry => typeof entry === 'string' ? entry : entry.rater);
}

/**
 * Remove stale assignments that have no matching response after maxAgeMs.
 * This handles the case where a rater was assigned an episode but never
 * submitted (e.g. closed the browser). Runs on startup and hourly.
 *
 * @param {number} maxAgeMs - Maximum assignment age in ms (default: 24 hours)
 * @returns {number} Number of removed stale assignments
 */
function cleanupStaleAssignments(maxAgeMs = 24 * 60 * 60 * 1000) {
  const data = read();
  const now = Date.now();
  let removed = 0;

  for (const ep of Object.keys(data.assignments)) {
    const original = data.assignments[ep] || [];
    data.assignments[ep] = original.filter(entry => {
      // Legacy string entries: keep only if they have a matching response
      if (typeof entry === 'string') {
        return data.responses.some(r => r.episode === ep && r.rater === entry);
      }
      // Has a response? Always keep.
      if (data.responses.some(r => r.episode === ep && r.rater === entry.rater)) {
        return true;
      }
      // No response — remove if older than maxAgeMs
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
