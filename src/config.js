// Le seul fichier à éditer quand la maquette évolue.
// Les positions/orientations des vues viennent du GLB : par défaut le nœud
// porte l'id de la vue (convention VUE_*) ; `node` permet de viser un nom de
// caméra Blender arbitraire. `fallback` sert de position de secours quand le
// nœud n'existe pas dans le GLB de cet état.
//
// Panoramas : photos drone = état existant ; rendus 3D = nouvelle construction.
export const CONFIG = {
  // cadrage d'ouverture du plan 3D : nœud caméra du GLB du premier état
  // (position + direction de visée ; le FOV du plan reste inchangé).
  // Alternative : { position: [x,y,z], target: [x,y,z] } en coordonnées monde.
  planCamera: { node: 'Angle de depart' },
  states: [
    {
      id: 'existant',
      label: 'Existant',
      model: 'assets/models/existant.glb',
      views: {
        VUE_TERRASSE: {
          label: 'Depuis la terrasse',
          node: 'Seance Voisin Vue terrasse Existant',
          pano: 'assets/panos/terrasse-ex.jpg',
          pair: 'terrasse',
        },
        VUE_PARCELLE: {
          label: 'Depuis la parcelle voisine',
          node: 'Seance Voisin Vue Depuis parcelle voisine',
          pano: 'assets/panos/parcelle-ex.jpg',
          pair: 'parcelle',
        },
      },
    },
    {
      id: 'projet',
      label: 'Nouvelle construction',
      model: 'assets/models/projet.glb',
      // haie proposée : modèle 3D ajouté au plan quand « Avec haie » est actif
      // (les vues avec panoHaie basculent aussi de panorama)
      haie: { model: 'assets/models/Haie.glb' },
      views: {
        VUE_TERRASSE: {
          label: 'Depuis la terrasse',
          node: 'Seance Voisin Vue terrasse projet',
          pano: 'assets/panos/terrasse-pr.jpg',
          panoHaie: 'assets/panos/terrasse-pr-haie.jpg',
          pair: 'terrasse',
        },
        VUE_ETAGE: {
          label: "Depuis l'étage",
          node: 'Seance Voisin Vue Etage projet',
          pano: 'assets/panos/etage-pr.jpg',
          panoHaie: 'assets/panos/etage-pr-haie.jpg',
        },
        VUE_PARCELLE: {
          label: 'Depuis la parcelle voisine',
          pano: 'assets/panos/parcelle-pr.jpg',
          panoHaie: 'assets/panos/parcelle-pr-haie.jpg',
          pair: 'parcelle',
          // pas de nœud caméra dans ce GLB : on reprend la position/orientation
          // de la caméra homonyme de l'état existant
          fallback: { position: [81.26, -1.78, -4.74], yaw: -0.891 },
        },
      },
    },
  ],
};
