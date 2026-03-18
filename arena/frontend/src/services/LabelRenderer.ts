import { Group, Object3D } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GameRenderer3D } from './GameRenderer3D';

interface TrackedLabel {
    root: Object3D;
    labelObj: CSS2DObject;
    hpObj: CSS2DObject;
    el: HTMLDivElement;
    hpEl: HTMLDivElement;
}

export class LabelRenderer {
    private readonly group: Group;
    private readonly labels: Map<string, TrackedLabel> = new Map();

    constructor(group: Group) {
        this.group = group;
    }

    update(players: Array<{
        id: string;
        username: string;
        hp: number;
        hasArmor: boolean;
        isAlive: boolean;
        x: number;
        y: number;
        isMe?: boolean;
    }>): void {
        const liveIds = new Set(players.filter((p) => p.isAlive).map((p) => p.id));

        // Remove gone players
        for (const [id, tracked] of this.labels) {
            if (!liveIds.has(id)) {
                this.group.remove(tracked.root);
                this.labels.delete(id);
            }
        }

        for (const player of players) {
            if (!player.isAlive) continue;

            const { wx, wz } = GameRenderer3D.toWorld(player.x, player.y);

            let tracked = this.labels.get(player.id);
            if (!tracked) {
                // Name element
                const el = document.createElement('div');
                el.style.cssText = [
                    'font-family: Outfit, monospace',
                    'font-size: 10px',
                    'font-weight: 600',
                    'white-space: nowrap',
                    'pointer-events: none',
                    'user-select: none',
                    'text-shadow: 0 1px 2px #000',
                ].join(';');
                const labelObj = new CSS2DObject(el);
                labelObj.position.set(0, 2.5, 0);

                // HP element
                const hpEl = document.createElement('div');
                hpEl.style.cssText = [
                    'font-family: monospace',
                    'font-size: 9px',
                    'white-space: nowrap',
                    'pointer-events: none',
                    'user-select: none',
                ].join(';');
                const hpObj = new CSS2DObject(hpEl);
                hpObj.position.set(0, 2.7, 0);

                const root = new Object3D();
                root.add(labelObj, hpObj);
                this.group.add(root);

                tracked = { root, labelObj, hpObj, el, hpEl };
                this.labels.set(player.id, tracked);
            }

            // Position
            tracked.root.position.set(wx, 0, wz);

            // Update name
            tracked.el.textContent = player.username;
            tracked.el.style.color = player.isMe ? '#818cf8' : '#ffffff';

            // Update HP pips
            const totalHp = player.hp + (player.hasArmor ? 1 : 0);
            tracked.hpEl.textContent = '♥'.repeat(Math.max(0, totalHp));
            tracked.hpEl.style.color = player.hasArmor ? '#38bdf8' : '#ff4d6d';
        }
    }

    dispose(): void {
        for (const tracked of this.labels.values()) {
            this.group.remove(tracked.root);
        }
        this.labels.clear();
    }
}
