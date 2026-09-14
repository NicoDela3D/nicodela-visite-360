import { CONFIG } from './config.js';
import { validateConfig } from './validate.js';
import { resolveTabSwitch } from './pairing.js';
import { Plan } from './plan.js';
import { Markers } from './markers.js';
import { Pano } from './pano.js';
import * as ui from './ui.js';

const errors = validateConfig(CONFIG);
if (errors.length) { ui.showBanner(errors); console.error('config invalide :', errors); }

const stateById = id => CONFIG.states.find(s => s.id === id);
const app = { stateId: CONFIG.states[0].id, screen: 'plan', viewId: null, haie: false };

// panorama effectif d'une vue selon la bascule haie
const effectivePano = view => (app.haie && view.panoHaie) ? view.panoHaie : view.pano;

const plan = new Plan(document.getElementById('plan-wrap'), CONFIG.planCamera);
const markers = new Markers(document.getElementById('markers'), plan);
const pano = new Pano(document.getElementById('pano'));

pano.onYaw(psvYaw => {
  if (app.screen !== 'pano' || !app.viewId) return;
  const view = currentViews().find(v => v.id === app.viewId);
  if (view) plan.setGaze(view.position, view.yaw + psvYaw);
});

function currentViews() { return plan.viewData.get(app.stateId)?.views ?? []; }

async function activateState(id, { withOverlay = false } = {}) {
  const st = stateById(id);
  if (withOverlay) ui.setLoading(0);
  const { views, warnings } = await plan.loadState(st, p => withOverlay && ui.setLoading(p));
  warnings.forEach(w => console.warn(`[${id}] ${w}`));
  app.stateId = id;
  plan.showState(id);
  markers.setViews(views, { onSelect: openView });
  ui.setActiveTab(id);
  updateTabs();
  plan.setHaie(st, app.haie);   // applique l'état de la bascule au modèle 3D
  updateHaieUI();
  if (withOverlay) ui.setLoading(null);
  return views;
}

// sélecteur haie : visible seulement si l'état courant propose la variante
function updateHaieUI() {
  const st = stateById(app.stateId);
  const has = !!st.haie || currentViews().some(v => v.panoHaie);
  ui.setHaieSwitch(has ? (app.haie ? 'avec' : 'sans') : null);
}

// choix avec/sans haie : modèle 3D sur le plan + panorama courant (regard conservé)
async function setHaieState(target) {
  const want = target === 'avec';
  if (want === app.haie) return;
  app.haie = want;
  updateHaieUI();
  plan.setHaie(stateById(app.stateId), app.haie);
  if (app.screen !== 'pano') return;
  const view = currentViews().find(v => v.id === app.viewId);
  if (!view?.panoHaie) return;
  try {
    await pano.showVariant(effectivePano(view));
  } catch (e) {
    ui.showBanner(['Panorama introuvable : ' + view.label]);
    console.error(e);
  }
}

// onglets : tous cliquables en plan plein écran ; en panorama, un autre état
// n'est cliquable que si la vue courante y a un homologue (pair) — sinon grisé.
function updateTabs() {
  for (const s of CONFIG.states) {
    if (s.id === app.stateId) { ui.setTabEnabled(s.id, true); continue; }
    const ok = app.screen === 'plan' || resolveTabSwitch({
      screen: app.screen, viewId: app.viewId,
      fromState: stateById(app.stateId), toState: s,
    }).screen === 'pano';
    ui.setTabEnabled(s.id, ok);
  }
}

async function openView(view, position, opts) {
  // l'aperçu est chargé AVANT la bascule d'écran : le plan glisse vers le
  // coin pendant que le panorama, déjà rendu, apparaît dessous (pas de flash)
  try {
    await pano.open({ ...view, pano: effectivePano(view) }, position, opts);
  } catch (e) {
    ui.showBanner(['Panorama introuvable : ' + view.label]);
    console.error(e);
    return;
  }
  app.screen = 'pano';
  app.viewId = view.id;
  app.alt = false;
  ui.setScreen('pano');   // la transition CSS anime le plan vers le coin
  markers.setActive(view.id);
  plan.setGaze(view.position, (position?.yaw ?? 0) + view.yaw);
  ui.setAltButton(view.panoAlt ? 'toDrone' : null);
  updateTabs();
}

// bascule sol ↔ drone du point de vue courant, sans bouger le regard
async function toggleAlt() {
  const view = currentViews().find(v => v.id === app.viewId);
  if (!view?.panoAlt) return;
  app.alt = !app.alt;
  ui.setAltButton(app.alt ? 'toGround' : 'toDrone');
  try {
    await pano.showVariant(app.alt ? view.panoAlt : effectivePano(view));
  } catch (e) {
    ui.showBanner(['Panorama introuvable : ' + view.label]);
    console.error(e);
  }
}

function backToPlan() {
  if (app.screen !== 'pano') return;
  app.screen = 'plan';
  app.viewId = null;
  ui.setScreen('plan');
  markers.setActive(null);
  plan.hideGaze();
  updateTabs();
}

async function onTab(toId) {
  if (toId === app.stateId) return;
  const next = resolveTabSwitch({
    screen: app.screen, viewId: app.viewId,
    fromState: stateById(app.stateId), toState: stateById(toId),
  });
  // capturés avant activateState : la vue/position d'origine servent à
  // recalculer le cap une fois l'état cible actif
  const fromView = currentViews().find(v => v.id === app.viewId);
  const pos = pano.getPosition();
  try {
    const views = await activateState(toId, { withOverlay: !plan.viewData.has(toId) });
    if (next.screen === 'pano') {
      const view = views.find(v => v.id === next.viewId);
      if (view) {
        if (!fromView) return openView(view);
        // conserve le cap monde : psvYaw' = psvYaw + yaw(from) − yaw(to) ;
        // seamless : même cadrage avant/après, l'image tient jusqu'à la permutation
        return openView(view, { yaw: pos.yaw + fromView.yaw - view.yaw, pitch: pos.pitch }, { seamless: true });
      }
    }
    backToPlan();
  } catch (e) {
    ui.setLoading(null);
    ui.showBanner(['Chargement impossible : ' + (e.message || e)]);
    console.error(e);
  }
}

// clic (sans drag) sur la minimap → retour au plan en grand ;
// les pastilles gardent leur propre clic (changement de panorama).
const planWrap = document.getElementById('plan-wrap');
let pressAt = null;
planWrap.addEventListener('pointerdown', e => { pressAt = [e.clientX, e.clientY]; });
planWrap.addEventListener('click', e => {
  if (app.screen !== 'pano' || e.target.closest('.marker')) return;
  if (pressAt && Math.hypot(e.clientX - pressAt[0], e.clientY - pressAt[1]) > 5) return;
  backToPlan();
});

ui.initUI({ states: CONFIG.states, onTab, onBack: backToPlan, onAlt: toggleAlt, onHaie: setHaieState });
try {
  await activateState(app.stateId, { withOverlay: true });
} catch (e) {
  ui.setLoading(null);
  ui.showBanner(['Chargement impossible : ' + (e.message || e)]);
  console.error(e);
}

// préchargement de l'autre état quand la page est au repos
const idle = window.requestIdleCallback ?? (fn => setTimeout(fn, 2500));
idle(() => { for (const s of CONFIG.states) if (s.id !== app.stateId) plan.loadState(s); });

window.__APP = { app, plan, markers, pano };

// ceinture et bretelles : certains WebKit (iPad) tentent quand même une
// sélection au glisser — on la refuse à la source
document.addEventListener('selectstart', e => e.preventDefault());
