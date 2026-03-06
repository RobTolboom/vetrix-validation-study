function escapeCsv(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function responsesToCsv(responses) {
  // Find max number of B paragraphs across all responses
  let maxB = 0;
  for (const r of responses) {
    if (r.B && r.B.length > maxB) maxB = r.B.length;
  }

  // Build header
  const headers = [
    'episode', 'rater', 'role', 'date', 'submitted_at',
    'A1_score', 'A1_note', 'A2_score', 'A2_note',
    'A3_score', 'A3_note', 'A4_score', 'A4_note',
    'B_count', 'B_mean',
  ];
  for (let i = 1; i <= maxB; i++) {
    headers.push(`B${i}_score`, `B${i}_note`);
  }
  headers.push('C1_score', 'C1_note', 'C2_score', 'C2_note');

  // Build rows
  const rows = [headers.map(escapeCsv).join(',')];

  for (const r of responses) {
    const scoredB = (r.B || []).filter(b => !b.nvt && b.score != null);
    const bMean = scoredB.length > 0
      ? (scoredB.reduce((s, b) => s + b.score, 0) / scoredB.length).toFixed(2)
      : '';

    const cols = [
      r.episode, r.rater, r.role, r.date, r.submitted_at,
      r.A?.A1?.score, r.A?.A1?.note, r.A?.A2?.score, r.A?.A2?.note,
      r.A?.A3?.score, r.A?.A3?.note, r.A?.A4?.score, r.A?.A4?.note,
      (r.B || []).length, bMean,
    ];
    for (let i = 0; i < maxB; i++) {
      const b = r.B?.[i];
      cols.push(b?.nvt ? 'N.v.t.' : b?.score, b?.note);
    }
    cols.push(r.C?.C1?.score, r.C?.C1?.note, r.C?.C2?.score, r.C?.C2?.note);

    rows.push(cols.map(escapeCsv).join(','));
  }

  return rows.join('\n');
}

module.exports = { responsesToCsv };
