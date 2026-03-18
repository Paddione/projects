import {
    Group,
    TorusGeometry,
    CircleGeometry,
    CapsuleGeometry,
    MeshLambertMaterial,
    MeshBasicMaterial,
    Mesh,
    Object3D,
} from 'three';
import type { CharacterInstance } from 'shared-3d';
import { GameRenderer3D } from './GameRenderer3D';

export const MODEL_BASE_URL = '/assets/3d/characters/';

const ANIM_WALK = 'walk';
const ANIM_IDLE = 'idle';

// Shared geometry
const ARMOR_GEO = new TorusGeometry(0.5, 0.08, 8, 32);
const ARMOR_MAT = new MeshLambertMaterial({ color: 0x38bdf8, emissive: 0x1a6a8a });
const MARKER_GEO = new CircleGeometry(0.8, 24);
const CAPSULE_GEO = new CapsuleGeometry(0.35, 1.0, 4, 12);

// Character accent colors
const CHAR_COLORS: Record<string, number> = {
    student: 0x00f2ff, student_f: 0x00f2ff,
    researcher: 0x3eff8b, researcher_f: 0x3eff8b,
    professor: 0xbc13fe, professor_f: 0xbc13fe,
    dean: 0xffd700, dean_f: 0xffd700,
    librarian: 0xff6b9d, librarian_f: 0xff6b9d,
};
const DEFAULT_CHAR_COLOR = 0x00f2ff;

interface TrackedPlayer {
    container: Object3D;     // root container for position/rotation
    instance: CharacterInstance | null;
    capsule: Mesh;           // always-visible colored capsule
    marker: Mesh;            // ground circle
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

        // Remove dead/gone players
        for (const [id, tracked] of this.players) {
            if (!livePlayers.has(id)) {
                this.playerGroup.remove(tracked.container);
                this.playerGroup.remove(tracked.marker);
                if (tracked.instance) tracked.instance.dispose();
                (tracked.capsule.material as MeshLambertMaterial).dispose();
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
                const charColor = CHAR_COLORS[charId] ?? DEFAULT_CHAR_COLOR;

                // Root container
                const container = new Object3D();

                // Always-visible colored capsule (player body)
                const capsuleMat = new MeshLambertMaterial({
                    color: charColor,
                    emissive: charColor,
                    emissiveIntensity: 0.3,
                });
                const capsule = new Mesh(CAPSULE_GEO, capsuleMat);
                capsule.position.y = 0.85;  // stand on ground
                capsule.castShadow = true;
                container.add(capsule);

                // Ground marker circle
                const markerMat = new MeshBasicMaterial({
                    color: charColor,
                    transparent: true,
                    opacity: 0.4,
                });
                const marker = new Mesh(MARKER_GEO, markerMat);
                marker.rotation.x = -Math.PI / 2;
                marker.position.y = 0.02;

                // Armor ring (around capsule waist)
                const armorRing = new Mesh(ARMOR_GEO, ARMOR_MAT.clone());
                armorRing.rotation.x = Math.PI / 2;
                armorRing.position.y = 0.5;
                container.add(armorRing);

                this.playerGroup.add(container);
                this.playerGroup.add(marker);

                // Try to load 3D model (non-blocking — capsule shows immediately)
                let instance: CharacterInstance | null = null;
                const modelUrl = `${MODEL_BASE_URL}${charId}.glb`;
                this.characterManager.getCharacter(player.id, modelUrl)
                    .then((inst) => {
                        instance = inst;
                        inst.mesh.scale.setScalar(2.0);
                        container.add(inst.mesh);
                        // Hide capsule once model loads (if model has visible geometry)
                        // Keep capsule visible as fallback since models have no animations
                        capsule.visible = false;
                    })
                    .catch(() => {
                        // Model failed — capsule remains as visual
                    });

                tracked = { container, instance, capsule, marker, armorRing, currentAnim: '' };
                this.players.set(player.id, tracked);
            }

            // Position
            const { wx, wz } = GameRenderer3D.toWorld(player.x, player.y);
            tracked.container.position.set(wx, 0, wz);
            tracked.marker.position.set(wx, 0.02, wz);

            // Rotation
            tracked.container.rotation.y = -player.rotation;

            // Animation (if model loaded)
            if (tracked.instance) {
                const isMoving = player.lastMoveDirection &&
                    (player.lastMoveDirection.dx !== 0 || player.lastMoveDirection.dy !== 0);
                const targetAnim = isMoving ? ANIM_WALK : ANIM_IDLE;
                if (tracked.currentAnim !== targetAnim) {
                    tracked.instance.playAnimation(targetAnim, { loop: true });
                    tracked.currentAnim = targetAnim;
                }
                tracked.instance.update(delta);
            }

            // Armor ring visibility
            tracked.armorRing.visible = player.hasArmor;
        }
    }

    dispose(): void {
        for (const tracked of this.players.values()) {
            this.playerGroup.remove(tracked.container);
            this.playerGroup.remove(tracked.marker);
            if (tracked.instance) tracked.instance.dispose();
            (tracked.capsule.material as MeshLambertMaterial).dispose();
            (tracked.marker.material as MeshBasicMaterial).dispose();
        }
        this.players.clear();
    }
}
