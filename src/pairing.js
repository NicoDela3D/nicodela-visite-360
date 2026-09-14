// Règle de bascule d'onglet (spec §Onglets et appariement) :
// en panorama, si la vue courante a un `pair` et qu'une vue de l'état cible
// porte le même `pair`, on reste immergé ; sinon retour au plan.
export function resolveTabSwitch({ screen, viewId, fromState, toState }) {
  if (screen !== 'pano') return { screen: 'plan' };
  // pair doit être une chaîne non vide ; l'unicité par état est imposée par validate.js
  const current = fromState.views[viewId];
  if (!current || current.pair == null) return { screen: 'plan' };
  const match = Object.entries(toState.views).find(([, v]) => v.pair === current.pair);
  return match ? { screen: 'pano', viewId: match[0] } : { screen: 'plan' };
}
