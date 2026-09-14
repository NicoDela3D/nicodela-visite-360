import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTabSwitch } from '../src/pairing.js';

const existant = { id: 'existant', views: {
  VUE_PISCINE: { label: 'P', pano: 'ex-p.jpg', pair: 'piscine' },
  VUE_JARDIN:  { label: 'J', pano: 'ex-j.jpg' },
} };
const projet = { id: 'projet', views: {
  VUE_TERRASSE: { label: 'T', pano: 'pr-t.jpg' },
  VUE_BASSIN:   { label: 'B', pano: 'pr-b.jpg', pair: 'piscine' },
} };

test('depuis le plan → plan', () => {
  assert.deepEqual(
    resolveTabSwitch({ screen: 'plan', viewId: null, fromState: existant, toState: projet }),
    { screen: 'plan' });
});
test('depuis un pano sans pair → plan', () => {
  assert.deepEqual(
    resolveTabSwitch({ screen: 'pano', viewId: 'VUE_JARDIN', fromState: existant, toState: projet }),
    { screen: 'plan' });
});
test('depuis un pano avec pair correspondant → pano homologue (clé différente acceptée)', () => {
  assert.deepEqual(
    resolveTabSwitch({ screen: 'pano', viewId: 'VUE_PISCINE', fromState: existant, toState: projet }),
    { screen: 'pano', viewId: 'VUE_BASSIN' });
});
test('depuis un pano avec pair sans correspondance en face → plan', () => {
  const sansPair = { id: 'autre', views: { VUE_X: { label: 'X', pano: 'x.jpg' } } };
  assert.deepEqual(
    resolveTabSwitch({ screen: 'pano', viewId: 'VUE_PISCINE', fromState: existant, toState: sansPair }),
    { screen: 'plan' });
});
test('viewId inconnu → plan (robustesse)', () => {
  assert.deepEqual(
    resolveTabSwitch({ screen: 'pano', viewId: 'VUE_ABSENTE', fromState: existant, toState: projet }),
    { screen: 'plan' });
});
