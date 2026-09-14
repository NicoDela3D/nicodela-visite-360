import { Viewer } from '@photo-sphere-viewer/core';

const previewOf = url => url.replace(/\.jpg$/i, '-preview.jpg');

export class Pano {
  constructor(container) {
    this.container = container;
    this.viewer = null;
    this.yawCb = null;
    this.openId = 0;
  }

  async open(view, position = { yaw: 0, pitch: 0 }, { seamless = false } = {}) {
    const id = ++this.openId;
    if (!this.viewer) {
      this.viewer = new Viewer({
        container: this.container,
        panorama: previewOf(view.pano),
        caption: view.label,
        navbar: ['zoom', 'caption', 'fullscreen'],
        defaultYaw: position.yaw,
        mousewheel: true,
        touchmoveTwoFingers: false,
      });
      this.viewer.addEventListener('position-updated', e => {
        if (this.yawCb) this.yawCb(e.position.yaw);
      });
      // open() ne rend la main qu'une fois l'aperçu affiché : la transition
      // d'écran démarre sur un panorama déjà visible, sans flash noir
      await Promise.race([
        new Promise(resolve => this.viewer.addEventListener('ready', resolve, { once: true })),
        new Promise((_, reject) => setTimeout(() => reject(new Error('délai de chargement dépassé')), 15000)),
      ]);
    } else {
      // lecteur déjà ouvert : PAS d'aperçu basse résolution — l'image en
      // place reste affichée jusqu'à ce que la pleine résolution soit prête,
      // puis permutation d'un coup. `seamless` (bascule appariée : même
      // cadrage) masque aussi le spinner ; sinon il signale le chargement.
      this.viewer.setOption('caption', view.label);
      await this.viewer.setPanorama(view.pano,
        { transition: false, showLoader: !seamless, position });
      return;
    }
    if (id !== this.openId) return;   // ne lance la pleine résolution que si cet open est toujours le dernier
    // pleine résolution par-dessus l'aperçu (affichage progressif), sans
    // bloquer la transition d'écran ; deux setPanorama déjà en vol :
    // l'arbitrage revient à PSV (annule/remplace)
    this.viewer.setPanorama(view.pano, { transition: false, showLoader: false })
      .catch(e => console.warn('pleine résolution indisponible :', e));
  }

  // bascule de variante (haie, drone) du même point de vue : le regard est
  // conservé et l'image actuelle reste affichée jusqu'à la permutation —
  // pas d'aperçu basse résolution, pas de spinner
  async showVariant(url) {
    if (!this.viewer) return;
    this.openId++;
    const pos = this.viewer.getPosition();
    await this.viewer.setPanorama(url,
      { transition: false, showLoader: false, position: pos });
  }

  getPosition() {
    return this.viewer ? this.viewer.getPosition() : { yaw: 0, pitch: 0 };
  }

  onYaw(cb) { this.yawCb = cb; }
}
