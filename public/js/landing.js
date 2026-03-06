document.addEventListener('DOMContentLoaded', () => {
  const raterInput = document.getElementById('raterCode');
  const roleSelect = document.getElementById('raterRole');
  const startBtn = document.getElementById('startBtn');
  const errorMsg = document.getElementById('errorMsg');
  const doneMsg = document.getElementById('doneMsg');

  // Pre-fill rater code from URL if returning
  const params = new URLSearchParams(window.location.search);
  if (params.get('rater')) {
    raterInput.value = params.get('rater');
  }

  startBtn.addEventListener('click', async () => {
    const rater = raterInput.value.trim();
    const role = roleSelect.value;

    // Client-side checks
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

      if (data.done) {
        startBtn.style.display = 'none';
        doneMsg.style.display = 'block';
        return;
      }

      // Store assignment in sessionStorage
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
