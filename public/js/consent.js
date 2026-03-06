/**
 * Consent page script — handles participant registration with informed consent.
 *
 * Flow:
 *   1. Participant reads informatiebrief
 *   2. Checks all 5 consent checkboxes
 *   3. Enters name, selects role, confirms date
 *   4. POST /api/register → server assigns rater code + password
 *   5. Redirect to /registered with credentials in sessionStorage
 */

document.addEventListener('DOMContentLoaded', () => {
  const registerBtn = document.getElementById('registerBtn');
  const errorMsg = document.getElementById('errorMsg');
  const nameInput = document.getElementById('participantName');
  const roleSelect = document.getElementById('participantRole');
  const dateInput = document.getElementById('consentDate');

  // Auto-fill today's date
  dateInput.value = new Date().toISOString().split('T')[0];

  registerBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const role = roleSelect.value;

    // Validate checkboxes
    const checkboxIds = ['consent_c1', 'consent_c2', 'consent_c3', 'consent_c4', 'consent_c5'];
    const allChecked = checkboxIds.every(id => document.getElementById(id).checked);
    if (!allChecked) {
      showError('U dient alle vijf toestemmingsvragen aan te vinken om deel te nemen.');
      return;
    }

    if (!name) {
      showError('Voer uw naam in.');
      return;
    }

    if (!role) {
      showError('Selecteer uw functie.');
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = 'Registreren...';
    hideError();

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          role,
          consent: {
            c1: true, c2: true, c3: true, c4: true, c5: true,
          },
          consent_date: dateInput.value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Er is een fout opgetreden.');
        registerBtn.disabled = false;
        registerBtn.textContent = 'Registreren';
        return;
      }

      // Store credentials for the registered page
      sessionStorage.setItem('vetrix_registration', JSON.stringify({
        code: data.code,
        password: data.password,
        name,
      }));

      window.location.href = '/registered';
    } catch {
      showError('Kan geen verbinding maken met de server.');
      registerBtn.disabled = false;
      registerBtn.textContent = 'Registreren';
    }
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function hideError() {
    errorMsg.style.display = 'none';
  }
});
