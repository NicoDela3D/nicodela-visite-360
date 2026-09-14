import test from 'node:test';
import assert from 'node:assert/strict';
import { yawFromQuaternion, pitchFromQuaternion, matchViews } from '../src/views.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≉ ${b}`);
const S = Math.SQRT1_2;

test('yaw identité = 0 (regard vers −Z)', () => close(yawFromQuaternion([0, 0, 0, 1]), 0));
test('yaw −90° autour de Y = +π/2 (regard vers +X)', () => close(yawFromQuaternion([0, -S, 0, S]), Math.PI / 2));
test('yaw 180° autour de Y = ±π', () => close(Math.abs(yawFromQuaternion([0, 1, 0, 0])), Math.PI));

const stateCfg = {
  id: 'test',
  views: {
    VUE_A: { label: 'Vue A', pano: 'a.jpg', pair: 'x' },
    VUE_B: { label: 'Vue B', pano: 'b.jpg' },
  },
};
const nodeA = { name: 'VUE_A', position: [1, 2, 3], quaternion: [0, 0, 0, 1] };

test('matchViews associe config et nœuds', () => {
  const { views, warnings } = matchViews([nodeA, { name: 'VUE_B', position: [0, 0, 0], quaternion: [0, -S, 0, S] }], stateCfg);
  assert.equal(views.length, 2);
  assert.deepEqual(warnings, []);
  const a = views.find(v => v.id === 'VUE_A');
  assert.deepEqual(a.position, [1, 2, 3]);
  assert.equal(a.label, 'Vue A');
  assert.equal(a.pano, 'a.jpg');
  assert.equal(a.pair, 'x');
  close(a.yaw, 0);
  const b = views.find(v => v.id === 'VUE_B');
  assert.equal(b.pair, null);
  close(b.yaw, Math.PI / 2);
});
test('vue en config absente du GLB → warning, pas de vue', () => {
  const { views, warnings } = matchViews([nodeA], stateCfg);
  assert.equal(views.length, 1);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('VUE_B'));
});
test('caméra GLB absente de la config → warning, ignorée', () => {
  const extra = { name: 'VUE_C', position: [0, 0, 0], quaternion: [0, 0, 0, 1] };
  const { views, warnings } = matchViews([nodeA, { name: 'VUE_B', position: [0, 0, 0], quaternion: [0, 0, 0, 1] }, extra], stateCfg);
  assert.equal(views.length, 2);
  assert.ok(warnings.some(w => w.includes('VUE_C')));
});
test('les nœuds sans préfixe VUE_ sont ignorés silencieusement', () => {
  const { warnings } = matchViews([nodeA, { name: 'TERRAIN', position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
    { name: 'VUE_B', position: [0, 0, 0], quaternion: [0, 0, 0, 1] }], stateCfg);
  assert.deepEqual(warnings, []);
});

test('pitch identité = 0 (caméra à l’horizontale)', () => close(pitchFromQuaternion([0, 0, 0, 1]), 0));
test('pitch +20° autour de X (regard vers le haut)', () => {
  const a = Math.PI / 9; // 20°
  close(pitchFromQuaternion([Math.sin(a / 2), 0, 0, Math.cos(a / 2)]), a);
});
test('caméra inclinée → warning « non horizontale », vue conservée', () => {
  const a = Math.PI / 9; // 20°
  const tilted = { name: 'VUE_A', position: [0, 0, 0], quaternion: [Math.sin(a / 2), 0, 0, Math.cos(a / 2)] };
  const { views, warnings } = matchViews([tilted, { name: 'VUE_B', position: [0, 0, 0], quaternion: [0, 0, 0, 1] }], stateCfg);
  assert.equal(views.length, 2);
  assert.ok(warnings.some(w => w.includes('horizontale') && w.includes('VUE_A')));
});
test('caméras à l’horizontale → aucun warning de pitch', () => {
  const { warnings } = matchViews([nodeA, { name: 'VUE_B', position: [0, 0, 0], quaternion: [0, -S, 0, S] }], stateCfg);
  assert.deepEqual(warnings, []);
});

test('panoAlt transmis dans la vue', () => {
  const cfg = { id: 't', views: { VUE_A: { label: 'A', pano: 'a.jpg', panoAlt: 'a-drone.jpg' } } };
  const { views } = matchViews([nodeA], cfg);
  assert.equal(views[0].panoAlt, 'a-drone.jpg');
});
test('panoAlt absent → null', () => {
  const { views } = matchViews([nodeA], stateCfg);
  assert.equal(views.find(v => v.id === 'VUE_A').panoAlt, null);
});
test('caméra absente du GLB avec fallback → vue créée sur la position de secours + warning', () => {
  const cfg = { id: 't', views: { VUE_X: { label: 'X', pano: 'x.jpg', fallback: { position: [1, 2, 3], yaw: 0.5 } } } };
  const { views, warnings } = matchViews([], cfg);
  assert.equal(views.length, 1);
  assert.deepEqual(views[0].position, [1, 2, 3]);
  assert.equal(views[0].yaw, 0.5);
  assert.ok(warnings.some(w => w.includes('secours')));
});
test('caméra absente du GLB sans fallback → pas de vue (comportement inchangé)', () => {
  const cfg = { id: 't', views: { VUE_X: { label: 'X', pano: 'x.jpg' } } };
  const { views, warnings } = matchViews([], cfg);
  assert.equal(views.length, 0);
  assert.ok(warnings.some(w => w.includes('absente du GLB')));
});

test('config `node` : correspondance par nom de nœud exact (sans préfixe VUE_)', () => {
  const cfg = { id: 't', views: { VUE_A: { label: 'A', pano: 'a.jpg', node: 'Camera Salon 01' } } };
  const { views, warnings } = matchViews(
    [{ name: 'Camera Salon 01', position: [7, 8, 9], quaternion: [0, 0, 0, 1] }], cfg);
  assert.equal(views.length, 1);
  assert.deepEqual(views[0].position, [7, 8, 9]);
  assert.equal(views[0].id, 'VUE_A');
  assert.deepEqual(warnings, []);
});
test('config `node` introuvable → warning avec le nom du nœud', () => {
  const cfg = { id: 't', views: { VUE_A: { label: 'A', pano: 'a.jpg', node: 'Camera Salon 01' } } };
  const { views, warnings } = matchViews([], cfg);
  assert.equal(views.length, 0);
  assert.ok(warnings.some(w => w.includes('Camera Salon 01')));
});

test('les espaces des noms de nœuds sont normalisés (GLTFLoader les remplace par _)', () => {
  const cfg = { id: 't', views: { VUE_A: { label: 'A', pano: 'a.jpg', node: 'Camera Salon 01' } } };
  const { views, warnings } = matchViews(
    [{ name: 'Camera_Salon_01', position: [1, 1, 1], quaternion: [0, 0, 0, 1] }], cfg);
  assert.equal(views.length, 1);
  assert.deepEqual(warnings, []);
});

test('panoHaie transmis dans la vue (et null par défaut)', () => {
  const cfg = { id: 't', views: { VUE_A: { label: 'A', pano: 'a.jpg', panoHaie: 'a-haie.jpg' } } };
  const { views } = matchViews([nodeA], cfg);
  assert.equal(views[0].panoHaie, 'a-haie.jpg');
  const { views: v2 } = matchViews([nodeA], stateCfg);
  assert.equal(v2.find(v => v.id === 'VUE_A').panoHaie, null);
});
