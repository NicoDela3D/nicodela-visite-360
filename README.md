# Visite 3D — Étude de projet

Page statique de présentation : plan 3D schématique + panoramas 360°,
en deux onglets (Existant / Nouvelle construction). Aucun build.

## Lancer en local

    npm run serve        # http://localhost:5173 (HTTP requis, pas de file://)

## Tests

    npm test             # node --test, logique pure uniquement

## Remplacer les placeholders par la vraie maquette

1. Dans Blender : nommer les caméras `VUE_<ID>` (position + orientation font foi).
1bis. **Caméras à l'horizontale** : pas d'inclinaison haut/bas (rotation X = 90° pile
   dans Blender). Un rendu equirectangulaire fait avec une caméra inclinée donne un
   horizon penché/ondulé ; la page affiche un avertissement console si un pitch > 2°
   est détecté dans le GLB.
2. Exporter un GLB par état (`assets/models/existant.glb`, `projet.glb`),
   avec « Cameras » coché (les caméras Geometry Nodes : appliquer les modificateurs).
   Optimisation web :

       npx @gltf-transform/cli optimize source.glb assets/models/X.glb --compress draco --texture-compress webp --texture-size 2048 --prune false --flatten false --join false --palette false

   (--prune/--flatten/--join false : préserve les nœuds caméras ;
   --palette false : évite les bavures de couleurs entre matériaux unis)
3. Rendre les panoramas depuis les MÊMES caméras (Cycles, panoramique
   equirectangulaire), JPG dans `assets/panos/`, + un aperçu `<nom>-preview.jpg`
   en 512×256. Voir `tools/make_placeholder.py` pour un exemple exécutable.
4. Déclarer les vues dans `src/config.js` (label, pano, `pair` optionnel pour
   les vues homologues entre états).

## Avant publication (GitHub Pages public)

- `node tools/strip_metadata.mjs assets/panos` (retire EXIF/commentaires).
- Vérifier qu'aucun nom, adresse ou chemin identifiant n'apparaît
  (code, config, noms de fichiers, métadonnées).
- `<meta name="robots" content="noindex">` est déjà en place.
- Publier un instantané SANS `docs/` ni `.claude/` (branche orpheline, comme
  le projet frère).
- Vérifier aussi les fichiers suivis du repo (pas seulement les assets) pour
  d'éventuels chemins ou noms identifiants.
