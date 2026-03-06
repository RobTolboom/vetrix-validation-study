/**
 * Landing page script — handles rater identification and episode assignment.
 *
 * Flow:
 *   1. Rater enters their code and selects their role
 *   2. POST /api/assign → server assigns an available episode
 *   3. Assignment is stored in sessionStorage and user is redirected to /evaluate
 *   4. If no episodes are available, a "done" message is shown
 *
 * The rater code is pre-filled from the URL query parameter (?rater=R-01)
 * when returning from the /complete page.
 */

document.addEventListener('DOMContentLoaded', () => {
  const raterInput = document.getElementById('raterCode');
  const roleSelect = document.getElementById('raterRole');
  const startBtn = document.getElementById('startBtn');
  const errorMsg = document.getElementById('errorMsg');
  const doneMsg = document.getElementById('doneMsg');

  // Pre-fill rater code from URL when returning from /complete page
  const params = new URLSearchParams(window.location.search);
  if (params.get('rater')) {
    raterInput.value = params.get('rater');
  }

  startBtn.addEventListener('click', async () => {
    const rater = raterInput.value.trim();
    const role = roleSelect.value;

    // Client-side validation
    if (!rater) {
      showError('Voer uw beoordelaarscode in.');
      return;
    }
    if (!role) {
      showError('Selecteer uw functie.');
      return;
    }

    startBtn.disabled = true;
    startBtn.textContent = 'Bezig...';
    hideError();

    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rater, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Er is een fout opgetreden.');
        return;
      }

      // All episodes fully assigned — show completion message
      if (data.done) {
        startBtn.style.display = 'none';
        doneMsg.style.display = 'block';
        return;
      }

      // Store assignment in sessionStorage for the evaluate page
      sessionStorage.setItem('vetrix_assignment', JSON.stringify({
        episode: data.episode,
        title: data.title,
        rater,
        role,
      }));

      window.location.href = '/evaluate';
    } catch {
      showError('Kan geen verbinding maken met de server.');
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = 'Start beoordeling';
    }
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  function hideError() {
    errorMsg.style.display = 'none';
  }
});
