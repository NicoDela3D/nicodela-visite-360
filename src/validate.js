// Validation de CONFIG. Pur : aucune dépendance, testable sous node.
export function validateConfig(config) {
  const errors = [];
  if (!config || !Array.isArray(config.states) || config.states.length === 0) {
    errors.push('states doit être un tableau non vide');
    return errors;
  }
  const ids = new Set();
  for (const state of config.states) {
    const where = `état « ${state?.id ?? '?'} »`;
    if (!state.id) errors.push(`${where} : id manquant`);
    else if (ids.has(state.id)) errors.push(`${where} : id en double`);
    else ids.add(state.id);
    if (!state.label) errors.push(`${where} : label manquant`);
    if (!state.model) errors.push(`${where} : model manquant`);
    const views = state.views ?? {};
    if (Object.keys(views).length === 0) errors.push(`${where} : aucune vue`);
    const pairs = new Set();
    for (const [key, view] of Object.entries(views)) {
      const vwhere = `${where}, vue « ${key} »`;
      if (!key.startsWith('VUE_')) errors.push(`${vwhere} : la clé doit commencer par VUE_`);
      if (!view.label) errors.push(`${vwhere} : label manquant`);
      if (!view.pano) errors.push(`${vwhere} : pano manquant`);
      if (view.pair != null) {
        if (pairs.has(view.pair)) errors.push(`${vwhere} : pair « ${view.pair} » en double dans cet état`);
        pairs.add(view.pair);
      }
    }
  }
  return errors;
}
