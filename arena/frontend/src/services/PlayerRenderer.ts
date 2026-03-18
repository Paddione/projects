import {
    Group,
    TorusGeometry,
    CircleGeometry,
    MeshLambertMaterial,
    MeshBasicMaterial,
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

// Ground marker — colored circle under each player for visibility
const MARKER_GEO = new CircleGeometry(0.5, 24);

// Character accent colors (match CHARACTER_COLORS in Game.tsx)
const CHAR_COLORS: Record<string, number> = {
    student: 0x00f2ff, student_f: 0x00f2ff,
    researcher: 0x3eff8b, researcher_f: 0x3eff8b,
    professor: 0xbc13fe, professor_f: 0xbc13fe,
    dean: 0xffd700, dean_f: 0xffd700,
    librarian: 0xff6b9d, librarian_f: 0xff6b9d,
};
const DEFAULT_CHAR_COLOR = 0x00f2ff;

interface TrackedPlayer {
    instance: CharacterInstance;
    armorRing: Mesh;
    marker: Mesh;
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
                this.playerGroup.remove(tracked.marker);
                tracked.instance.dispose();
                (tracked.marker.material as MeshBasicMaterial).dispose();
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

                // Scale character to be visible (models are ~1 unit tall, scale up to ~2 tiles)
                instance.mesh.scale.setScalar(2.0);

                // Ground marker — colored circle for visibility
                const charColor = CHAR_COLORS[charId] ?? DEFAULT_CHAR_COLOR;
                const markerMat = new MeshBasicMaterial({
                    color: charColor,
                    transparent: true,
                    opacity: 0.5,
                });
                const marker = new Mesh(MARKER_GEO, markerMat);
                marker.rotation.x = -Math.PI / 2; // lay flat
                marker.position.y = 0.02; // just above ground
                this.playerGroup.add(marker);

                // Armor ring
                const armorRing = new Mesh(ARMOR_GEO, ARMOR_MAT.clone());
                armorRing.rotation.x = Math.PI / 2;
                armorRing.position.y = 0.05;
                instance.mesh.add(armorRing);

                tracked = { instance, armorRing, marker, currentAnim: '' };
                this.players.set(player.id, tracked);
                this.playerGroup.add(instance.mesh);
            }

            // Position
            const { wx, wz } = GameRenderer3D.toWorld(player.x, player.y);
            tracked.instance.mesh.position.set(wx, 0, wz);
            tracked.marker.position.set(wx, 0.02, wz);

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
            this.playerGroup.remove(tracked.marker);
            tracked.instance.dispose();
            (tracked.marker.material as MeshBasicMaterial).dispose();
        }
        this.players.clear();
    }
}
