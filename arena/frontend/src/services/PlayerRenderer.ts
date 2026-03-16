import {
    Group,
    TorusGeometry,
    MeshLambertMaterial,
    Mesh,
} from 'three';
import type { CharacterInstance } from 'shared-3d';
import { GameRenderer3D } from './GameRenderer3D';

export const MODEL_BASE_URL = '/assets/3d/characters/';

// Map game character names to animation names
const ANIM_WALK = 'walk';
const ANIM_IDLE = 'idle';

// Armor ring geometry (shared)
const ARMOR_GEO = new TorusGeometry(0.06, 0.012, 8, 32);
const ARMOR_MAT = new MeshLambertMaterial({ color: 0x38bdf8, emissive: 0x1a6a8a });

interface TrackedPlayer {
    instance: CharacterInstance;
    armorRing: Mesh;
    currentAnim: string;
}

export class PlayerRenderer {
    private readonly playerGroup: Group;
    private readonly players: Map<string, TrackedPlayer> = new Map();
    private readonly characterManager: import('shared-3d').CharacterManager;

    constructor(playerGroup: Group, characterManager: import('shared-3d').CharacterManager) {
        this.playerGroup = playerGroup;
        this.characterManager = characterManager;
    }

    async update(
        players: Array<{
            id: string;
            x: number;
            y: number;
            rotation: number;
            character?: string;
            hasArmor: boolean;
            isAlive: boolean;
            lastMoveDirection?: { dx: number; dy: number };
        }>,
        delta: number,
    ): Promise<void> {
        const livePlayers = new Set(players.filter((p) => p.isAlive).map((p) => p.id));

        // Remove players who are dead or left
        for (const [id, tracked] of this.players) {
            if (!livePlayers.has(id)) {
                this.playerGroup.remove(tracked.instance.mesh);
                tracked.instance.dispose();
                this.players.delete(id);
            }
        }

        // Add / update live players
        for (const player of players) {
            if (!player.isAlive) continue;

            let tracked = this.players.get(player.id);

            if (!tracked) {
                const charId = player.character || 'student';
                const modelUrl = `${MODEL_BASE_URL}${charId}.glb`;

                let instance: CharacterInstance;
                try {
                    instance = await this.characterManager.getCharacter(player.id, modelUrl);
                } catch {
                    // Model not found — skip this player this frame
                    continue;
                }

                // Armor ring
                const armorRing = new Mesh(ARMOR_GEO, ARMOR_MAT.clone());
                armorRing.rotation.x = Math.PI / 2;
                armorRing.position.y = 0.05;
                instance.mesh.add(armorRing);

                tracked = { instance, armorRing, currentAnim: '' };
                this.players.set(player.id, tracked);
                this.playerGroup.add(instance.mesh);
            }

            // Position
            const { wx, wz } = GameRenderer3D.toWorld(player.x, player.y);
            tracked.instance.mesh.position.set(wx, 0, wz);

            // Rotation (game rotation is in radians from +X axis in screen space)
            tracked.instance.mesh.rotation.y = -player.rotation;

            // Animation
            const isMoving = player.lastMoveDirection &&
                (player.lastMoveDirection.dx !== 0 || player.lastMoveDirection.dy !== 0);
            const targetAnim = isMoving ? ANIM_WALK : ANIM_IDLE;
            if (tracked.currentAnim !== targetAnim) {
                tracked.instance.playAnimation(targetAnim, { loop: true });
                tracked.currentAnim = targetAnim;
            }

            // Armor ring visibility
            tracked.armorRing.visible = player.hasArmor;

            // Advance animation mixer
            tracked.instance.update(delta);
        }
    }

    dispose(): void {
        for (const tracked of this.players.values()) {
            this.playerGroup.remove(tracked.instance.mesh);
            tracked.instance.dispose();
        }
        this.players.clear();
    }
}
