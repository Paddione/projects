import {
    Group,
    BoxGeometry,
    MeshLambertMaterial,
    Mesh,
    PointLight,
} from 'three';
import { GameRenderer3D, WORLD_SCALE } from './GameRenderer3D';

const ITEM_COLORS: Record<string, number> = {
    health: 0xff4d6d,
    armor: 0x38bdf8,
    machine_gun: 0xf59e0b,
    grenade_launcher: 0xa78bfa,
};
const DEFAULT_ITEM_COLOR = 0x6ee7b7;

const ITEM_SIZE = WORLD_SCALE * 16;
const ITEM_GEO = new BoxGeometry(ITEM_SIZE, ITEM_SIZE, ITEM_SIZE);
const BOB_SPEED = 2; // radians per second
const BOB_HEIGHT = WORLD_SCALE * 4;

interface TrackedItem {
    mesh: Mesh;
    light: PointLight;
    phase: number; // bob phase offset
}

export class ItemRenderer {
    private readonly group: Group;
    private readonly items: Map<string | number, TrackedItem> = new Map();
    private time = 0;

    constructor(group: Group) {
        this.group = group;
    }

    update(
        itemList: Array<{
            id?: string | number;
            x: number;
            y: number;
            type: string;
        }>,
        delta: number,
    ): void {
        this.time += delta;

        const currentIds = new Set(itemList.map((item, i) => item.id ?? i));

        // Remove collected items
        for (const [id, tracked] of this.items) {
            if (!currentIds.has(id)) {
                this.group.remove(tracked.mesh);
                this.group.remove(tracked.light);
                tracked.mesh.geometry.dispose();
                (tracked.mesh.material as MeshLambertMaterial).dispose();
                this.items.delete(id);
            }
        }

        // Add / update
        itemList.forEach((item, i) => {
            const id = item.id ?? i;
            const { wx, wz } = GameRenderer3D.toWorld(item.x, item.y);

            let tracked = this.items.get(id);
            if (!tracked) {
                const color = ITEM_COLORS[item.type] ?? DEFAULT_ITEM_COLOR;
                const mat = new MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
                const mesh = new Mesh(ITEM_GEO, mat);
                mesh.castShadow = true;

                const light = new PointLight(color, 0.8, 0.5);

                this.group.add(mesh);
                this.group.add(light);

                tracked = { mesh, light, phase: Math.random() * Math.PI * 2 };
                this.items.set(id, tracked);
            }

            // Bob animation
            const bobY = ITEM_SIZE / 2 + BOB_HEIGHT * Math.sin(this.time * BOB_SPEED + tracked.phase);
            tracked.mesh.position.set(wx, bobY, wz);
            tracked.mesh.rotation.y = this.time * BOB_SPEED * 0.5;
            tracked.light.position.set(wx, bobY + 0.05, wz);
        });
    }

    dispose(): void {
        for (const tracked of this.items.values()) {
            this.group.remove(tracked.mesh);
            this.group.remove(tracked.light);
            tracked.mesh.geometry.dispose();
            (tracked.mesh.material as MeshLambertMaterial).dispose();
        }
        this.items.clear();
    }
}
