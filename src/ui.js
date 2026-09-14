export function initUI({ states, onTab, onBack, onAlt, onHaie }) {
  document.getElementById('btn-alt').addEventListener('click', onAlt);
  for (const b of document.querySelectorAll('#haie-switch button'))
    b.addEventListener('click', () => onHaie(b.dataset.haie));
  const tabs = document.getElementById('tabs');
  for (const s of states) {
    const b = document.createElement('button');
    b.textContent = s.label;
    b.dataset.state = s.id;
    b.addEventListener('click', () => onTab(s.id));
    tabs.appendChild(b);
  }
  document.getElementById('btn-back').addEventListener('click', onBack);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') onBack(); });
}

export function setActiveTab(stateId) {
  for (const b of document.querySelectorAll('#tabs button'))
    b.classList.toggle('active', b.dataset.state === stateId);
}

// null = caché ; 'sans' / 'avec' = état actif du sélecteur (cadre coulissant)
export function setHaieSwitch(state) {
  const el = document.getElementById('haie-switch');
  el.hidden = state == null;
  if (state == null) return;
  el.classList.toggle('avec', state === 'avec');
  for (const b of el.querySelectorAll('button'))
    b.classList.toggle('active', b.dataset.haie === state);
}

// null = caché ; 'toDrone' / 'toGround' = libellé de la bascule sol ↔ drone
export function setAltButton(mode) {
  const b = document.getElementById('btn-alt');
  b.hidden = mode == null;
  if (mode) b.textContent = mode === 'toDrone' ? '🚁 Vue drone' : '📷 Vue au sol';
}

export function setTabEnabled(stateId, enabled) {
  const b = document.querySelector(`#tabs button[data-state="${stateId}"]`);
  if (b) b.disabled = !enabled;
}

export function setScreen(screen) { document.body.dataset.screen = screen; }

export function setLoading(pct) {
  const overlay = document.getElementById('load-overlay');
  if (pct == null) { overlay.classList.add('hidden'); return; }
  overlay.classList.remove('hidden');
  document.getElementById('load-bar').style.width = Math.round(pct * 100) + '%';
}

export function showBanner(lines) {
  const b = document.getElementById('banner');
  b.textContent = lines.join(' — ');
  b.style.display = lines.length ? 'block' : 'none';
}
