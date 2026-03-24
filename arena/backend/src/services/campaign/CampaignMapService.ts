import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CampaignMap, CampaignMapDoor } from '../../types/campaign.js';
import { CAMPAIGN_TILE } from '../../types/campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class CampaignMapService {
    private maps: Map<string, CampaignMap> = new Map();

    constructor() {
        this.loadMaps();
    }

    private loadMaps(): void {
        const mapDir = join(__dirname, '../../maps/campaign');
        const mapFiles = ['vogelsen.json', 'patricks-house-ground.json', 'patricks-house-upper.json'];

        for (const file of mapFiles) {
            try {
                const raw = readFileSync(join(mapDir, file), 'utf-8');
                const data = JSON.parse(raw) as CampaignMap;
                this.maps.set(data.meta.id, data);
                console.log(`[CampaignMapService] Loaded map: ${data.meta.id} (${data.meta.width}x${data.meta.height})`);
            } catch (error) {
                console.error(`[CampaignMapService] Failed to load map ${file}:`, error);
            }
        }
    }

    getMap(mapId: string): CampaignMap | undefined {
        return this.maps.get(mapId);
    }

    getDefaultMap(): CampaignMap {
        return this.maps.get('vogelsen')!;
    }

    getAllMapIds(): string[] {
        return Array.from(this.maps.keys());
    }

    /**
     * Check if a tile position is walkable.
     * Wall, building, and water tiles block movement.
     */
    isTileWalkable(map: CampaignMap, tx: number, ty: number): boolean {
        if (!this.isInBounds(map, tx, ty)) return false;

        const tile = map.tiles[ty]?.[tx];
        if (tile === undefined) return false;

        // Non-walkable tile types
        if (
            tile === CAMPAIGN_TILE.WALL ||
            tile === CAMPAIGN_TILE.BUILDING ||
            tile === CAMPAIGN_TILE.WATER
        ) {
            return false;
        }

        return true;
    }

    /**
     * Find the door at a given tile position.
     */
    getDoorAtTile(map: CampaignMap, tx: number, ty: number): CampaignMapDoor | undefined {
        return map.doors.find(
            (door) => door.tileX === tx && door.tileY === ty
        );
    }

    /**
     * Check if a pixel position is near a door (within DOOR_INTERACTION_RANGE tiles).
     */
    getNearbyDoor(map: CampaignMap, px: number, py: number, rangeTiles: number): CampaignMapDoor | undefined {
        const tileSize = map.meta.tileSize;
        for (const door of map.doors) {
            const doorPx = door.tileX * tileSize + tileSize / 2;
            const doorPy = door.tileY * tileSize + tileSize / 2;
            const dist = Math.hypot(px - doorPx, py - doorPy);
            if (dist <= rangeTiles * tileSize) {
                return door;
            }
        }
        return undefined;
    }

    /**
     * Check if tile position is within map bounds.
     */
    isInBounds(map: CampaignMap, tx: number, ty: number): boolean {
        return tx >= 0 && ty >= 0 && tx < map.meta.width && ty < map.meta.height;
    }

    /**
     * Check if a pixel position is valid for player movement.
     * Converts pixel coords to tile coords and checks walkability.
     */
    isPositionWalkable(map: CampaignMap, px: number, py: number): boolean {
        const tileSize = map.meta.tileSize;
        const tx = Math.floor(px / tileSize);
        const ty = Math.floor(py / tileSize);
        return this.isTileWalkable(map, tx, ty);
    }

    /**
     * Clamp pixel position to map boundaries.
     */
    clampToMapBounds(map: CampaignMap, px: number, py: number): { x: number; y: number } {
        const tileSize = map.meta.tileSize;
        const mapWidth = map.meta.width * tileSize;
        const mapHeight = map.meta.height * tileSize;
        return {
            x: Math.max(tileSize, Math.min(mapWidth - tileSize, px)),
            y: Math.max(tileSize, Math.min(mapHeight - tileSize, py)),
        };
    }
}
