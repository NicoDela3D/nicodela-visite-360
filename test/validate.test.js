import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/validate.js';
import { CONFIG } from '../src/config.js';

const good = () => ({
  states: [{ id: 'a', label: 'A', model: 'm.glb', views: { VUE_X: { label: 'X', pano: 'x.jpg' } } }],
});

test('la CONFIG du projet est valide', () => assert.deepEqual(validateConfig(CONFIG), []));
test('config minimale valide → aucune erreur', () => assert.deepEqual(validateConfig(good()), []));
test('states vide → erreur', () => assert.ok(validateConfig({ states: [] }).length > 0));
test("id d'état en double → erreur", () => {
  const c = good();
  c.states.push(structuredClone(c.states[0]));
  assert.ok(validateConfig(c).some(e => e.includes('double')));
});
test('état sans model → erreur', () => {
  const c = good();
  delete c.states[0].model;
  assert.ok(validateConfig(c).some(e => e.includes('model')));
});
test('état sans vue → erreur', () => {
  const c = good();
  c.states[0].views = {};
  assert.ok(validateConfig(c).some(e => e.includes('vue')));
});
test('clé de vue sans préfixe VUE_ → erreur', () => {
  const c = good();
  c.states[0].views.CAM_Y = { label: 'Y', pano: 'y.jpg' };
  assert.ok(validateConfig(c).some(e => e.includes('VUE_')));
});
test('vue sans pano → erreur', () => {
  const c = good();
  c.states[0].views.VUE_X = { label: 'X' };
  assert.ok(validateConfig(c).some(e => e.includes('pano')));
});
test('pair en double dans un même état → erreur', () => {
  const c = good();
  c.states[0].views.VUE_Y = { label: 'Y', pano: 'y.jpg', pair: 'p' };
  c.states[0].views.VUE_Z = { label: 'Z', pano: 'z.jpg', pair: 'p' };
  assert.ok(validateConfig(c).some(e => e.includes('pair')));
});
