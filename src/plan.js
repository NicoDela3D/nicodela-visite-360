import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { matchViews } from './views.js';

export class Plan {
  constructor(container, defaultView = null) {
    this.container = container;
    this.defaultView = defaultView;   // { position:[x,y,z], target:[x,y,z] } optionnel
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14161a);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;

    const sun = new THREE.DirectionalLight(0xfff2dd, 3);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0002;
    // normalBias réglé dynamiquement dans fitLighting (proportionnel au texel)
    this.sun = sun;
    this.scene.add(sun, sun.target, new THREE.HemisphereLight(0xbcc7d6, 0x3a3630, 0.5));

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    // cône de vision 3D : secteur horizontal posé dans la scène à la position
    // de la vue, orienté par le yaw monde du regard (voir setGaze). Il suit la
    // perspective du plan, contrairement à un indicateur 2D plaqué à l'écran.
    const gazeGeo = new THREE.CircleGeometry(10, 24, Math.PI / 2 - Math.PI / 6, Math.PI / 3); // secteur 60° centré sur +Y
    gazeGeo.rotateX(-Math.PI / 2); // à plat : le centre du secteur pointe vers −Z (yaw 0)
    this.gaze = new THREE.Mesh(gazeGeo, new THREE.MeshBasicMaterial({
      color: 0xd8a24a, transparent: true, opacity: 0.45,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    this.gaze.visible = false;
    this.scene.add(this.gaze);

    this.groups = new Map();    // stateId → THREE.Group
    this.viewData = new Map();  // stateId → { views, warnings }
    this.pending = new Map();   // stateId → Promise en cours (dédup des chargements concurrents)
    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.loader.setDRACOLoader(draco);
    this.onTick = null;
    this.framed = false;

    // re-taille à chaque frame de la transition plein écran ↔ minimap :
    // resize() repeint dans la même tâche que setSize, donc le canvas reste
    // net pendant toute l'animation, sans frame vide ni saut de résolution
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      if (this.onTick) this.onTick();
    });
  }

  // charge (une fois) le modèle de haie de l'état et pilote sa visibilité ;
  // rattaché au groupe de l'état, il suit sa visibilité d'onglet
  async setHaie(stateCfg, visible) {
    if (!stateCfg.haie) return;
    if (!this.haieGroups) this.haieGroups = new Map();
    let haie = this.haieGroups.get(stateCfg.id);
    if (!haie) {
      try {
        const gltf = await this.loader.loadAsync(stateCfg.haie.model);
        haie = gltf.scene;
        haie.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      } catch (e) {
        console.warn('modèle de haie indisponible :', e);
        haie = new THREE.Group();
      }
      this.haieGroups.set(stateCfg.id, haie);
      this.groups.get(stateCfg.id)?.add(haie);
    }
    haie.visible = visible;
  }

  // yaw monde : 0 = vers −Z, +π/2 = vers +X (même convention que views.js)
  setGaze([x, y, z], yaw) {
    this.gaze.position.set(x, y, z);
    this.gaze.rotation.y = -yaw;
    this.gaze.visible = true;
  }

