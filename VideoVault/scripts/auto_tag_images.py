import os
import json
import base64
import argparse
import requests
import glob
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv(dotenv_path='env/.env-app')
load_dotenv(dotenv_path='env/.env-postgres')

# Configuration
OLLAMA_API_URL = "http://localhost:11435/api/generate"
MODEL_NAME = "llava"
IMAGE_DIR = "/home/patrick/VideoVault/Bibliothek/needs_Categories"

PROMPT = """
Analyze this image and provide a JSON response with two fields:
1. "categories": A dictionary where keys are category types and values are lists of applicable tags.
   Allowed category types: Age, Physical, Ethnicity, Relationship, Acts, Setting, Quality, Performer.
   Example: {"Physical": ["Slim", "Blonde"], "Setting": ["Indoor", "Bedroom"]}
2. "filename": A short, catchy, descriptive filename for this image (without extension). Use underscores instead of spaces. 
   Example: "blonde_in_bedroom_morning"

Ensure the JSON is valid. Do not include any other text.
"""

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def process_image(image_path, dry_run=False):
    print(f"Processing {image_path}...")
    
    image_path_obj = Path(image_path)
    filename = image_path_obj.name
    
    # Check if it's a sprite file
    if not filename.endswith("-sprite.jpg"):
        print(f"Skipping {filename}: Not a sprite file.")
        return

    # Extract base64 part
    base64_name = filename.replace("-sprite.jpg", "")
    
    # Find corresponding video file
    # Video file is expected to be base64_name.ext
    # We search for any file starting with base64_name in the same directory, excluding the sprite itself.
    
    search_pattern = str(image_path_obj.parent / f"{base64_name}.*")
    candidates = glob.glob(search_pattern)
    
    video_file = None
    for c in candidates:
        if c == image_path:
            continue
        if c.endswith("-sprite.jpg"):
            continue
        # Assume it's the video
        video_file = c
        break
    
    if not video_file:
        print(f"No video file found for {filename} (expected {base64_name}.*)")
        return

    print(f"Found video file: {Path(video_file).name}")

    # Call AI
    try:
        base64_image = encode_image(image_path)
        payload = {
            "model": MODEL_NAME,
            "prompt": PROMPT,
            "images": [base64_image],
            "stream": False,
            "format": "json"
        }
        
        response = requests.post(OLLAMA_API_URL, json=payload)
        response.raise_for_status()
        result = response.json()
        response_text = result.get("response", "{}")
        data = json.loads(response_text)
    except Exception as e:
        print(f"AI Error: {e}")
        return

    new_filename_base = data.get("filename", "").strip()
    categories = data.get("categories", {})
    
    if not new_filename_base:
        print("No filename generated.")
        return

    # Clean filename
    new_filename_base = "".join(c for c in new_filename_base if c.isalnum() or c in ('_', '-')).strip()
    
    video_path_obj = Path(video_file)
    new_video_filename = f"{new_filename_base}{video_path_obj.suffix}"
    new_video_path = video_path_obj.parent / new_video_filename
    
    new_sprite_filename = f"{new_filename_base}.jpg" # Simplified sprite name
    new_sprite_path = image_path_obj.parent / new_sprite_filename
    
    print(f"Proposed change:")
    print(f"  Video:  {video_path_obj.name} -> {new_video_filename}")
    print(f"  Sprite: {image_path_obj.name} -> {new_sprite_filename}")
    print(f"Categories: {json.dumps(categories, indent=2)}")
    
    if dry_run:
        return

    # Rename Video
    if new_video_path.exists() and new_video_path != video_path_obj:
        print(f"Target video {new_video_filename} already exists. Skipping.")
        return
        
    try:
        os.rename(video_path_obj, new_video_path)
        print(f"Renamed video to {new_video_path}")
    except OSError as e:
        print(f"Failed to rename video: {e}")
        return

    # Rename Sprite
    if new_sprite_path.exists() and new_sprite_path != image_path_obj:
        print(f"Target sprite {new_sprite_filename} already exists. Skipping sprite rename.")
    else:
        try:
            os.rename(image_path_obj, new_sprite_path)
            print(f"Renamed sprite to {new_sprite_path}")
        except OSError as e:
            print(f"Failed to rename sprite: {e}")

def main():
    parser = argparse.ArgumentParser(description="Auto tag and rename videos using Ollama and Sprites.")
    parser.add_argument("--dry-run", action="store_true", help="Simulate changes without applying them.")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of images to process.")
    args = parser.parse_args()

    if not os.path.exists(IMAGE_DIR):
        print(f"Directory not found: {IMAGE_DIR}")
        return

    # Check Ollama connection
    try:
        requests.get(OLLAMA_API_URL.replace("/api/generate", ""))
    except requests.exceptions.ConnectionError:
        print("Could not connect to Ollama. Please ensure 'ollama serve' is running.")
        return

    count = 0
    # List files and sort to ensure deterministic order (optional)
    files = sorted(os.listdir(IMAGE_DIR))
    for filename in files:
        if filename.lower().endswith("-sprite.jpg"):
            if args.limit > 0 and count >= args.limit:
                break
            
            image_path = os.path.join(IMAGE_DIR, filename)
            process_image(image_path, dry_run=args.dry_run)
            count += 1

if __name__ == "__main__":
    main()
