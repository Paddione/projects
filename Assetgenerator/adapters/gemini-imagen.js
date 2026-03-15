import { join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import https from 'node:https';

/**
 * Gemini Imagen adapter — generates concept images via Google's Imagen API.
 * Runs on the server (cloud API, no GPU needed).
 *
 * Requires: GEMINI_API_KEY environment variable
 * Models: imagen-4.0-generate-001 (standard), imagen-4.0-fast-generate-001 (fast)
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'imagen-4.0-generate-001';

function apiRequest(model, apiKey, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/${model}:predict`);
    const postData = JSON.stringify(body);

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Imagen API ${res.statusCode}: ${data.slice(0, 500)}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Imagen API invalid JSON: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

export async function generate({ id, asset, config, libraryRoot }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set. Get one at https://aistudio.google.com/apikey');
  }

  const outputDir = join(libraryRoot, 'concepts', asset.category);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `${id}.png`);

  const prompt = asset.prompt || `${asset.category} game asset: ${id}`;
  const resolution = asset.conceptResolution || 1024;

  // Map resolution to Imagen imageSize
  const imageSize = resolution >= 2048 ? '2K' : '1K';

  console.log(`  [Imagen] Generating concept for ${id}: "${prompt.slice(0, 80)}..."`);

  const response = await apiRequest(DEFAULT_MODEL, apiKey, {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      imageSize,
    },
  });

  // Extract base64 image from response
  const predictions = response.predictions;
  if (!predictions || predictions.length === 0) {
    throw new Error(`Imagen API returned no images for "${id}"`);
  }

  const imageData = predictions[0].bytesBase64Encoded;
  if (!imageData) {
    throw new Error(`Imagen API response missing image data for "${id}"`);
  }

  const buffer = Buffer.from(imageData, 'base64');
  writeFileSync(outputPath, buffer);
  console.log(`  [Imagen] Saved ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);

  return {
    status: 'done',
    path: `concepts/${asset.category}/${id}.png`,
    backend: 'gemini-imagen',
  };
}
