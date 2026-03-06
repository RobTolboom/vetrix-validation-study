/**
 * Evaluation form script — the main scoring interface.
 *
 * This page loads the assignment from sessionStorage (set by the landing page),
 * fetches the transcript from the API, and renders the scoring form with:
 *   - Section A: Presentation quality (A1-A4, 5-point Likert scale)
 *   - Section B: Per-paragraph content accuracy (dynamic, from transcript)
 *   - Section C: Global assessment (C1-C2, 5-point Likert scale)
 *
 * Special features:
 *   - Paragraph 1 has a "Not applicable" button (intro/hook not from source)
 *   - Progress bar tracks completion across all sections
 *   - beforeunload warning prevents accidental page close with unsaved data
 *   - Score summary shown before final submission
 */

/** Current assignment data from sessionStorage: { episode, title, rater, role } */
let assignment = null;
/** Array of transcript paragraphs: [{ id, text }, ...] */
let paragraphs = [];
/** Set of paragraph IDs marked as "Not applicable" */
const nvtParagraphs = new Set();

document.addEventListener('DOMContentLoaded', () => {
  // Load assignment from sessionStorage (set by landing page after /api/assign)
  const raw = sessionStorage.getItem('vetrix_assignment');
  if (!raw) {
    window.location.href = '/';
    return;
  }

  assignment = JSON.parse(raw);
  initPage();
});

