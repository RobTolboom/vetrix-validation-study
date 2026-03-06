document.addEventListener('DOMContentLoaded', () => {
  loadProgress();

  document.getElementById('exportBtn').addEventListener('click', () => {
    window.location.href = '/api/admin/export';
  });
});

async function loadProgress() {
  try {
    const res = await fetch('/api/admin/progress');
    if (res.status === 401) {
      // Browser will show Basic Auth dialog on reload
      window.location.reload();
      return;
    }
    const data = await res.json();

    // Total progress
    const pct = data.totalTarget > 0
      ? Math.round((data.totalCompleted / data.totalTarget) * 100)
      : 0;
    document.getElementById('totalProgress').style.width = pct + '%';
    document.getElementById('totalText').textContent =
      `${data.totalCompleted} van ${data.totalTarget} beoordelingen voltooid (${pct}%)`;

    // Table rows
    const tbody = document.querySelector('#progressTable tbody');
    tbody.innerHTML = '';

    for (const ep of data.progress) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${ep.episode}</strong></td>
        <td>${ep.title}</td>
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
