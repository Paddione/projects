import { CanvasTexture, SRGBColorSpace, RepeatWrapping } from 'three';

/** Simple seeded PRNG for deterministic per-instance variation. */
function seededRandom(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s * 1664525 + 1013904223) | 0;
        return ((s >>> 0) / 4294967296);
    };
}

const TEX_SIZE = 128;

export class TextureFactory {
    private readonly cache = new Map<string, CanvasTexture>();

    getBuilding(seed: number): CanvasTexture {
        const key = `building-${seed}`;
        if (this.cache.has(key)) return this.cache.get(key)!;

        const canvas = document.createElement('canvas');
        canvas.width = TEX_SIZE;
        canvas.height = TEX_SIZE * 2;
        const ctx = canvas.getContext('2d')!;
        const rand = seededRandom(seed);

        // Dark base with gradient
        const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bg.addColorStop(0, '#1a1a3a');
        bg.addColorStop(1, '#0a0a2a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Rooftop accent line (cyan → pink gradient)
        const roofGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        roofGrad.addColorStop(0, 'rgba(0,242,255,0.6)');
        roofGrad.addColorStop(1, 'rgba(255,0,170,0.4)');
        ctx.fillStyle = roofGrad;
        ctx.fillRect(0, 0, canvas.width, 3);

        // Window grid (2 columns × 3 rows)
        const windowColors = [
            'rgba(0,242,255,VAL)',
            'rgba(255,200,50,VAL)',
            'rgba(255,0,170,VAL)',
        ];
        const colW = 36;
        const rowH = 28;
        const padX = (canvas.width - colW * 2 - 12) / 2;
        const padY = 20;

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 2; col++) {
                const x = padX + col * (colW + 12);
                const y = padY + row * (rowH + 10);
                const brightness = 0.1 + rand() * 0.35;
                const colorTemplate = windowColors[Math.floor(rand() * windowColors.length)];
                const color = colorTemplate.replace('VAL', brightness.toFixed(2));

                ctx.fillStyle = color;
                ctx.fillRect(x, y, colW, rowH);
                ctx.strokeStyle = color.replace(/[\d.]+\)$/, `${Math.min(brightness + 0.15, 0.5)})`);
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, colW, rowH);
            }
        }

        // Door at bottom center
        const doorW = 24;
        const doorH = 32;
        const doorX = (canvas.width - doorW) / 2;
        const doorY = canvas.height - doorH;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.strokeStyle = 'rgba(0,242,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(doorX, doorY, doorW, doorH);

        // Bottom edge highlight
        ctx.fillStyle = 'rgba(0,242,255,0.4)';
        ctx.fillRect(0, canvas.height - 2, canvas.width, 2);

        return this.makeTexture(canvas, key);
    }

    getFountainSide(): CanvasTexture {
        const key = 'fountain-side';
        if (this.cache.has(key)) return this.cache.get(key)!;

        const canvas = document.createElement('canvas');
        canvas.width = TEX_SIZE;
        canvas.height = TEX_SIZE;
        const ctx = canvas.getContext('2d')!;

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#3a3a5a');
        grad.addColorStop(1, '#2a2a4a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        for (let y = 32; y < canvas.height; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(0,170,255,0.4)';
        ctx.fillRect(0, 0, canvas.width, 3);

        return this.makeTexture(canvas, key);
    }

    getFountainTop(): CanvasTexture {
        const key = 'fountain-top';
        if (this.cache.has(key)) return this.cache.get(key)!;

        const canvas = document.createElement('canvas');
        canvas.width = TEX_SIZE;
        canvas.height = TEX_SIZE;
        const ctx = canvas.getContext('2d')!;

        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, '#1a3a5a');
        grad.addColorStop(1, '#0a1a3a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(0,242,255,0.2)';
        ctx.lineWidth = 0.8;
        for (let r = 12; r < 60; r += 14) {
            ctx.beginPath();
            ctx.arc(64, 64, r, 0, Math.PI * 2);
            ctx.globalAlpha = 0.3 - (r / 60) * 0.2;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const spot = ctx.createRadialGradient(64, 64, 0, 64, 64, 10);
        spot.addColorStop(0, 'rgba(0,170,255,0.3)');
        spot.addColorStop(1, 'transparent');
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        return this.makeTexture(canvas, key);
    }

    getHedge(seed: number): CanvasTexture {
        const key = `hedge-${seed}`;
        if (this.cache.has(key)) return this.cache.get(key)!;

        const canvas = document.createElement('canvas');
        canvas.width = TEX_SIZE;
        canvas.height = TEX_SIZE;
        const ctx = canvas.getContext('2d')!;
        const rand = seededRandom(seed);

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#1a4a1a');
        grad.addColorStop(1, '#0a2a0a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 40; i++) {
            const x = rand() * canvas.width;
            const y = rand() * canvas.height;
            const r = 2 + rand() * 4;
            const brightness = 0.1 + rand() * 0.2;
            ctx.fillStyle = `rgba(0,255,102,${brightness})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        return this.makeTexture(canvas, key);
    }

    getPond(): CanvasTexture {
        const key = 'pond';
        if (this.cache.has(key)) return this.cache.get(key)!;

        const canvas = document.createElement('canvas');
        canvas.width = TEX_SIZE;
        canvas.height = TEX_SIZE;
        const ctx = canvas.getContext('2d')!;

        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, '#0a2a4a');
        grad.addColorStop(1, '#051520');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(0,242,255,0.15)';
        ctx.lineWidth = 0.6;
        const cx = 40, cy = 45;
        for (let r = 8; r < 50; r += 12) {
            ctx.globalAlpha = 0.2 - (r / 50) * 0.15;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const spots = [[80, 35], [55, 75], [90, 70]];
        for (const [sx, sy] of spots) {
            const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 8);
            glow.addColorStop(0, 'rgba(0,170,255,0.25)');
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        return this.makeTexture(canvas, key);
    }

    getBench(hp: number): CanvasTexture {
        const key = `bench-hp${hp}`;
        if (this.cache.has(key)) return this.cache.get(key)!;

        const canvas = document.createElement('canvas');
        canvas.width = TEX_SIZE;
        canvas.height = TEX_SIZE / 2;
        const ctx = canvas.getContext('2d')!;

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#5a4020');
        grad.addColorStop(1, '#3a2a10');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        const plankH = canvas.height / 3;
        for (let i = 1; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * plankH);
            ctx.lineTo(canvas.width, i * plankH);
            ctx.stroke();
        }

        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(0, 0, 6, canvas.height);
        ctx.fillRect(canvas.width - 6, 0, 6, canvas.height);
        ctx.strokeStyle = 'rgba(0,242,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0, 0, 6, canvas.height);
        ctx.strokeRect(canvas.width - 6, 0, 6, canvas.height);

        if (hp < 3 && hp > 0) {
            ctx.strokeStyle = `rgba(255,68,68,${0.5 - hp * 0.1})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(20, 5);
            ctx.lineTo(canvas.width - 20, canvas.height - 5);
            ctx.stroke();
            if (hp === 1) {
                ctx.beginPath();
                ctx.moveTo(canvas.width - 30, 8);
                ctx.lineTo(25, canvas.height - 8);
                ctx.stroke();
            }
        }

        return this.makeTexture(canvas, key);
    }

    /** 4-panel wall atlas: plain, vent, warning, pipe (128px each, 512×128 total). */
    getWallAtlas(): CanvasTexture {
        const key = 'wall-atlas';
        if (this.cache.has(key)) return this.cache.get(key)!;

        const panelW = 128;
        const panelH = 128;
        const canvas = document.createElement('canvas');
        canvas.width = panelW * 4;
        canvas.height = panelH;
        const ctx = canvas.getContext('2d')!;

        for (let p = 0; p < 4; p++) {
            const ox = p * panelW;
            const grad = ctx.createLinearGradient(ox, 0, ox, panelH);
            grad.addColorStop(0, '#2a2a4a');
            grad.addColorStop(1, '#1a1a3a');
            ctx.fillStyle = grad;
            ctx.fillRect(ox, 0, panelW, panelH);

            // Horizontal seam lines
            ctx.strokeStyle = 'rgba(0,242,255,0.15)';
            ctx.lineWidth = 0.5;
            for (let row = 1; row < 3; row++) {
                const y = row * (panelH / 3);
                ctx.beginPath();
                ctx.moveTo(ox, y);
                ctx.lineTo(ox + panelW, y);
                ctx.stroke();
            }

            // Vertical center seam
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.moveTo(ox + panelW / 2, 0);
            ctx.lineTo(ox + panelW / 2, panelH);
            ctx.stroke();

            // Top and bottom cyan edge highlight
            ctx.fillStyle = 'rgba(0,242,255,0.5)';
            ctx.fillRect(ox, 0, panelW, 2);
            ctx.fillStyle = 'rgba(0,242,255,0.4)';
            ctx.fillRect(ox, panelH - 2, panelW, 2);

            // Panel-specific details
            if (p === 1) {
                // Vent detail
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(ox + 20, 16, 24, 10);
                ctx.strokeStyle = 'rgba(0,242,255,0.2)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(ox + 20, 16, 24, 10);
            } else if (p === 2) {
                // Warning stripe at bottom
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(ox + 8, panelH - 14, panelW - 16, 6);
                for (let sx = 0; sx < panelW - 16; sx += 8) {
                    ctx.fillStyle = sx % 16 < 8 ? 'rgba(255,200,0,0.2)' : 'transparent';
                    ctx.fillRect(ox + 8 + sx, panelH - 14, 4, 6);
                }
            } else if (p === 3) {
                // Pipe accent
                ctx.fillStyle = 'rgba(60,60,80,0.6)';
                ctx.fillRect(ox + panelW - 18, 8, 6, panelH - 16);
                ctx.strokeStyle = 'rgba(0,242,255,0.15)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(ox + panelW - 18, 8, 6, panelH - 16);
            }
        }

        return this.makeTexture(canvas, key);
    }

    /** 3-panel path atlas: halves, thirds, LED strip (128px each, 384×128 total). */
    getPathAtlas(): CanvasTexture {
        const key = 'path-atlas';
        if (this.cache.has(key)) return this.cache.get(key)!;

        const panelW = 128;
        const panelH = 128;
        const canvas = document.createElement('canvas');
        canvas.width = panelW * 3;
        canvas.height = panelH;
        const ctx = canvas.getContext('2d')!;

        for (let p = 0; p < 3; p++) {
            const ox = p * panelW;
            const grad = ctx.createLinearGradient(ox, 0, ox, panelH);
            grad.addColorStop(0, '#2a2520');
            grad.addColorStop(1, '#1a1a15');
            ctx.fillStyle = grad;
            ctx.fillRect(ox, 0, panelW, panelH);

            // Cyan edge highlights
            ctx.fillStyle = 'rgba(0,242,255,0.2)';
            ctx.fillRect(ox, 0, panelW, 1);
            ctx.fillStyle = 'rgba(0,242,255,0.15)';
            ctx.fillRect(ox, panelH - 1, panelW, 1);

            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.5;
            if (p === 0) {
                ctx.beginPath();
                ctx.moveTo(ox + panelW / 2, 0);
                ctx.lineTo(ox + panelW / 2, panelH);
                ctx.stroke();
            } else if (p === 1) {
                for (let d = 1; d < 3; d++) {
                    ctx.beginPath();
                    ctx.moveTo(ox + d * (panelW / 3), 0);
                    ctx.lineTo(ox + d * (panelW / 3), panelH);
                    ctx.stroke();
                }
            } else {
                ctx.beginPath();
                ctx.moveTo(ox + panelW / 2, 0);
                ctx.lineTo(ox + panelW / 2, panelH);
                ctx.stroke();
                const ledGrad = ctx.createLinearGradient(ox + 10, 0, ox + panelW - 10, 0);
                ledGrad.addColorStop(0, 'transparent');
                ledGrad.addColorStop(0.3, 'rgba(255,170,0,0.15)');
                ledGrad.addColorStop(0.5, 'rgba(255,170,0,0.2)');
                ledGrad.addColorStop(0.7, 'rgba(255,170,0,0.15)');
                ledGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = ledGrad;
                ctx.fillRect(ox + 10, panelH / 2 - 1, panelW - 20, 3);
            }
        }

        return this.makeTexture(canvas, key);
    }

    /** Floor texture: dark base, cyan grid, intersection dots, circuit traces. */
    getFloor(mapW: number, mapH: number): CanvasTexture {
        const key = `floor-${mapW}x${mapH}`;
        if (this.cache.has(key)) return this.cache.get(key)!;

        const scale = 16;
        const w = Math.min(mapW * scale, 2048);
        const h = Math.min(mapH * scale, 2048);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(0,242,255,0.08)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= mapW; x++) {
            const px = (x / mapW) * w;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, h);
            ctx.stroke();
        }
        for (let y = 0; y <= mapH; y++) {
            const py = (y / mapH) * h;
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(w, py);
            ctx.stroke();
        }

        // Intersection glow dots
        for (let x = 0; x <= mapW; x++) {
            for (let y = 0; y <= mapH; y++) {
                const px = (x / mapW) * w;
                const py = (y / mapH) * h;
                const dot = ctx.createRadialGradient(px, py, 0, px, py, 3);
                dot.addColorStop(0, 'rgba(0,242,255,0.12)');
                dot.addColorStop(1, 'transparent');
                ctx.fillStyle = dot;
                ctx.fillRect(px - 3, py - 3, 6, 6);
            }
        }

        // Circuit traces
        const rand = seededRandom(mapW * 1000 + mapH);
        ctx.strokeStyle = 'rgba(0,242,255,0.04)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 30; i++) {
            const x1 = rand() * w;
            const y1 = rand() * h;
            const len = 20 + rand() * 60;
            const horizontal = rand() > 0.5;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(horizontal ? x1 + len : x1, horizontal ? y1 : y1 + len);
            ctx.stroke();
        }
        // Small circuit circles
        for (let i = 0; i < 15; i++) {
            ctx.beginPath();
            ctx.arc(rand() * w, rand() * h, 2 + rand() * 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,242,255,0.03)';
            ctx.stroke();
        }

        return this.makeTexture(canvas, key);
    }

    private makeTexture(canvas: HTMLCanvasElement, key: string): CanvasTexture {
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.wrapS = RepeatWrapping;
        tex.wrapT = RepeatWrapping;
        this.cache.set(key, tex);
        return tex;
    }

    dispose(): void {
        for (const tex of this.cache.values()) {
            tex.dispose();
        }
        this.cache.clear();
    }
}
