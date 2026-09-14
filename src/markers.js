// Pastilles caméra HTML projetées sur le canvas du plan.
// Le cône de regard est un objet 3D de la scène (voir Plan.setGaze), pas un
// élément 2D : il suit la perspective du plan.
export class Markers {
  constructor(overlay, plan) {
    this.overlay = overlay;
    this.plan = plan;
    this.items = new Map(); // viewId → { el, view }
    plan.onTick = () => this.update();
  }

  setViews(views, { onSelect }) {
    this.overlay.innerHTML = '';
    this.items.clear();
    for (const view of views) {
      const el = document.createElement('div');
      el.className = 'marker';
      el.innerHTML = '<div class="dot">📷</div><span class="label"></span>';
      el.querySelector('.label').textContent = view.label;
      el.addEventListener('click', () => onSelect(view));
      this.overlay.appendChild(el);
      this.items.set(view.id, { el, view });
    }
  }

  setActive(viewId) {
    for (const [id, it] of this.items) {
      it.el.classList.toggle('active', id === viewId);
    }
  }

  update() {
    for (const it of this.items.values()) {
      const pos = this.plan.screenPos(it.view.position);
      it.el.style.left = pos.x + 'px';
      it.el.style.top = pos.y + 'px';
      it.el.style.display = pos.visible ? '' : 'none';
    }
  }
}
