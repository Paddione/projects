import {
    Group,
    Box3,
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

// Shared geometry — sized for zoomed-out view (frustumSize 22)
const ARMOR_GEO = new TorusGeometry(0.35, 0.06, 8, 32);
const ARMOR_MAT = new MeshLambertMaterial({ color: 0x38bdf8, emissive: 0x1a6a8a });
const MARKER_GEO = new CircleGeometry(0.5, 24);
const CAPSULE_GEO = new CapsuleGeometry(0.2, 0.5, 8, 16);

// Character accent colors
const CHAR_COLORS: Record<string, number> = {
    student: 0x00f2ff, student_f: 0x00f2ff,
    researcher: 0x3eff8b, researcher_f: 0x3eff8b,
    professor: 0xbc13fe, professor_f: 0xbc13fe,
    dean: 0xffd700, dean_f: 0xffd700,
    librarian: 0xff6b9d, librarian_f: 0xff6b9d,
};
const DEFAULT_CHAR_COLOR = 0x00f2ff;

export interface PlayerRendererCallbacks {
    onPlayerDeath?: (worldPos: { x: number; y: number; z: number }, charColor: number) => void;
}

interface TrackedPlayer {
    container: Object3D;     // root container for position/rotation
    modelWrapper: Group | null; // model transform wrapper
    modelBaseY: number;      // ground-level Y for model wrapper
    instance: CharacterInstance | null;
    capsule: Mesh;           // always-visible colored capsule
    marker: Mesh;            // ground circle
    armorRing: Mesh;
    currentAnim: string;
    charId: string;
    walkPhase: number;       // procedural walk cycle phase
}

export class PlayerRenderer {
    private readonly playerGroup: Group;
    private readonly players: Map<string, TrackedPlayer> = new Map();
    private readonly characterManager: import('shared-3d').CharacterManager;
    private readonly callbacks: PlayerRendererCallbacks;

    constructor(
        playerGroup: Group,
        characterManager: import('shared-3d').CharacterManager,
        callbacks: PlayerRendererCallbacks = {},
    ) {
        this.playerGroup = playerGroup;
        this.characterManager = characterManager;
        this.callbacks = callbacks;
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
                const charColor = CHAR_COLORS[tracked.charId] ?? DEFAULT_CHAR_COLOR;
                const pos = tracked.container.position;
                this.callbacks.onPlayerDeath?.({ x: pos.x, y: pos.y + 0.5, z: pos.z }, charColor);
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
                    emissiveIntensity: 0.5,
                });
                const capsule = new Mesh(CAPSULE_GEO, capsuleMat);
                capsule.position.y = 0.55;  // stand on ground (half capsule height)
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
                armorRing.position.y = 0.35;
                container.add(armorRing);

                this.playerGroup.add(container);
                this.playerGroup.add(marker);

                tracked = { container, modelWrapper: null, modelBaseY: 0, instance: null, capsule, marker, armorRing, currentAnim: '', charId, walkPhase: 0 };
                this.players.set(player.id, tracked);

                // Try to load 3D model (non-blocking — capsule shows immediately)
                const modelUrl = `${MODEL_BASE_URL}${charId}.glb`;
                this.characterManager.getCharacter(player.id, modelUrl)
                    .then((inst) => {
                        tracked!.instance = inst;
                        // Wrap in group: model is Z-up, rotate to Y-up then face +Z (forward)
                        const mw = new Group();
                        mw.rotation.x = -Math.PI / 2;
                        mw.rotation.z = Math.PI; // face forward (model faces -Z after X rotation)
                        mw.scale.setScalar(1.5);
                        mw.add(inst.mesh);

                        // Compute bounding box after rotation to find model floor
                        mw.updateMatrixWorld(true);
                        const bbox = new Box3().setFromObject(mw);
                        mw.position.y = -bbox.min.y;

                        container.add(mw);
                        tracked!.modelWrapper = mw;
                        tracked!.modelBaseY = mw.position.y;
                        capsule.visible = false;
                    })
                    .catch(() => {
                        // Model failed — capsule remains as visual
                    });
            }

            // Position
            const { wx, wz } = GameRenderer3D.toWorld(player.x, player.y);
            tracked.container.position.set(wx, 0, wz);
            tracked.marker.position.set(wx, 0.02, wz);

            // Rotation — model faces +Z in container space, rotation.y = 0 means facing +Z
            tracked.container.rotation.y = -player.rotation;

            // Procedural walk animation (bob + lean)
            const isMoving = player.lastMoveDirection &&
                (player.lastMoveDirection.dx !== 0 || player.lastMoveDirection.dy !== 0);

            if (isMoving) {
                tracked.walkPhase += delta * 10; // walk cycle speed
                const bob = Math.sin(tracked.walkPhase) * 0.06;
                const lean = Math.sin(tracked.walkPhase * 0.5) * 0.08;
                if (tracked.modelWrapper) {
                    tracked.modelWrapper.position.y = tracked.modelBaseY + bob;
                    tracked.modelWrapper.rotation.y = lean;
                } else {
                    tracked.capsule.position.y = 0.55 + bob;
                }
            } else {
                tracked.walkPhase = 0;
                if (tracked.modelWrapper) {
                    tracked.modelWrapper.position.y = tracked.modelBaseY;
                    tracked.modelWrapper.rotation.y = 0;
                }
            }

            // Skeleton animation (if model has clips)
            if (tracked.instance) {
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
