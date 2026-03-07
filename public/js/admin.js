/**
 * Admin dashboard script — displays study progress, participants, and CSV export.
 *
 * Fetches /api/admin/progress (Basic Auth protected) and renders:
 *   - Overall progress bar and text
 *   - Participants table with codes, names, roles, and dates
 *   - Per-episode table with assigned/completed counts and rater codes
 *   - CSV export button (downloads /api/admin/export)
 *
 * If the API returns 401, the page reloads to trigger the browser's
 * built-in Basic Auth dialog.
 */

document.addEventListener('DOMContentLoaded', () => {
  loadProgress();

  document.getElementById('exportBtn').addEventListener('click', () => {
    window.location.href = '/api/admin/export';
  });
});

/** Fetch progress data from the API and render the dashboard. */
async function loadProgress() {
  try {
    const res = await fetch('/api/admin/progress');
    if (res.status === 401) {
      // Reload to trigger the browser's Basic Auth dialog
      window.location.reload();
      return;
    }
    const data = await res.json();

    // Update overall progress bar
    const pct = data.totalTarget > 0
      ? Math.round((data.totalCompleted / data.totalTarget) * 100)
      : 0;
    document.getElementById('totalProgress').style.width = pct + '%';
    document.getElementById('totalText').textContent =
      `${data.totalCompleted} van ${data.totalTarget} beoordelingen voltooid (${pct}%)`;

    // Populate participants table
    const participantsTbody = document.querySelector('#participantsTable tbody');
    participantsTbody.innerHTML = '';

    if (data.participants && data.participants.length > 0) {
      document.getElementById('participantsText').textContent =
        `${data.participants.length} geregistreerde deelnemer(s)`;

      for (const p of data.participants) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.code}</strong></td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.role)}</td>
          <td>${p.consent_date || '—'}</td>
        `;
        participantsTbody.appendChild(tr);
      }
    } else {
      document.getElementById('participantsText').textContent = 'Nog geen deelnemers geregistreerd.';
    }

    // Populate per-episode table rows
    const tbody = document.querySelector('#progressTable tbody');
    tbody.innerHTML = '';

    for (const ep of data.progress) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${ep.episode}</strong></td>
        <td>${escapeHtml(ep.title)}</td>
        <td>${ep.assigned} / 5</td>
        <td>${ep.completed} / 5</td>
        <td>${ep.raters.length > 0 ? ep.raters.join(', ') : '<em style="color:var(--muted)">—</em>'}</td>
      `;
      tbody.appendChild(tr);
    }
  } catch {
    document.getElementById('totalText').textContent = 'Kan gegevens niet laden.';
  }
}

/** Safely escape text for insertion into innerHTML. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
