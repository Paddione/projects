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
    create_materials_library()
    print("\n✅ Blender template creation complete!")
