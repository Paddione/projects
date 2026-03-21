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
