/**
 * Server-side validation for evaluation submissions.
 *
 * Validates the complete request body before persisting to submissions.json.
 * Error messages are in Dutch to match the UI language.
 */

const VALID_ROLES = ['Anesthesioloog', 'AIOS anesthesiologie'];

/**
 * Validate an evaluation submission body.
 * Returns an array of error messages (empty = valid).
 *
 * Validates:
 *  - episode: must be a known episode code
 *  - rater: non-empty string
 *  - role: must be one of VALID_ROLES
 *  - date: YYYY-MM-DD format
 *  - A: object with A1-A4, each containing score 1-5
 *  - B: array of paragraph scores, each 1-5 (or nvt=true for paragraph 1 only)
 *  - C: object with C1-C2, each containing score 1-5
 *
 * @param {object} body - The request body
 * @param {string[]} validEpisodes - List of valid episode codes
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateSubmission(body, validEpisodes) {
  const errors = [];

  if (!body.episode || !validEpisodes.includes(body.episode)) {
    errors.push('Ongeldig afleveringsnummer.');
  }
  if (!body.rater || typeof body.rater !== 'string' || !body.rater.trim()) {
    errors.push('Beoordelaarscode is verplicht.');
  }
  if (!VALID_ROLES.includes(body.role)) {
    errors.push('Ongeldige functie.');
  }
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    errors.push('Ongeldige datum.');
  }

  // Section A: Presentation quality (A1-A4, each scored 1-5)
  if (!body.A || typeof body.A !== 'object') {
    errors.push('Onderdeel A ontbreekt.');
  } else {
    for (const key of ['A1', 'A2', 'A3', 'A4']) {
      const item = body.A[key];
      if (!item || !Number.isInteger(item.score) || item.score < 1 || item.score > 5) {
        errors.push(`${key}: score 1-5 is verplicht.`);
      }
    }
  }

  // Section B: Per-paragraph accuracy (array of scores)
  if (!Array.isArray(body.B) || body.B.length === 0) {
    errors.push('Onderdeel B: minimaal één paragraaf vereist.');
  } else {
    for (let i = 0; i < body.B.length; i++) {
      const item = body.B[i];
      if (!Number.isInteger(item?.paragraph) || item.paragraph < 1) {
        errors.push(`B paragraaf ${i + 1}: ongeldig paragraafnummer.`);
      } else if (item.nvt === true && item.paragraph === 1) {
        // "Not applicable" is allowed for paragraph 1 only (intro/hook paragraph
        // that is not derived from the source article)
      } else if (!item || !Number.isInteger(item.score) || item.score < 1 || item.score > 5) {
        errors.push(`B paragraaf ${i + 1}: score 1-5 is verplicht.`);
      }
    }
  }

  // Section C: Global assessment (C1-C2, each scored 1-5)
  if (!body.C || typeof body.C !== 'object') {
    errors.push('Onderdeel C ontbreekt.');
  } else {
    for (const key of ['C1', 'C2']) {
      const item = body.C[key];
      if (!item || !Number.isInteger(item.score) || item.score < 1 || item.score > 5) {
        errors.push(`${key}: score 1-5 is verplicht.`);
      }
    }
  }

  return errors;
}

module.exports = { validateSubmission };
