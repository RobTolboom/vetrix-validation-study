/**
 * Participant management module — registration, code generation, password derivation.
 *
 * Handles the informed consent registration flow:
 *   - Assigns sequential rater codes (R-01, R-02, ...)
 *   - Derives passwords from MD5 hash of rater code (last 3 chars)
 *   - Stores participant data (name, role, consent, date) in submissions.json
 *
 * Password derivation is deterministic — no need to store passwords.
 * The admin can always recalculate a participant's password from their code.
 */

const crypto = require('crypto');
const { read, writeAtomic } = require('./submissions');

/**
 * Derive a 3-character password from a rater code using MD5.
 * @param {string} raterCode - e.g. "R-01"
 * @returns {string} Last 3 characters of the MD5 hex digest
 */
function derivePassword(raterCode) {
  return crypto.createHash('md5').update(raterCode).digest('hex').slice(-3);
}

/**
 * Generate the next available rater code (R-01, R-02, ...).
 * @param {Array} participants - Current participants array from submissions.json
 * @returns {string} Next rater code
 */
function nextRaterCode(participants) {
  const num = (participants || []).length + 1;
  return 'R-' + String(num).padStart(2, '0');
}

/**
 * Register a new participant. Must be called inside withLock().
 *
 * @param {object} data - The full submissions.json data object
 * @param {object} registration - { name, role, consent: {c1..c5: true}, consent_date }
 * @returns {{ code: string, password: string }} Assigned credentials
 * @throws {object} { status, message } if validation fails
 */
function registerParticipant(data, registration) {
  if (!data.participants) data.participants = [];

  const { name, role, consent, consent_date } = registration;

  // Validate required fields
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw { status: 400, message: 'Naam is verplicht.' };
  }
  if (!['Anesthesioloog', 'AIOS anesthesiologie'].includes(role)) {
    throw { status: 400, message: 'Selecteer een geldige functie.' };
  }

  // Validate all 5 consent checkboxes
  const consentKeys = ['c1', 'c2', 'c3', 'c4', 'c5'];
  if (!consent || !consentKeys.every(k => consent[k] === true)) {
    throw { status: 400, message: 'Alle toestemmingsvragen moeten worden aangevinkt.' };
  }

  // Check for duplicate name
  const nameTrimmed = name.trim();
  const existing = data.participants.find(
    p => p.name.toLowerCase() === nameTrimmed.toLowerCase()
  );
  if (existing) {
    throw { status: 409, message: 'Er is al een deelnemer geregistreerd met deze naam. Uw beoordelaarscode is: ' + existing.code };
  }

  const code = nextRaterCode(data.participants);
  const password = derivePassword(code);

  data.participants.push({
    code,
    name: nameTrimmed,
    role,
    consent: {
      c1: true, c2: true, c3: true, c4: true, c5: true,
    },
    consent_date: consent_date || new Date().toISOString().split('T')[0],
    registered_at: new Date().toISOString(),
  });

  writeAtomic(data);

  return { code, password };
}

/**
 * Find a participant by their rater code.
 * @param {string} code - Rater code (e.g. "R-01")
 * @returns {object|null} Participant object or null
 */
function findParticipant(code) {
  const data = read();
  if (!data.participants) return null;
  return data.participants.find(p => p.code === code) || null;
}

/**
 * Verify a rater's password.
 * @param {string} code - Rater code
 * @param {string} password - Password to verify
 * @returns {boolean} True if password matches
 */
function verifyPassword(code, password) {
  return derivePassword(code) === password;
}

module.exports = { derivePassword, nextRaterCode, registerParticipant, findParticipant, verifyPassword };
