const VALID_ROLES = ['Anesthesioloog', 'AIOS anesthesiologie'];

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

  // Section A: A1-A4
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

  // Section B: array of paragraph scores
  if (!Array.isArray(body.B) || body.B.length === 0) {
    errors.push('Onderdeel B: minimaal één paragraaf vereist.');
  } else {
    for (let i = 0; i < body.B.length; i++) {
      const item = body.B[i];
      if (!item || !Number.isInteger(item.score) || item.score < 1 || item.score > 5) {
        errors.push(`B paragraaf ${i + 1}: score 1-5 is verplicht.`);
      }
      if (!Number.isInteger(item.paragraph) || item.paragraph < 1) {
        errors.push(`B paragraaf ${i + 1}: ongeldig paragraafnummer.`);
      }
    }
  }

  // Section C: C1-C2
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
