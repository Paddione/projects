import {
    Group,
    Box3,
    CapsuleGeometry,
    CircleGeometry,
    TorusGeometry,
    MeshLambertMaterial,
    MeshBasicMaterial,
    Mesh,
    Object3D,
} from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GameRenderer3D } from './GameRenderer3D';
import type { CharacterInstance } from 'shared-3d';

export const NPC_MODEL_URL = '/assets/3d/characters/student.glb'; // fallback model for NPCs

// NPC capsule — red-tinted, slightly smaller than players
const NPC_CAPSULE_GEO = new CapsuleGeometry(0.18, 0.45, 8, 16);
const NPC_MARKER_GEO = new CircleGeometry(0.45, 24);
const NPC_ENGAGE_RING_GEO = new TorusGeometry(0.55, 0.05, 8, 32);

const NPC_COLOR = 0xff4444;        // red
const NPC_ENGAGE_COLOR = 0xff6666; // bright red when attacking

interface TrackedNPC {
    container: Object3D;
    capsule: Mesh;
    marker: Mesh;
    engageRing: Mesh;
    labelObj: CSS2DObject;
    hpObj: CSS2DObject;
    el: HTMLDivElement;
    hpEl: HTMLDivElement;
    instance: CharacterInstance | null;
}

export class NPCRenderer {
    private readonly group: Group;
    private readonly npcs: Map<string | number, TrackedNPC> = new Map();
    private readonly characterManager: import('shared-3d').CharacterManager;

    constructor(group: Group, characterManager: import('shared-3d').CharacterManager) {
        this.group = group;
        this.characterManager = characterManager;
    }

    update(
        npcList: Array<{
            id?: string | number;
            type: string;
            x: number;
            y: number;
            rotation: number;
            hp: number;
            label?: string;
            state?: string;
            character?: string;
        }>,
        delta: number,
    ): void {
        const liveNpcs = npcList.filter((n) => n.type === 'enemy' && n.hp > 0);
        const liveIds = new Set(liveNpcs.map((n, i) => n.id ?? i));

        // Remove dead/gone NPCs
        for (const [id, tracked] of this.npcs) {
            if (!liveIds.has(id)) {
                this.group.remove(tracked.container);
                this.group.remove(tracked.marker);
                if (tracked.instance) tracked.instance.dispose();
                (tracked.capsule.material as MeshLambertMaterial).dispose();
                (tracked.marker.material as MeshBasicMaterial).dispose();
                this.npcs.delete(id);
            }
        }

        // Add / update live NPCs
        liveNpcs.forEach((npc, i) => {
            const id = npc.id ?? i;
            let tracked = this.npcs.get(id);

            if (!tracked) {
                const container = new Object3D();

                // Red capsule body
                const capsuleMat = new MeshLambertMaterial({
                    color: NPC_COLOR,
                    emissive: NPC_COLOR,
                    emissiveIntensity: 0.4,
                });
                const capsule = new Mesh(NPC_CAPSULE_GEO, capsuleMat);
                capsule.position.y = 0.5;
                capsule.castShadow = true;
                container.add(capsule);

                // Ground marker
                const markerMat = new MeshBasicMaterial({
                    color: NPC_COLOR,
                    transparent: true,
                    opacity: 0.35,
                });
                const marker = new Mesh(NPC_MARKER_GEO, markerMat);
                marker.rotation.x = -Math.PI / 2;
                marker.position.y = 0.02;

                // Engage ring (visible when NPC is attacking)
                const engageRingMat = new MeshBasicMaterial({
                    color: NPC_ENGAGE_COLOR,
                    transparent: true,
                    opacity: 0.6,
                });
                const engageRing = new Mesh(NPC_ENGAGE_RING_GEO, engageRingMat);
                engageRing.rotation.x = -Math.PI / 2;
                engageRing.position.y = 0.03;
                engageRing.visible = false;

                // Name label
                const el = document.createElement('div');
                el.style.cssText = 'font-family:Outfit,monospace;font-size:10px;font-weight:600;white-space:nowrap;pointer-events:none;user-select:none;text-shadow:0 1px 2px #000;color:#ff4444';
                const labelObj = new CSS2DObject(el);
                labelObj.position.set(0, 1.5, 0);
                container.add(labelObj);

                // HP pips
                const hpEl = document.createElement('div');
                hpEl.style.cssText = 'font-family:monospace;font-size:9px;white-space:nowrap;pointer-events:none;user-select:none;color:#ff4444';
                const hpObj = new CSS2DObject(hpEl);
                hpObj.position.set(0, 1.7, 0);
                container.add(hpObj);

                this.group.add(container);
                this.group.add(marker);
                this.group.add(engageRing);

                tracked = { container, capsule, marker, engageRing, labelObj, hpObj, el, hpEl, instance: null };
                this.npcs.set(id, tracked);

                // Try to load 3D model async
                const modelUrl = npc.character
                    ? `/assets/3d/characters/${npc.character}.glb`
                    : NPC_MODEL_URL;
                this.characterManager.getCharacter(`npc-${id}`, modelUrl)
                    .then((inst) => {
                        tracked!.instance = inst;
                        // Wrap in group: model is Z-up, rotate to Y-up
                        const modelWrapper = new Group();
                        modelWrapper.rotation.x = -Math.PI / 2;
                        modelWrapper.scale.setScalar(1.5);
                        modelWrapper.add(inst.mesh);

                        // Compute bounding box after rotation to find model floor
                        modelWrapper.updateMatrixWorld(true);
                        const bbox = new Box3().setFromObject(modelWrapper);
                        const bottomY = bbox.min.y;
                        // Shift model up so feet sit on Y=0
                        modelWrapper.position.y = -bottomY;

                        container.add(modelWrapper);
                        capsule.visible = false;
                    })
                    .catch(() => {
                        // Model failed — capsule stays
                    });
            }

            // Position
            const { wx, wz } = GameRenderer3D.toWorld(npc.x, npc.y);
            tracked.container.position.set(wx, 0, wz);
            tracked.marker.position.set(wx, 0.02, wz);
            tracked.engageRing.position.set(wx, 0.03, wz);

            // Rotation
            tracked.container.rotation.y = -npc.rotation;

            // Engage ring visibility
            tracked.engageRing.visible = npc.state === 'engage';

            // Update label
            tracked.el.textContent = npc.label || 'Bot';

            // Update HP pips
            const maxHp = 3;
            tracked.hpEl.textContent = '♥'.repeat(Math.max(0, npc.hp)) + '♡'.repeat(Math.max(0, maxHp - npc.hp));

            // Update animation if model loaded
            if (tracked.instance) {
                tracked.instance.update(delta);
            }
        });
    }

    dispose(): void {
        for (const tracked of this.npcs.values()) {
            this.group.remove(tracked.container);
            this.group.remove(tracked.marker);
            this.group.remove(tracked.engageRing);
            if (tracked.instance) tracked.instance.dispose();
            (tracked.capsule.material as MeshLambertMaterial).dispose();
            (tracked.marker.material as MeshBasicMaterial).dispose();
        }
        this.npcs.clear();
    }
}
