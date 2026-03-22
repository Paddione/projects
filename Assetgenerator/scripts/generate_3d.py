#!/usr/bin/env python3
"""
Phase 2: Image -> 3D Model Conversion
Converts concept art PNGs to 3D models using TripoSR (local) or Meshy.ai (cloud).

Usage:
    python generate_3d.py [--backend auto|triposr|meshy] [--category CATEGORY] [--id ASSET_ID]
                          [--input PATH] [--output DIR]

    --backend       Generation backend (default: auto-detect)
    --meshy-key     Meshy.ai API key (or set MESHY_API_KEY env var)
    --category      Only process this category
    --id            Only process this asset ID
    --input         Input concept image or directory (overrides default)
    --output        Output directory (overrides default)
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

MANIFEST_PATH = Path(__file__).parent.parent / "assets" / "manifest.json"
CONCEPTS_DIR = Path(__file__).parent.parent / "assets" / "concepts"
OUTPUT_BASE = Path(__file__).parent.parent / "assets" / "models"

# Add TripoSR to path if cloned into .venv
TRIPOSR_PATH = Path(__file__).parent.parent / ".venv" / "TripoSR"
if TRIPOSR_PATH.exists() and str(TRIPOSR_PATH) not in sys.path:
    sys.path.insert(0, str(TRIPOSR_PATH))

# Categories that need 3D models (tiles/ui are 2D-only)
CATEGORIES_3D = {"characters", "weapons", "items", "cover"}


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {"meta": {}, "characters": [], "weapons": [], "items": [], "tiles": [], "cover": [], "ui": []}
    with open(MANIFEST_PATH) as f:
        return json.load(f)


def ensure_output_dir(category: str) -> Path:
    out = OUTPUT_BASE / category
    out.mkdir(parents=True, exist_ok=True)
    return out


# =============================================================================
# TripoSR Backend (Local)
# =============================================================================

_triposr_model = None

def triposr_available() -> bool:
    """Check if TripoSR dependencies are installed."""
    try:
        import torch
        if not torch.cuda.is_available():
            return False
        # Check for the correct TripoSR package (installed from git)
        from tsr.system import TSR  # noqa: F401
        return True
    except ImportError:
        # Also try the alternative import path
        try:
            from TripoSR.tsr.system import TSR  # noqa: F401
            return True
        except ImportError:
            return False


def triposr_generate(image_path: Path, output_path: Path) -> bool:
    """Convert a concept image to 3D model using TripoSR."""
    global _triposr_model
    try:
        import torch
        from PIL import Image

        # Try both import paths
        try:
            from tsr.system import TSR
        except ImportError:
            from TripoSR.tsr.system import TSR

        if _triposr_model is None:
            print("  Loading TripoSR model (first run, ~2GB download)...")
            _triposr_model = TSR.from_pretrained(
                "stabilityai/TripoSR",
                config_name="config.yaml",
                weight_name="model.ckpt",
            )
            _triposr_model.renderer.set_chunk_size(8192)
            _triposr_model.to("cuda")

        image = Image.open(image_path)
        # TripoSR expects RGB — composite RGBA onto white background
        if image.mode == 'RGBA':
            bg = Image.new('RGB', image.size, (255, 255, 255))
            bg.paste(image, mask=image.split()[3])
            image = bg

        # Run TripoSR inference (~15s on 12GB GPU)
        with torch.no_grad():
            scene_codes = _triposr_model([image], device="cuda")

        # Export as GLB
        meshes = _triposr_model.extract_mesh(scene_codes, has_vertex_color=True, resolution=256)
        meshes[0].export(str(output_path))
        return True

    except Exception as e:
        print(f"  [ERROR] TripoSR failed: {e}")
        return False


# =============================================================================
# Meshy.ai Backend (Cloud)
# =============================================================================

def meshy_available(api_key: str) -> bool:
    """Check if Meshy API key is set."""
    return bool(api_key)


def meshy_image_to_3d(api_key: str, image_path: Path, output_path: Path) -> bool:
    """Convert image to 3D using Meshy.ai image-to-3D API."""
    import base64

    image_data = base64.b64encode(image_path.read_bytes()).decode()
    ext = image_path.suffix.lower().lstrip(".")
    mime = f"image/{ext}" if ext != "jpg" else "image/jpeg"

    payload = json.dumps({
        "image_url": f"data:{mime};base64,{image_data}",
        "enable_pbr": True,
    }).encode()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        # Create task
        req = urllib.request.Request(
            "https://api.meshy.ai/v2/image-to-3d",
            data=payload,
            headers=headers,
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read())
        task_id = result.get("result")
        if not task_id:
            print(f"  [ERROR] No task_id from Meshy")
            return False

        print(f"  [MESHY] Task {task_id} created, polling...")

        # Poll for completion (typically 1-3 min)
        for attempt in range(120):
            time.sleep(5)
            poll_req = urllib.request.Request(
                f"https://api.meshy.ai/v2/image-to-3d/{task_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            poll_resp = urllib.request.urlopen(poll_req, timeout=15)
            poll_data = json.loads(poll_resp.read())
            status = poll_data.get("status")

            if status == "SUCCEEDED":
                model_url = poll_data.get("model_urls", {}).get("glb")
                if model_url:
                    model_req = urllib.request.Request(model_url)
                    model_data = urllib.request.urlopen(model_req, timeout=60).read()
                    output_path.write_bytes(model_data)
                    return True
                print(f"  [ERROR] No GLB URL in Meshy response")
                return False
            elif status == "FAILED":
                print(f"  [ERROR] Meshy task failed: {poll_data.get('task_error', 'unknown')}")
                return False
            elif attempt % 6 == 0:
                progress = poll_data.get("progress", 0)
                print(f"    ... {status} ({progress}%)")

        print(f"  [ERROR] Meshy timed out after 10 minutes")
        return False

    except Exception as e:
        print(f"  [ERROR] Meshy request failed: {e}")
        return False


def meshy_text_to_3d(api_key: str, prompt: str, output_path: Path) -> bool:
    """Generate 3D model directly from text using Meshy.ai (skips concept art)."""
    payload = json.dumps({
        "mode": "preview",
        "prompt": prompt,
        "art_style": "low-poly",
        "negative_prompt": "blurry, realistic, photorealistic",
    }).encode()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        req = urllib.request.Request(
            "https://api.meshy.ai/v2/text-to-3d",
            data=payload,
            headers=headers,
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read())
        task_id = result.get("result")
        if not task_id:
            print(f"  [ERROR] No task_id from Meshy text-to-3D")
            return False

        print(f"  [MESHY] Text-to-3D task {task_id}, polling...")

        for attempt in range(120):
            time.sleep(5)
            poll_req = urllib.request.Request(
                f"https://api.meshy.ai/v2/text-to-3d/{task_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            poll_resp = urllib.request.urlopen(poll_req, timeout=15)
            poll_data = json.loads(poll_resp.read())
            status = poll_data.get("status")

            if status == "SUCCEEDED":
                model_url = poll_data.get("model_urls", {}).get("glb")
                if model_url:
                    model_req = urllib.request.Request(model_url)
                    model_data = urllib.request.urlopen(model_req, timeout=60).read()
                    output_path.write_bytes(model_data)
                    return True
                return False
            elif status == "FAILED":
                print(f"  [ERROR] Meshy text-to-3D failed")
                return False
            elif attempt % 6 == 0:
                progress = poll_data.get("progress", 0)
                print(f"    ... {status} ({progress}%)")

        return False
    except Exception as e:
        print(f"  [ERROR] Meshy text-to-3D failed: {e}")
        return False


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Convert concept art to 3D models")
    parser.add_argument("--backend", choices=["auto", "triposr", "meshy"], default="auto")
    parser.add_argument("--meshy-key", default=os.environ.get("MESHY_API_KEY", ""))
    parser.add_argument("--category", help="Only process this category")
    parser.add_argument("--id", help="Only process this asset ID")
    parser.add_argument("--text-to-3d", action="store_true",
                        help="Use text-to-3D (Meshy only, skips concept art requirement)")
    parser.add_argument("--input", help="Input concept image or directory (overrides default)")
    parser.add_argument("--output", help="Output directory (overrides default)")
    parser.add_argument("--force", action="store_true", help="Overwrite existing models")
    args = parser.parse_args()

    global OUTPUT_BASE, CONCEPTS_DIR
    if args.output:
        OUTPUT_BASE = Path(args.output)
        OUTPUT_BASE.mkdir(parents=True, exist_ok=True)
    if args.input:
        input_path = Path(args.input)
        if input_path.is_dir():
            CONCEPTS_DIR = input_path
        else:
            CONCEPTS_DIR = input_path.parent

    # Determine backend
    backend = args.backend
    if backend == "auto":
        if triposr_available():
            backend = "triposr"
            print("[INFO] Using TripoSR (local GPU)")
        elif meshy_available(args.meshy_key):
            backend = "meshy"
            print("[INFO] Using Meshy.ai (cloud)")
        else:
            print("[ERROR] No 3D generation backend available!")
            print("  Install TripoSR: pip install tsr torch")
            print("  Or set MESHY_API_KEY for cloud generation")
            sys.exit(1)
    elif backend == "triposr" and not triposr_available():
        print("[ERROR] TripoSR not available. Install: pip install tsr torch")
        sys.exit(1)
    elif backend == "meshy" and not meshy_available(args.meshy_key):
        print("[ERROR] MESHY_API_KEY not set")
        sys.exit(1)

    # Direct mode: --input points to a specific image file and --id is given
    # Process that single image without needing a manifest entry
    if args.input and args.id and Path(args.input).is_file():
        concept_path = Path(args.input)
        out_path = OUTPUT_BASE / f"{args.id}.glb"

        if out_path.exists() and not args.force:
            print(f"  [SKIP] {args.id}.glb — already exists (use --force to overwrite)")
            sys.exit(0)

        print(f"  [GEN] {args.id} (image-to-3D, direct mode)")
        if backend == "triposr":
            ok = triposr_generate(concept_path, out_path)
        else:
            ok = meshy_image_to_3d(args.meshy_key, concept_path, out_path)

        if ok:
            print(f"  [OK] {args.id}.glb")
            print(f"\n[DONE] Generated 1/1 3D models")
            print(f"  Output: {OUTPUT_BASE}")
            sys.exit(0)
        else:
            print(f"  [FAIL] {args.id}.glb")
            sys.exit(1)

    # Manifest mode: iterate over manifest entries
    manifest = load_manifest()
    total = 0
    success = 0

    for cat_name in CATEGORIES_3D:
        if args.category and cat_name != args.category:
            continue

        assets = manifest.get(cat_name, [])
        if not assets:
            continue

        print(f"\n{'='*60}")
        print(f"  3D Models: {cat_name} ({len(assets)} assets)")
        print(f"{'='*60}")

        out_dir = ensure_output_dir(cat_name)

        for asset in assets:
            asset_id = asset["id"]
            if args.id and asset_id != args.id:
                continue

            out_path = out_dir / f"{asset_id}.glb"
            if out_path.exists() and not args.force:
                print(f"  [SKIP] {cat_name}/{asset_id}.glb — already exists (use --force to overwrite)")
                total += 1
                success += 1
                continue

            concept_path = CONCEPTS_DIR / cat_name / f"{asset_id}.png"
            total += 1

            if args.text_to_3d and backend == "meshy":
                print(f"  [GEN] {cat_name}/{asset_id} (text-to-3D)")
                ok = meshy_text_to_3d(args.meshy_key, asset["prompt"], out_path)
            elif concept_path.exists():
                print(f"  [GEN] {cat_name}/{asset_id} (image-to-3D)")
                if backend == "triposr":
                    ok = triposr_generate(concept_path, out_path)
                else:
                    ok = meshy_image_to_3d(args.meshy_key, concept_path, out_path)
            else:
                print(f"  [WARN] No concept art for {cat_name}/{asset_id}, skipping")
                print(f"         Run generate_concepts.py first, or use --text-to-3d")
                continue

            if ok:
                success += 1
                print(f"  [OK] {cat_name}/{asset_id}.glb")

    print(f"\n[DONE] Generated {success}/{total} 3D models")
    print(f"  Output: {OUTPUT_BASE}")


if __name__ == "__main__":
    main()
