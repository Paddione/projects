#!/usr/bin/env python3
"""
Phase 3: Blender Sprite Rendering
Imports 3D models (.glb) and renders them as 2D sprite frames from an orthographic
top-down camera at 60 degree angle, producing individual PNGs for sprite sheet packing.

Usage:
    blender --background --python render_sprites.py -- [--category CATEGORY] [--id ASSET_ID]
                                                       [--model PATH] [--template PATH] [--output DIR]

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
BLEND_DIR = Path(__file__).parent.parent / "assets" / "blend"
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
    if not MANIFEST_PATH.exists():
        return {"meta": {}, "characters": [], "weapons": [], "items": [], "tiles": [], "cover": [], "ui": []}
    with open(MANIFEST_PATH) as f:
        return json.load(f)


def ensure_output_dir(*parts: str) -> Path:
    out = OUTPUT_BASE
    for p in parts:
        out = out / p
    out.mkdir(parents=True, exist_ok=True)
    return out


def get_template_path(category: str) -> Path:
    """Get the Blender template path for an asset category."""
    template_map = {
        'characters': 'character.blend',
        'weapons': 'weapon.blend',
        'items': 'item.blend',
        'cover': 'cover.blend',
        'tiles': 'tile.blend',
        'ui': 'ui.blend',
    }

    template_file = template_map.get(category, 'character.blend')
    template_path = BLEND_DIR / template_file

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")

    return template_path


def load_blender_template(template_path: Path):
    """Load a Blender template file and prepare for rendering."""
    bpy.ops.wm.open_mainfile(filepath=str(template_path))
    print(f"  Loaded template: {template_path.name}")

    # Ensure camera is set
    if not bpy.context.scene.camera:
        # Find any camera in scene
        for obj in bpy.data.objects:
            if obj.type == 'CAMERA':
                bpy.context.scene.camera = obj
                break

    return bpy.context.scene


def link_model_to_template(model_path: Path, position=(0, 0, 0)):
    """Link a 3D model to the template scene."""
    model_path = Path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    # Use Blender's import for .glb files
    bpy.ops.import_scene.gltf(filepath=str(model_path))

    # Get the imported object (usually the last selected)
    imported = [obj for obj in bpy.context.selected_objects]
    if imported:
        # Parent all imports to an empty for rotation
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=position)
        pivot = bpy.context.object
        pivot.name = "ModelPivot"

        for obj in imported:
            obj.parent = pivot

        print(f"  Linked model: {model_path.name}")
        return pivot

    return None


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


def render_character(char: dict, model_path: Path, template_path=None):
    """Render all poses for a character across all directions using template."""
    char_id = char["id"]
    poses = char.get("poses", ["stand"])
    directions = char.get("directions", list(DIRECTIONS.keys()))

    print(f"\n  Rendering character: {char_id}")
    print(f"  Directions: {len(directions)}, Poses: {len(poses)}")

    # Load template
    if template_path:
        tpath = Path(template_path)
    else:
        tpath = get_template_path("characters")
    scene = load_blender_template(tpath)

    # Link model to template
    pivot = link_model_to_template(model_path)
    if not pivot:
        return

    for pose_name in poses:
        for direction in directions:
            angle = DIRECTIONS.get(direction, 0)

            # Rotate model to face direction
            pivot.rotation_euler = (0, 0, math.radians(angle))
            pivot.location = (0, 0, 0)

            out_dir = ensure_output_dir("characters", char_id)
            filename = f"{char_id}-{pose_name}-{direction}.png"
            out_path = out_dir / filename

            if not out_path.exists():
                render_frame(out_path)
                print(f"    {filename}")

    clear_model()


def render_static(asset: dict, category: str, model_path: Path, template_path=None):
    """Render a static or simple-animation asset using appropriate template."""
    asset_id = asset["id"]
    num_frames = asset.get("frames", 1)

    print(f"\n  Rendering {category}: {asset_id} ({num_frames} frames)")

    # Load template for this category
    if template_path:
        tpath = Path(template_path)
    else:
        tpath = get_template_path(category)
    scene = load_blender_template(tpath)

    # Link model to template
    pivot = link_model_to_template(model_path)
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
    parser.add_argument("--model", help="Model .glb path (overrides default)")
    parser.add_argument("--template", help="Template .blend path (overrides default)")
    parser.add_argument("--output", help="Output directory (overrides default)")
    args = parser.parse_args(argv)

    global OUTPUT_BASE
    if args.output:
        OUTPUT_BASE = Path(args.output)

    manifest = load_manifest()

    # Render characters
    if not args.category or args.category == "characters":
        for char in manifest.get("characters", []):
            if args.id and char["id"] != args.id:
                continue
            if args.model:
                model_path = Path(args.model)
            else:
                model_path = MODELS_DIR / "characters" / f"{char['id']}.glb"
            if model_path.exists():
                render_character(char, model_path, template_path=args.template)
            else:
                print(f"  [SKIP] No model for character {char['id']}")

    # Render items, weapons, cover
    for cat in ["items", "weapons", "cover"]:
        if args.category and args.category != cat:
            continue
        for asset in manifest.get(cat, []):
            if args.id and asset["id"] != args.id:
                continue
            if args.model:
                model_path = Path(args.model)
            else:
                model_path = MODELS_DIR / cat / f"{asset['id']}.glb"
            if model_path.exists():
                render_static(asset, cat, model_path, template_path=args.template)
            else:
                print(f"  [SKIP] No model for {cat}/{asset['id']}")

    print(f"\n[DONE] Renders saved to {OUTPUT_BASE}")


if __name__ == "__main__":
    main()
