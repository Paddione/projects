// jsdom polyfills for vitest
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}

// jsdom does not implement Canvas 2D context — provide a minimal stub so
// TextureFactory (and any future canvas-based services) can run under vitest.
const _origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (
    contextId: string,
    ...args: any[]
): any {
    if (contextId === '2d') {
        const noop = () => {};
        const ctx: Partial<CanvasRenderingContext2D> & Record<string, any> = {
            canvas: this,
            globalAlpha: 1,
            lineWidth: 1,
            fillStyle: '',
            strokeStyle: '',
            fillRect: noop,
            strokeRect: noop,
            clearRect: noop,
            beginPath: noop,
            moveTo: noop,
            lineTo: noop,
            arc: noop,
            stroke: noop,
            fill: noop,
            save: noop,
            restore: noop,
            translate: noop,
            scale: noop,
            rotate: noop,
            drawImage: noop,
            createLinearGradient: (_x0: number, _y0: number, _x1: number, _y1: number) => ({
                addColorStop: noop,
            }),
            createRadialGradient: (
                _x0: number, _y0: number, _r0: number,
                _x1: number, _y1: number, _r1: number,
            ) => ({
                addColorStop: noop,
            }),
            createPattern: () => null,
            measureText: (_text: string) => ({ width: 0 } as TextMetrics),
            getImageData: (_x: number, _y: number, w: number, h: number) =>
                ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h } as ImageData),
            putImageData: noop,
            setTransform: noop,
            resetTransform: noop,
            clip: noop,
            isPointInPath: () => false,
            closePath: noop,
            quadraticCurveTo: noop,
            bezierCurveTo: noop,
        };
        return ctx as CanvasRenderingContext2D;
    }
    return _origGetContext.call(this, contextId as any, ...args);
} as typeof HTMLCanvasElement.prototype.getContext;
