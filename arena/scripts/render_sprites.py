#!/usr/bin/env python3
"""
Phase 3: Blender Sprite Rendering
Imports 3D models (.glb) and renders them as 2D sprite frames from an orthographic
top-down camera at 60° angle, producing individual PNGs for sprite sheet packing.

Usage:
    blender --background --python render_sprites.py -- [--category CATEGORY] [--id ASSET_ID]

Note: Must be run via Blender's Python interpreter. The script uses Blender's bpy module.
"""

import json
import math
import os
import sys
from pathlib import Path

# When run from Blender, bpy is available
try:
    import bpy
    import mathutils
    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False

MANIFEST_PATH = Path(__file__).parent.parent / "assets" / "manifest.json"
MODELS_DIR = Path(__file__).parent.parent / "assets" / "models"
OUTPUT_BASE = Path(__file__).parent.parent / "assets" / "renders"

# Render settings
CAMERA_ANGLE_DEG = 60  # Top-down angle (90 = pure top-down, 0 = side view)
CAMERA_DISTANCE = 3.0
RENDER_RESOLUTION = 128  # Render at 2x, then downscale to 64px for characters
BG_TRANSPARENT = True

# Direction angles (8 directions, clockwise from North)
DIRECTIONS = {
    "N":  0,
    "NE": 45,
    "E":  90,
    "SE": 135,
    "S":  180,
    "SW": 225,
    "W":  270,
    "NW": 315,
}


def load_manifest() -> dict:
    with open(MANIFEST_PATH) as f:
        return json.load(f)


def ensure_output_dir(*parts: str) -> Path:
    out = OUTPUT_BASE
    for p in parts:
        out = out / p
    out.mkdir(parents=True, exist_ok=True)
    return out


def setup_scene():
    """Configure Blender scene for isometric sprite rendering."""
    # Clear existing objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    scene = bpy.context.scene

    # Render settings
    scene.render.resolution_x = RENDER_RESOLUTION
    scene.render.resolution_y = RENDER_RESOLUTION
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = BG_TRANSPARENT
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    # Use Cycles for better quality, or EEVEE for speed
    scene.render.engine = 'BLENDER_EEVEE'
    if hasattr(scene.eevee, 'taa_render_samples'):
        scene.eevee.taa_render_samples = 4  # 4 is plenty for 128px game sprites

    # Add orthographic camera
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "SpriteCamera"
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.0  # Adjust to fit models
    scene.camera = camera

    # Position camera at angle
    angle_rad = math.radians(CAMERA_ANGLE_DEG)
    camera.location = (0, -CAMERA_DISTANCE * math.cos(angle_rad), CAMERA_DISTANCE * math.sin(angle_rad))
    camera.rotation_euler = (angle_rad, 0, 0)

    # Add 3-point lighting
    # Key light (warm, strong)
    bpy.ops.object.light_add(type='SUN', location=(2, -2, 4))
    key = bpy.context.object
    key.name = "KeyLight"
    key.data.energy = 3.0
    key.data.color = (1.0, 0.95, 0.9)
    key.rotation_euler = (math.radians(45), math.radians(15), math.radians(-30))

    # Fill light (cool, soft)
    bpy.ops.object.light_add(type='SUN', location=(-2, -1, 3))
    fill = bpy.context.object
    fill.name = "FillLight"
    fill.data.energy = 1.5
    fill.data.color = (0.85, 0.9, 1.0)
    fill.rotation_euler = (math.radians(50), math.radians(-20), math.radians(30))

    # Rim light (accent)
    bpy.ops.object.light_add(type='SUN', location=(0, 2, 2))
    rim = bpy.context.object
    rim.name = "RimLight"
    rim.data.energy = 2.0
    rim.data.color = (0.8, 0.85, 1.0)
    rim.rotation_euler = (math.radians(120), 0, math.radians(180))

    return camera


def import_model(model_path: Path) -> object:
    """Import a GLB model and center it at origin."""
    bpy.ops.import_scene.gltf(filepath=str(model_path))

    # Get imported objects
    imported = [obj for obj in bpy.context.selected_objects]
    if not imported:
        print(f"  [ERROR] No objects imported from {model_path}")
        return None

    # Find mesh objects
    meshes = [obj for obj in imported if obj.type == 'MESH']
    if not meshes:
        print(f"  [WARN] No mesh objects in {model_path}")
        return imported[0] if imported else None

    # Parent all meshes to an empty for rotation
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    pivot = bpy.context.object
    pivot.name = "ModelPivot"

    for obj in imported:
        obj.parent = pivot

    # Center model
    bpy.ops.object.select_all(action='DESELECT')
    for mesh in meshes:
        mesh.select_set(True)
    bpy.ops.object.origin_set(type='ORIGIN_CENTER_OF_MASS')

    # Normalize scale to fit in frame
    max_dim = max(max(obj.dimensions) for obj in meshes)
    if max_dim > 0:
        scale_factor = 1.5 / max_dim
        pivot.scale = (scale_factor, scale_factor, scale_factor)

    return pivot