/** Initialize the evaluation page: fill meta fields, load media, fetch transcript. */
async function initPage() {
  // Fill read-only identification fields
  document.getElementById('meta_episode').value = assignment.episode + ' — ' + assignment.title;
  document.getElementById('meta_rater').value = assignment.rater;
  document.getElementById('meta_role').value = assignment.role;
  document.getElementById('meta_date').value = new Date().toISOString().split('T')[0];

  // Set audio source for the podcast player
  const audioSource = document.getElementById('audioSource');
  audioSource.src = '/api/episode/' + assignment.episode + '/audio';
  document.getElementById('audioPlayer').load();

  // Set PDF source for the embedded article viewer
  const pdfUrl = '/api/episode/' + assignment.episode + '/article';
  document.getElementById('pdfViewer').src = pdfUrl;
  document.getElementById('pdfLink').href = pdfUrl;

  // Fetch transcript and render paragraph scoring blocks
  try {
    const res = await fetch('/api/episode/' + assignment.episode + '/transcript');
    const data = await res.json();
    paragraphs = data.paragraphs;
    renderParagraphs();
  } catch {
    document.getElementById('paragraphs-container').innerHTML =
      '<p style="color:var(--red);">Kan transcript niet laden.</p>';
  }

  document.getElementById('submitBtn').addEventListener('click', submitEvaluation);

  // Click on step indicator dots scrolls to the corresponding section
  document.querySelectorAll('.step-dot').forEach(dot => {
    dot.style.cursor = 'pointer';
    dot.addEventListener('click', () => {
      const step = dot.getAttribute('data-step');
      const target = document.getElementById('step' + step);
      if (target) {
        const headerHeight = document.querySelector('.page-header').offsetHeight;
        const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // Warn before navigating away with unsaved input (stored as named function for removal)
  window.addEventListener('beforeunload', beforeUnloadHandler);

  // Update progress bar on any radio/select change
  document.addEventListener('change', updateProgress);
}

/**
 * Render paragraph scoring blocks in Section B.
 * Each paragraph gets a collapsible block with the transcript text,
 * a 5-point Likert scale, an optional note field, and (for paragraph 1 only)
 * a "Not applicable" button.
 */
function renderParagraphs() {
  const container = document.getElementById('paragraphs-container');
  container.innerHTML = '';

  const labels = ['Zeer oneens', 'Oneens', 'Neutraal', 'Eens', 'Volledig eens'];
  const anchors = [
    'Feitelijk onjuist; klinisch misleidend', '',
    'Kern correct; nuances ontbreken', '',
    'Volledig accuraat; geen misleidende vereenvoudigingen'
  ];

  for (const para of paragraphs) {
    const isFirst = para.id === 1;
    const div = document.createElement('div');
    div.className = 'para-block';
    div.id = 'para_' + para.id;
    div.innerHTML = `
      <div class="para-header" onclick="togglePara(${para.id})">
        <span>Paragraaf ${para.id}</span>
        <span class="para-status pending" id="para_status_${para.id}">Niet ingevuld</span>
      </div>
      <div class="para-body" id="para_body_${para.id}">
        <div class="para-text">${escapeHtml(para.text)}</div>
        <div class="criterion-def" style="margin-bottom:10px;">"De informatie in deze paragraaf is medisch accuraat en consistent met het bronartikel."</div>
        <div class="likert-row">
          ${[1,2,3,4,5].map(s => `
            <div class="likert-option" data-score="${s}">
              <input type="radio" name="B${para.id}" id="B${para.id}_${s}" value="${s}" onchange="updateParaStatus(${para.id})">
              <label for="B${para.id}_${s}">
                <span class="score-num">${s}</span>
                <span class="score-label">${labels[s-1]}</span>
                <span class="score-anchor">${anchors[s-1]}</span>
              </label>
            </div>
          `).join('')}
        </div>
        ${isFirst ? `
        <div class="nvt-row" style="margin-top:10px;">
          <button type="button" class="btn-nvt" id="B${para.id}_nvt" onclick="toggleNvt(${para.id})">
            Niet van toepassing
          </button>
          <span class="nvt-hint">Deze paragraaf is een introductie en komt niet uit het bronartikel.</span>
        </div>
        ` : ''}
        <div class="note-field" style="margin-top:10px;">
          <label>Toelichting (optioneel; bij score 1-2 sterk aanbevolen)</label>
          <textarea id="B${para.id}_note" placeholder="Beschrijf de onnauwkeurigheid of fout..."></textarea>
        </div>
      </div>
    `;
    container.appendChild(div);
  }

  updateProgress();
}

/** Safely escape text for insertion into innerHTML. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Toggle collapse/expand of a section card (A, B, or C). */
function toggleSection(header) {
  header.classList.toggle('collapsed');
  header.nextElementSibling.classList.toggle('hidden');
}

/** Toggle visibility of a paragraph's scoring body. */
function togglePara(id) {
  const body = document.getElementById('para_body_' + id);
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

/** Update paragraph status badge when a Likert score is selected. Clears N/A state. */
function updateParaStatus(id) {
  // If a Likert score is selected, clear N/A state
  nvtParagraphs.delete(id);
  const nvtBtn = document.getElementById('B' + id + '_nvt');
  if (nvtBtn) nvtBtn.classList.remove('active');

  const val = document.querySelector('input[name="B' + id + '"]:checked');
  const status = document.getElementById('para_status_' + id);
  if (val) {
    status.textContent = 'Score: ' + val.value;
    status.className = 'para-status done';
  }
  updateProgress();
}

/**
 * Toggle "Not applicable" state for a paragraph (paragraph 1 only).
 * When active, clears any Likert selection and sets status to "N.v.t."
 */
function toggleNvt(id) {
  const isActive = nvtParagraphs.has(id);
  const btn = document.getElementById('B' + id + '_nvt');
  const status = document.getElementById('para_status_' + id);

  if (isActive) {
    // Deactivate n.v.t.
    nvtParagraphs.delete(id);
    btn.classList.remove('active');
    status.textContent = 'Niet ingevuld';
    status.className = 'para-status pending';
  } else {
    // Activate n.v.t. — clear any Likert selection
    nvtParagraphs.add(id);
    btn.classList.add('active');
    const radios = document.querySelectorAll('input[name="B' + id + '"]');
    radios.forEach(r => r.checked = false);
    status.textContent = 'N.v.t.';
    status.className = 'para-status done';
  }
  updateProgress();
}

/** Update the progress bar and step indicator based on completion state. */
function updateProgress() {
  const required = ['A1', 'A2', 'A3', 'A4', 'C1', 'C2'];
  let filled = required.filter(n => document.querySelector('input[name="' + n + '"]:checked')).length;
  let total = required.length + paragraphs.length;

  for (const para of paragraphs) {
    if (nvtParagraphs.has(para.id) || document.querySelector('input[name="B' + para.id + '"]:checked')) filled++;
  }

  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';

  // Update step indicator
  updateStepIndicator();
}

/** Update the step indicator dots based on section completion. */
function updateStepIndicator() {
  const dots = document.querySelectorAll('.step-dot');
  if (!dots.length) return;

  // Check which sections are complete
  const aKeys = ['A1', 'A2', 'A3', 'A4'];
  const cKeys = ['C1', 'C2'];
  const aComplete = aKeys.every(k => document.querySelector('input[name="' + k + '"]:checked'));
  const bComplete = paragraphs.length > 0 && paragraphs.every(p =>
    nvtParagraphs.has(p.id) || document.querySelector('input[name="B' + p.id + '"]:checked')
  );
  const cComplete = cKeys.every(k => document.querySelector('input[name="' + k + '"]:checked'));

  // Step completion: [1=audio, 2=A, 3=PDF, 4=B, 5=C]
  // Audio and PDF are "completed" once the user moves past them (heuristic: A has any input)
  const aAny = aKeys.some(k => document.querySelector('input[name="' + k + '"]:checked'));
  const bAny = paragraphs.some(p =>
    nvtParagraphs.has(p.id) || document.querySelector('input[name="B' + p.id + '"]:checked')
  );

  const stepStates = [
    aAny ? 'completed' : 'active',                       // Step 1: Podcast
    aComplete ? 'completed' : (aAny ? 'active' : ''),    // Step 2: Section A
    bAny ? 'completed' : (aComplete ? 'active' : ''),    // Step 3: Article
    bComplete ? 'completed' : (bAny ? 'active' : ''),    // Step 4: Section B
    cComplete ? 'completed' : (bComplete ? 'active' : ''), // Step 5: Section C
  ];

  dots.forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (stepStates[i]) dot.classList.add(stepStates[i]);
  });
}

/** Named beforeunload handler — stored as reference so it can be removed on submit. */
function beforeUnloadHandler(e) {
  if (hasAnyInput()) {
    e.preventDefault();
  }
}

/** Check if the user has made any selections (for beforeunload warning). */
function hasAnyInput() {
  return !!document.querySelector('input[type="radio"]:checked');
}

/** Collect all form data into a structured object for submission to /api/submit. */
function gatherData() {
  const data = {
    episode: assignment.episode,
    rater: assignment.rater,
    role: assignment.role,
    date: new Date().toISOString().split('T')[0],
    A: {},
    B: [],
    C: {},
  };

  for (const key of ['A1', 'A2', 'A3', 'A4']) {
    const v = document.querySelector('input[name="' + key + '"]:checked');
    data.A[key] = {
      score: v ? parseInt(v.value) : null,
      note: document.getElementById(key + '_note').value || '',
    };
  }

  for (const para of paragraphs) {
    const isNvt = nvtParagraphs.has(para.id);
    const v = document.querySelector('input[name="B' + para.id + '"]:checked');
    data.B.push({
      paragraph: para.id,
      score: isNvt ? null : (v ? parseInt(v.value) : null),
      note: document.getElementById('B' + para.id + '_note').value || '',
      nvt: isNvt,
    });
  }

  for (const key of ['C1', 'C2']) {
    const v = document.querySelector('input[name="' + key + '"]:checked');
    data.C[key] = {
      score: v ? parseInt(v.value) : null,
      note: document.getElementById(key + '_note').value || '',
    };
  }

  return data;
}

/** Client-side validation: all A/C scores required, all B paragraphs scored or N/A. */
function validate(data) {
  const aOk = ['A1', 'A2', 'A3', 'A4'].every(k => data.A[k].score !== null);
  const cOk = ['C1', 'C2'].every(k => data.C[k].score !== null);
  const bOk = data.B.length > 0 && data.B.every(b => b.nvt || b.score !== null);
  return aOk && cOk && bOk;
}

/** Display a score summary grid before final submission. Shows A scores, B mean, C scores. */
function showSummary(data) {
  const grid = document.getElementById('summaryGrid');
  const summary = document.getElementById('scoreSummary');
  const items = [
    ...Object.entries(data.A).map(([k, v]) => [k, v.score]),
    ['B (gem.)', (() => {
      const scored = data.B.filter(b => !b.nvt && b.score !== null);
      return scored.length > 0
        ? (scored.reduce((s, b) => s + b.score, 0) / scored.length).toFixed(1)
        : '—';
    })()],
    ...Object.entries(data.C).map(([k, v]) => [k, v.score]),
  ];
  grid.innerHTML = items.map(([label, val]) =>
    '<div class="summary-item"><div class="si-label">' + label + '</div><div class="si-val">' + (val ?? '—') + '</div></div>'
  ).join('');
  summary.style.display = 'block';
}

/**
 * Submit the evaluation: validate, show summary, POST to /api/submit.
 * On success: remove beforeunload handler, clear sessionStorage, redirect to /complete.
 */
async function submitEvaluation() {
  const data = gatherData();
  const msgEl = document.getElementById('validationMsg');

  if (!validate(data)) {
    msgEl.style.display = 'block';
    msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  msgEl.style.display = 'none';
  showSummary(data);

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Versturen...';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      const errMsg = result.errors ? result.errors.join('\n') : (result.error || 'Onbekende fout.');
      msgEl.textContent = errMsg;
      msgEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Verstuur beoordeling';
      return;
    }

    // Success — disable leave warning, clear session, redirect
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    sessionStorage.removeItem('vetrix_assignment');
    window.location.href = '/complete?rater=' + encodeURIComponent(assignment.rater);
  } catch {
    msgEl.textContent = 'Kan geen verbinding maken met de server.';
    msgEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verstuur beoordeling';
  }
}
