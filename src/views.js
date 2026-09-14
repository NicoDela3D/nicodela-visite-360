// Extraction des points de vue à partir des nœuds caméra du GLB.
// Pur : aucune dépendance à three, testable sous node.

// Direction de visée d'une caméra glTF : le quaternion appliqué à (0,0,−1).
// yaw : angle autour de +Y, 0 = vers −Z, +π/2 = vers +X (sens horaire vu de dessus).
export function yawFromQuaternion([x, y, z, w]) {
  const fx = -2 * (x * z + w * y);          // composante X du regard
  const fz = -(1 - 2 * (x * x + y * y));    // composante Z du regard
  return Math.atan2(fx, -fz);
}

// pitch : angle du regard au-dessus de l'horizon (radians). Un rendu
// equirectangulaire exige une caméra à l'horizontale (pitch ≈ 0), sinon
// l'horizon du panorama paraît penché/ondulé dans le lecteur.
export function pitchFromQuaternion([x, y, z, w]) {
  const fy = 2 * (w * x - y * z);           // composante verticale du regard
  return Math.asin(Math.max(-1, Math.min(1, fy)));
}

const PITCH_MAX = 0.035; // ~2° de tolérance

// nodes : [{ name, position:[x,y,z], quaternion:[x,y,z,w] }] extraits du GLB.
// stateConfig : un élément de CONFIG.states.
export function matchViews(nodes, stateConfig) {
  const views = [];
  const warnings = [];
  // GLTFLoader (three) remplace les espaces des noms de nœuds par des « _ » :
  // on normalise des deux côtés pour que la config puisse citer le nom Blender
  const canon = s => s.replace(/\s+/g, '_');
  const byName = new Map(nodes.map(n => [canon(n.name), n]));
  const used = new Set();
  for (const [id, cfg] of Object.entries(stateConfig.views)) {
    // par défaut le nœud porte l'id de la vue (convention VUE_*) ;
    // `node` en config permet de viser un nom de caméra Blender arbitraire
    const nodeName = cfg.node ?? id;
    const node = byName.get(canon(nodeName));
    used.add(canon(nodeName));
    if (!node) {
      // position de secours déclarée en config : la vue existe quand même,
      // en attendant un export GLB contenant ce nœud caméra
      if (cfg.fallback) {
        warnings.push(`vue « ${id} » sans caméra dans le GLB — position de secours de config.js utilisée`);
        views.push({
          id, label: cfg.label, pano: cfg.pano, panoAlt: cfg.panoAlt ?? null,
          panoHaie: cfg.panoHaie ?? null,
          pair: cfg.pair ?? null,
          position: cfg.fallback.position, yaw: cfg.fallback.yaw ?? 0,
        });
      } else {
        warnings.push(`vue « ${id} » (nœud « ${nodeName} ») absente du GLB`);
      }
      continue;
    }
    const pitch = pitchFromQuaternion(node.quaternion);
    if (Math.abs(pitch) > PITCH_MAX) {
      warnings.push(`caméra « ${id} » non horizontale (pitch ${(pitch * 180 / Math.PI).toFixed(1)}°) — le panorama equirectangulaire paraîtra penché`);
    }
    views.push({
      id,
      label: cfg.label,
      pano: cfg.pano,
      panoAlt: cfg.panoAlt ?? null,
      panoHaie: cfg.panoHaie ?? null,
      pair: cfg.pair ?? null,
      position: node.position,
      yaw: yawFromQuaternion(node.quaternion),
    });
  }
  for (const name of byName.keys()) {
    if (name.startsWith('VUE_') && !used.has(name)) {
      warnings.push(`caméra « ${name} » présente dans le GLB mais absente de config.js`);
    }
  }
  return { views, warnings };
}
