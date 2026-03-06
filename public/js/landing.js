/**
 * Landing page script — handles rater login with code + password.
 *
 * Flow:
 *   1. Rater enters their code and password
 *   2. POST /api/assign → server verifies credentials and assigns an episode
 *   3. Assignment is stored in sessionStorage and user is redirected to /evaluate
 *   4. If no episodes are available, a "done" message is shown
 *
 * The rater code is pre-filled from the URL query parameter (?rater=R-01)
 * when returning from the /complete or /registered page.
 */

document.addEventListener('DOMContentLoaded', () => {
  const codeInput = document.getElementById('raterCode');
  const passwordInput = document.getElementById('raterPassword');
  const loginBtn = document.getElementById('loginBtn');
  const errorMsg = document.getElementById('errorMsg');
  const doneMsg = document.getElementById('doneMsg');

  // Pre-fill rater code from URL when returning from /complete or /registered
  const params = new URLSearchParams(window.location.search);
  if (params.get('rater')) {
    codeInput.value = params.get('rater');
    passwordInput.focus();
  }

  loginBtn.addEventListener('click', async () => {
    const rater = codeInput.value.trim();
    const password = passwordInput.value.trim();

    if (!rater) {
      showError('Voer uw beoordelaarscode in.');
      return;
    }
    if (!password) {
      showError('Voer uw wachtwoord in.');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Bezig...';
    hideError();

    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rater, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Er is een fout opgetreden.');
        return;
      }

      // All episodes fully assigned — show completion message
      if (data.done) {
        loginBtn.style.display = 'none';
        doneMsg.style.display = 'block';
        return;
      }

      // Store assignment in sessionStorage for the evaluate page
      sessionStorage.setItem('vetrix_assignment', JSON.stringify({
        episode: data.episode,
        title: data.title,
        rater,
        role: data.role,
      }));

      window.location.href = '/evaluate';
    } catch {
      showError('Kan geen verbinding maken met de server.');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Inloggen';
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
