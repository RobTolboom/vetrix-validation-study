let assignment = null;
let paragraphs = [];

document.addEventListener('DOMContentLoaded', () => {
  // Load assignment from sessionStorage
  const raw = sessionStorage.getItem('vetrix_assignment');
  if (!raw) {
    window.location.href = '/';
    return;
  }

  assignment = JSON.parse(raw);
  initPage();
});

async function initPage() {
  // Fill meta fields
  document.getElementById('meta_episode').value = assignment.episode + ' — ' + assignment.title;
  document.getElementById('meta_rater').value = assignment.rater;
  document.getElementById('meta_role').value = assignment.role;
  document.getElementById('meta_date').value = new Date().toISOString().split('T')[0];

  // Set audio source
  const audioSource = document.getElementById('audioSource');
  audioSource.src = '/api/episode/' + assignment.episode + '/audio';
  document.getElementById('audioPlayer').load();

  // Set PDF source
  const pdfUrl = '/api/episode/' + assignment.episode + '/article';
  document.getElementById('pdfViewer').src = pdfUrl;
  document.getElementById('pdfLink').href = pdfUrl;

  // Load transcript paragraphs
  try {
    const res = await fetch('/api/episode/' + assignment.episode + '/transcript');
    const data = await res.json();
    paragraphs = data.paragraphs;
    renderParagraphs();
  } catch {
    document.getElementById('paragraphs-container').innerHTML =
      '<p style="color:var(--red);">Kan transcript niet laden.</p>';
  }

  // Bind submit
  document.getElementById('submitBtn').addEventListener('click', submitEvaluation);

  // Warn on leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasAnyInput()) {
      e.preventDefault();
    }
  });

  // Listen for progress updates
  document.addEventListener('change', updateProgress);
}

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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toggleSection(header) {
  header.classList.toggle('collapsed');
  header.nextElementSibling.classList.toggle('hidden');
}

function togglePara(id) {
  const body = document.getElementById('para_body_' + id);
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

function updateParaStatus(id) {
  const val = document.querySelector('input[name="B' + id + '"]:checked');
  const status = document.getElementById('para_status_' + id);
  if (val) {
    status.textContent = 'Score: ' + val.value;
    status.className = 'para-status done';
  }
  updateProgress();
}

function updateProgress() {
  const required = ['A1', 'A2', 'A3', 'A4', 'C1', 'C2'];
  let filled = required.filter(n => document.querySelector('input[name="' + n + '"]:checked')).length;
  let total = required.length + paragraphs.length;

  for (const para of paragraphs) {
    if (document.querySelector('input[name="B' + para.id + '"]:checked')) filled++;
  }

  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
}

function hasAnyInput() {
  return !!document.querySelector('input[type="radio"]:checked');
}

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
    const v = document.querySelector('input[name="B' + para.id + '"]:checked');
    data.B.push({
      paragraph: para.id,
      score: v ? parseInt(v.value) : null,
      note: document.getElementById('B' + para.id + '_note').value || '',
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

function validate(data) {
  const aOk = ['A1', 'A2', 'A3', 'A4'].every(k => data.A[k].score !== null);
  const cOk = ['C1', 'C2'].every(k => data.C[k].score !== null);
  const bOk = data.B.length > 0 && data.B.every(b => b.score !== null);
  return aOk && cOk && bOk;
}

function showSummary(data) {
  const grid = document.getElementById('summaryGrid');
  const summary = document.getElementById('scoreSummary');
  const items = [
    ...Object.entries(data.A).map(([k, v]) => [k, v.score]),
    ['B (gem.)', data.B.length > 0
      ? (data.B.reduce((s, b) => s + (b.score || 0), 0) / data.B.length).toFixed(1)
      : '—'],
    ...Object.entries(data.C).map(([k, v]) => [k, v.score]),
  ];
  grid.innerHTML = items.map(([label, val]) =>
    '<div class="summary-item"><div class="si-label">' + label + '</div><div class="si-val">' + (val ?? '—') + '</div></div>'
  ).join('');
  summary.style.display = 'block';
}

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

    // Success — clear session and redirect
    sessionStorage.removeItem('vetrix_assignment');
    window.removeEventListener('beforeunload', () => {});
    window.location.href = '/complete?rater=' + encodeURIComponent(assignment.rater);
  } catch {
    msgEl.textContent = 'Kan geen verbinding maken met de server.';
    msgEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verstuur beoordeling';
  }
}
