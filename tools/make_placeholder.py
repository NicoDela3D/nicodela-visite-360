"""Génère les GLB placeholders et les panoramas 360 de test.

Usage (PowerShell) :
  & "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P tools/make_placeholder.py

Ce script documente les conventions de la vraie maquette :
- caméras nommées VUE_<ID>, exportées dans le GLB (export_cameras=True) ;
- un GLB par état : existant.glb / projet.glb ;
- panoramas equirectangulaires rendus depuis les MÊMES caméras (le centre de
  l'image correspond donc à la direction de visée de la caméra) ;
- l'export GLB se fait AVANT de passer les caméras en PANO (l'exporteur glTF
  ne connaît que les caméras perspective).
Aucun réglage n'est écrit dans les préférences utilisateur.
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, "assets", "models")
PANOS = os.path.join(ROOT, "assets", "panos")
os.makedirs(MODELS, exist_ok=True)
os.makedirs(PANOS, exist_ok=True)

RES = (2048, 1024)      # placeholders : suffisant à l'écran, rendu rapide
PREVIEW = (512, 256)
SAMPLES = 32


def material(name, rgba, rough=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    return m


def box(name, dims, loc, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = dims
    o.data.materials.append(mat)
    return o


def camera(name, loc, target):
    bpy.ops.object.camera_add(location=loc)
    c = bpy.context.object
    c.name = name
    d = Vector(target) - Vector(loc)
    d.z = 0  # camera a l'horizontale (pitch/roll = 0) : indispensable pour l'equirectangulaire
    c.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return c


# ---- scène vide ----
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

m_grass = material("herbe", (0.30, 0.42, 0.22, 1))
m_water = material("eau", (0.05, 0.35, 0.55, 1), rough=0.1)
m_neighbor = material("voisin", (0.75, 0.72, 0.66, 1))
m_house = material("maison", (0.92, 0.90, 0.86, 1))
m_hedge = material("haie", (0.15, 0.30, 0.12, 1))
m_deck = material("terrasse", (0.55, 0.42, 0.30, 1))

# ---- base commune aux deux états (mètres, Z-up Blender) ----
base = [
    box("TERRAIN", (46, 34, 0.2), (0, 0, -0.1), m_grass),
    box("PISCINE_CLIENT", (8, 4, 0.4), (5, 2, -0.15), m_water),
    box("MAISON_VOISIN_SUD", (10, 7, 5), (-14, -10, 2.5), m_neighbor),
    box("MAISON_VOISIN_EST", (9, 8, 6), (16, -6, 3), m_neighbor),
    box("PISCINE_VOISIN", (6, 3, 0.4), (-11, -6, -0.15), m_water),
    box("HAIE_NORD", (40, 1, 2), (0, 15, 1), m_hedge),
    box("HAIE_OUEST", (1, 30, 2), (-20, 0, 1), m_hedge),
]

# ---- nouvelle construction : maison sur pilotis au-dessus de la piscine ----
# tout objet PROJET_* est masqué dans les rendus de l'état existant
projet = [
    box("PROJET_PILIER_SO", (0.4, 0.4, 3), (0.7, -1.3, 1.5), m_house),
    box("PROJET_PILIER_SE", (0.4, 0.4, 3), (9.3, -1.3, 1.5), m_house),
    box("PROJET_PILIER_NO", (0.4, 0.4, 3), (0.7, 5.3, 1.5), m_house),
    box("PROJET_PILIER_NE", (0.4, 0.4, 3), (9.3, 5.3, 1.5), m_house),
    box("PROJET_DALLE", (11, 9, 0.4), (5, 2, 3.2), m_deck),
    box("PROJET_MAISON", (10, 6, 3.4), (5, 3, 5.1), m_house),  # bande sud = terrasse
]

# ---- caméras : la position/orientation fait foi pour la page web ----
cam_piscine = camera("VUE_PISCINE", (-11, -4, 1.6), (5, 2, 2.5))     # commune (pair)
cam_jardin = camera("VUE_JARDIN", (-2, 9, 1.6), (6, 0, 0.5))
cam_terrasse = camera("VUE_TERRASSE", (5, -0.8, 5.0), (-11, -6, 1))
cam_fenetre = camera("VUE_FENETRE", (5, 0.3, 6.6), (-11, -5, 0.5))

# ---- éclairage / ciel (pour les rendus ; non exporté dans les GLB) ----
bpy.ops.object.light_add(type="SUN", location=(0, 0, 20))
sun = bpy.context.object
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
world = bpy.data.worlds.new("Ciel")
world.use_nodes = True
scene.world = world
sky = world.node_tree.nodes.new("ShaderNodeTexSky")
bg = world.node_tree.nodes["Background"]
world.node_tree.links.new(sky.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.6


def export_glb(path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB",
        use_selection=True, export_cameras=True, export_apply=True,
    )


# export AVANT de basculer les caméras en PANO
export_glb(os.path.join(MODELS, "existant.glb"), base + [cam_piscine, cam_jardin])
export_glb(os.path.join(MODELS, "projet.glb"),
           base + projet + [cam_piscine, cam_terrasse, cam_fenetre])

# ---- rendus panoramiques (Cycles CPU, denoise) ----
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = RES
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 88


def render_pano(cam, name, hidden=()):
    for o in hidden:
        o.hide_render = True
    cam.data.type = "PANO"
    cam.data.panorama_type = "EQUIRECTANGULAR"
    scene.camera = cam
    out = os.path.join(PANOS, name + ".jpg")
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    for o in hidden:
        o.hide_render = False
    img = bpy.data.images.load(out)
    img.scale(*PREVIEW)
    img.save_render(os.path.join(PANOS, name + "-preview.jpg"))
    bpy.data.images.remove(img)
    print("pano :", name)


render_pano(cam_piscine, "ex-piscine", hidden=projet)
render_pano(cam_jardin, "ex-jardin", hidden=projet)
render_pano(cam_terrasse, "pr-terrasse")
render_pano(cam_fenetre, "pr-fenetre")
render_pano(cam_piscine, "pr-piscine")
print("Placeholders OK")
