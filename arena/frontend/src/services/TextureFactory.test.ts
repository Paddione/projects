import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CanvasTexture } from 'three';
import { TextureFactory } from './TextureFactory';

describe('TextureFactory', () => {
    let factory: TextureFactory;

    beforeEach(() => {
        factory = new TextureFactory();
    });

    afterEach(() => {
        factory.dispose();
    });

    describe('cover textures', () => {
        it('getBuilding returns a CanvasTexture', () => {
            const tex = factory.getBuilding(42);
            expect(tex).toBeInstanceOf(CanvasTexture);
        });

        it('getBuilding with different seeds returns different textures', () => {
            const a = factory.getBuilding(1);
            const b = factory.getBuilding(2);
            expect(a).not.toBe(b);
        });

        it('getBuilding with same seed returns cached texture', () => {
            const a = factory.getBuilding(42);
            const b = factory.getBuilding(42);
            expect(a).toBe(b);
        });

        it('getFountainSide returns a CanvasTexture', () => {
            expect(factory.getFountainSide()).toBeInstanceOf(CanvasTexture);
        });

        it('getFountainTop returns a CanvasTexture', () => {
            expect(factory.getFountainTop()).toBeInstanceOf(CanvasTexture);
        });

        it('getHedge returns a CanvasTexture', () => {
            expect(factory.getHedge(0)).toBeInstanceOf(CanvasTexture);
        });

        it('getPond returns a CanvasTexture', () => {
            expect(factory.getPond()).toBeInstanceOf(CanvasTexture);
        });

        it('getBench returns a CanvasTexture', () => {
            expect(factory.getBench(3)).toBeInstanceOf(CanvasTexture);
        });

        it('getBench with lower HP includes damage cracks', () => {
            const healthy = factory.getBench(3);
            const damaged = factory.getBench(1);
            expect(healthy).not.toBe(damaged);
        });

        it('dispose clears all cached textures', () => {
            const before = factory.getBuilding(1);
            factory.getFountainSide();
            factory.dispose();
            const after = factory.getBuilding(1);
            expect(after).toBeInstanceOf(CanvasTexture);
            expect(after).not.toBe(before);
        });
    });
});
