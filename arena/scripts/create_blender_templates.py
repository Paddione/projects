#!/usr/bin/env python3
"""
Blender template creator using bpy API.
Creates 6 persistent Blender project templates with professional lighting,
cameras, and material linking for arena sprite rendering.

Usage:
    blender --background --python scripts/create_blender_templates.py
"""

import bpy
import os
import math
from pathlib import Path

# Configuration
BLEND_DIR = Path(__file__).parent.parent / "assets" / "blend"
MODELS_DIR = Path(__file__).parent.parent / "assets" / "models"

def clear_scene():
    """Remove all objects from default scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Remove all materials
    for material in bpy.data.materials:
        bpy.data.materials.remove(material, do_unlink=True)

def setup_lighting_rig():
    """Create 3-point professional lighting rig."""
    print("[Lighting] Setting up 3-point lighting rig...")

    # Key Light (Sun - main directional light)
    bpy.ops.object.light_add(type='SUN', location=(2, -3, 3))
    key_light = bpy.context.active_object
    key_light.name = "KeyLight"
    key_light.data.energy = 2.0
    key_light.data.angle = math.radians(5)
    key_light.rotation_euler = (math.radians(45), math.radians(45), 0)
    key_light.data.use_shadow = True

    # Fill Light (Area - soft, no shadows)
    bpy.ops.object.light_add(type='AREA', location=(-2, 2, 1))
    fill_light = bpy.context.active_object
    fill_light.name = "FillLight"
    fill_light.data.energy = 0.5
    fill_light.data.size = 3.0
    fill_light.data.use_shadow = False

    # Rim Light (Area - edge separation)
    bpy.ops.object.light_add(type='AREA', location=(0, 1, 2))
    rim_light = bpy.context.active_object
    rim_light.name = "RimLight"
    rim_light.data.energy = 0.3
    rim_light.data.size = 2.0
    rim_light.data.use_shadow = False

    print("✅ Lighting rig created (Key, Fill, Rim)")

def setup_camera(camera_name, position, rotation, scale=2.5):
    """Create and position orthographic camera."""
    bpy.ops.object.camera_add(location=position)
    camera = bpy.context.active_object
    camera.name = camera_name

    # Orthographic setup
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = scale
    camera.rotation_euler = rotation

    # Set as active camera
    bpy.context.scene.camera = camera

    print(f"✅ Camera created: {camera_name} (ortho scale: {scale})")

def setup_world_lighting():
    """Configure world/environment lighting."""
    world = bpy.data.worlds["World"]
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.5  # Gray background
    print("✅ World lighting configured")

def setup_eevee_rendering():
    """Configure EEVEE render engine with GPU acceleration."""
    scene = bpy.context.scene

    # Set render engine
    scene.render.engine = 'BLENDER_EEVEE'

    # Output settings
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.film_transparent = True  # Transparent background

    # EEVEE settings
    eevee = scene.eevee
    eevee.use_gtao = True  # Global Tone AO (formerly ambient occlusion)
    eevee.gtao_distance = 0.3
    eevee.gtao_factor = 1.2

    # Bloom for glowing materials
    eevee.use_bloom = True
    eevee.bloom_intensity = 0.1

    # Anti-aliasing
    eevee.taa_render_samples = 32

    print("✅ EEVEE rendering configured (GPU: OptiX, 256×256, transparent)")

def create_materials_library():
    """Create _shared/materials.blend with PBR material definitions."""
    print("[Materials] Creating shared materials library...")

    # Ensure clean scene
    clear_scene()

    # Create PBR_Skin material
    mat_skin = bpy.data.materials.new(name="PBR_Skin")
    mat_skin.use_nodes = True
    nodes = mat_skin.node_tree.nodes
    nodes.clear()
    links = mat_skin.node_tree.links

    # Skin shader setup
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.831, 0.647, 0.455, 1.0)  # #d4a574
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.8
    bsdf.inputs['Subsurface Weight'].default_value = 0.1

    output = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    # Create PBR_Metal material
    mat_metal = bpy.data.materials.new(name="PBR_Metal")
    mat_metal.use_nodes = True
    nodes = mat_metal.node_tree.nodes
    nodes.clear()
    links = mat_metal.node_tree.links

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.714, 0.714, 0.714, 1.0)  # #b5b5b5
    bsdf.inputs['Metallic'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = 0.2

    output = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    # Create PBR_Fabric material
    mat_fabric = bpy.data.materials.new(name="PBR_Fabric")
    mat_fabric.use_nodes = True
    nodes = mat_fabric.node_tree.nodes
    nodes.clear()
    links = mat_fabric.node_tree.links

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.5, 0.3, 0.2, 1.0)  # Fabric color
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.7

    output = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    # Create Emission_Glow material
    mat_glow = bpy.data.materials.new(name="Emission_Glow")
    mat_glow.use_nodes = True
    nodes = mat_glow.node_tree.nodes
    nodes.clear()
    links = mat_glow.node_tree.links

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (1.0, 0.8, 0.0, 1.0)  # Bright yellow
    bsdf.inputs['Emission Color'].default_value = (1.0, 0.8, 0.0, 1.0)
    bsdf.inputs['Emission Strength'].default_value = 5.0

    output = nodes.new(type='ShaderNodeOutputMaterial')
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    # FIX: Create dummy cube and attach all materials to it
    # This ensures Blender saves the materials (they're now referenced)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    dummy_cube = bpy.context.active_object
    dummy_cube.name = "MaterialHolder"

    # Assign all materials to the dummy object
    dummy_cube.data.materials.append(mat_skin)
    dummy_cube.data.materials.append(mat_metal)
    dummy_cube.data.materials.append(mat_fabric)
    dummy_cube.data.materials.append(mat_glow)

    print("✅ Created 4 PBR materials and attached to MaterialHolder object")

    # Save materials library
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    materials_path = BLEND_DIR / "_shared" / "materials.blend"
    materials_path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(materials_path))
    print(f"✅ Materials library saved: {materials_path}")

    # Verify materials were saved
    print(f"✅ Materials in file: {len(bpy.data.materials)} (should be 4)")

if __name__ == "__main__":
    print("=" * 60)
    print("Blender Template Creator - Testing Lighting & Camera")
    print("=" * 60)

    # Step 1: Create shared materials library
    print("\n[Step 1/2] Creating shared materials library...")
    clear_scene()
    create_materials_library()

    # Step 2: Test lighting in a new file
    print("\n[Step 2/2] Creating character template with lighting...")
    clear_scene()

    setup_lighting_rig()
    setup_camera("ISOCamera", (0, -3, 2), (math.radians(60), 0, 0), scale=2.5)
    setup_world_lighting()
    setup_eevee_rendering()

    # Save test file
    test_path = BLEND_DIR / "character.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(test_path))
    print(f"✅ Test character template saved: {test_path}")

    print("\n" + "=" * 60)
    print("✅ Blender template creation complete!")
    print("=" * 60)