  hideGaze() { this.gaze.visible = false; }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // repeint dans la même tâche : setSize vide le buffer, et laisser le
    // navigateur peindre avant le prochain RAF afficherait une frame vide
    this.renderer.render(this.scene, this.camera);
  }

  loadState(stateCfg, onProgress) {
    if (this.viewData.has(stateCfg.id)) return Promise.resolve(this.viewData.get(stateCfg.id));
    // dédup : un préchargement idle et un clic rapide peuvent viser le même
    // état ; on partage littéralement la même promesse (pas de fonction async
    // ici : un wrapper async renverrait un nouvel objet Promise à chaque appel,
    // même en renvoyant this.pending.get(...)) plutôt que de charger le GLB deux fois
    if (this.pending.has(stateCfg.id)) return this.pending.get(stateCfg.id);

    const doLoad = async () => {
      const gltf = await new Promise((resolve, reject) =>
        this.loader.load(stateCfg.model, resolve,
          e => onProgress && e.total && onProgress(e.loaded / e.total), reject));
      const group = gltf.scene;
      group.updateMatrixWorld(true);

      // extrait les nœuds caméra VUE_* (position/quaternion monde), puis les retire
      // nœuds de vue : caméras VUE_* (convention) ou nœuds — même vides —
      // dont le nom est visé par un `node:` de la config
      // même normalisation des espaces que views.js (GLTFLoader → « _ »)
      const canon = s => s.replace(/\s+/g, '_');
      const wanted = new Set(Object.entries(stateCfg.views).map(([id, v]) => canon(v.node ?? id)));
      const nodes = [];
      const holders = new Set();
      const p = new THREE.Vector3(), q = new THREE.Quaternion();
      group.traverse(o => {
        if (o.isMesh) { o.castShadow = o.receiveShadow = true; }
        // cadrage d'ouverture déclaré par un nœud caméra du GLB : on résout
        // position + cible (point visé ramené vers le sol, borné 10-80 m)
        if (this.defaultView?.node && canon(o.name) === canon(this.defaultView.node)) {
          o.getWorldPosition(p);
          o.getWorldQuaternion(q);
          const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
          const t = f.y < -0.05 ? Math.min(80, Math.max(10, (1 - p.y) / f.y)) : 40;
          this.defaultView = { position: p.toArray(), target: p.clone().addScaledVector(f, t).toArray() };
          return;
        }
        if (wanted.has(canon(o.name))) { holders.add(o); return; }
        if (!o.isCamera) return;
        let holder = o;
        while (holder && !holder.name.startsWith('VUE_')) holder = holder.parent;
        if (holder) holders.add(holder);
      });
      for (const h of holders) {
        h.getWorldPosition(p);
        h.getWorldQuaternion(q);
        nodes.push({ name: h.name, position: p.toArray(), quaternion: q.toArray() });
        h.removeFromParent();
      }

      group.visible = false;
      this.scene.add(group);
      this.groups.set(stateCfg.id, group);
      const data = matchViews(nodes, stateCfg);
      this.viewData.set(stateCfg.id, data);
      return data;
    };

    const p = doLoad().finally(() => this.pending.delete(stateCfg.id));
    this.pending.set(stateCfg.id, p);
    return p;
  }

  showState(stateId) {
    for (const [id, g] of this.groups) g.visible = id === stateId;
    this.fitLighting(stateId);
    if (!this.framed) { this.frame(stateId); this.framed = true; }
  }

  // cale le soleil et le frustum de sa shadow map sur l'emprise du modèle :
  // une zone fixe autour de l'origine raterait une scène géoréférencée
  // (coordonnées locales décalées), et les ombres disparaîtraient
  fitLighting(stateId) {
    const g = this.groups.get(stateId);
    if (!g) return;
    const box = new THREE.Box3().setFromObject(g);
    const center = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    this.sun.position.set(center.x + r * 0.6, center.y + r * 1.2, center.z + r * 0.4);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
    const cam = this.sun.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    // plage de profondeur serrée autour de la scène (le soleil est à ~1.4·r
    // du centre) : une plage trop large quantifie la depth map et dessine
    // des anneaux de moiré sur les grandes surfaces planes
    cam.near = r * 0.4;
    cam.far = r * 2.6;
    cam.updateProjectionMatrix();
    // biais proportionnel à la taille du texel d'ombre : un biais fixe
    // redevient trop petit dès que le frustum couvre une grande scène
    // (acné = rayures sur les surfaces rasantes au soleil)
    this.sun.shadow.normalBias = (2 * r / this.sun.shadow.mapSize.x) * 2;
  }

  frame(stateId) {
    // cadrage d'ouverture déclaré en config : prioritaire sur le calcul bbox
    if (this.defaultView?.position) {
      this.camera.position.set(...this.defaultView.position);
      this.controls.target.set(...this.defaultView.target);
      return;
    }
    const g = this.groups.get(stateId);
    if (!g) return;
    const box = new THREE.Box3().setFromObject(g);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    this.controls.target.copy(center);
    this.camera.position.set(center.x + size * 0.4, center.y + size * 0.5, center.z + size * 0.55);
  }

  screenPos([x, y, z]) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const { clientWidth: w, clientHeight: h } = this.container;
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, visible: v.z < 1 };
  }

}
