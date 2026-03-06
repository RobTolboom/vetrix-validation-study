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

module.exports = { read, writeAtomic, withLock };