def clear_model():
    """Remove all mesh objects and empties (keep camera + lights)."""
    keep_types = {'CAMERA', 'LIGHT'}
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.objects:
        if obj.type not in keep_types:
            obj.select_set(True)
    bpy.ops.object.delete()


def render_frame(output_path: Path):
    """Render a single frame to the given path."""
    bpy.context.scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)


def render_character(char: dict, model_path: Path):
    """Render all animation frames for a character across all directions."""
    char_id = char["id"]
    directions = char.get("directions", list(DIRECTIONS.keys()))
    animations = char.get("animations", {})

    print(f"\n  Rendering character: {char_id}")
    print(f"  Directions: {len(directions)}, Animations: {len(animations)}")

    pivot = import_model(model_path)
    if not pivot:
        return

    for anim_name, anim_data in animations.items():
        num_frames = anim_data.get("frames", 1)

        for direction in directions:
            angle = DIRECTIONS.get(direction, 0)

            # Rotate model to face direction
            pivot.rotation_euler = (0, 0, math.radians(angle))

            for frame_idx in range(num_frames):
                out_dir = ensure_output_dir("characters", char_id)
                filename = f"{char_id}-{anim_name}-{direction}-{frame_idx:02d}.png"
                out_path = out_dir / filename

                if out_path.exists():
                    continue

                # For animation frames, apply slight pose variations
                # (In a real pipeline, this would use bone animations)
                if anim_name == "walk":
                    # Subtle bob for walk cycle
                    bob = math.sin(frame_idx / num_frames * math.pi * 2) * 0.05
                    pivot.location.z = bob
                elif anim_name == "death":
                    # Gradual fall
                    tilt = (frame_idx / max(num_frames - 1, 1)) * math.radians(90)
                    pivot.rotation_euler.x = tilt
                elif anim_name == "hit":
                    # Recoil
                    recoil = math.sin(frame_idx / max(num_frames - 1, 1) * math.pi) * 0.1
                    pivot.location.y = recoil
                else:
                    pivot.location = (0, 0, 0)

                render_frame(out_path)
                print(f"    {filename}")

            # Reset pose
            pivot.location = (0, 0, 0)
            pivot.rotation_euler = (0, 0, 0)

    clear_model()


def render_static(asset: dict, category: str, model_path: Path):
    """Render a static or simple-animation asset (items, cover, weapons)."""
    asset_id = asset["id"]
    num_frames = asset.get("frames", 1)

    print(f"\n  Rendering {category}: {asset_id} ({num_frames} frames)")

    pivot = import_model(model_path)
    if not pivot:
        return

    for frame_idx in range(num_frames):
        out_dir = ensure_output_dir(category, asset_id)
        filename = f"{asset_id}-{frame_idx:02d}.png"
        out_path = out_dir / filename

        if out_path.exists():
            continue

        # Subtle idle animation (rotation or pulse)
        if num_frames > 1:
            angle = (frame_idx / num_frames) * math.pi * 2
            pivot.rotation_euler.z = math.radians(15) * math.sin(angle)
            scale_pulse = 1.0 + 0.03 * math.sin(angle)
            pivot.scale = (scale_pulse, scale_pulse, scale_pulse)

        render_frame(out_path)
        print(f"    {filename}")

    clear_model()


def main():
    if not IN_BLENDER:
        print("This script must be run inside Blender:")
        print("  blender --background --python render_sprites.py -- [options]")
        sys.exit(1)

    # Parse args after "--"
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", help="Only render this category")
    parser.add_argument("--id", help="Only render this asset ID")
    args = parser.parse_args(argv)

    manifest = load_manifest()

    # Setup scene once
    camera = setup_scene()

    # Render characters
    if not args.category or args.category == "characters":
        for char in manifest.get("characters", []):
            if args.id and char["id"] != args.id:
                continue
            model_path = MODELS_DIR / "characters" / f"{char['id']}.glb"
            if model_path.exists():
                render_character(char, model_path)
            else:
                print(f"  [SKIP] No model for character {char['id']}")

    # Render items, weapons, cover
    for cat in ["items", "weapons", "cover"]:
        if args.category and args.category != cat:
            continue
        for asset in manifest.get(cat, []):
            if args.id and asset["id"] != args.id:
                continue
            model_path = MODELS_DIR / cat / f"{asset['id']}.glb"
            if model_path.exists():
                render_static(asset, cat, model_path)
            else:
                print(f"  [SKIP] No model for {cat}/{asset['id']}")

    print(f"\n[DONE] Renders saved to {OUTPUT_BASE}")


if __name__ == "__main__":
    main()
