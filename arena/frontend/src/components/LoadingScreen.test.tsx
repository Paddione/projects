import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import LoadingScreen from './LoadingScreen';

// Mock AssetService and SoundService
const mockLoadAll = vi.fn();
const mockSoundLoadAll = vi.fn();

vi.mock('../services/AssetService', () => ({
    AssetService: {
        loadAll: (...args: any[]) => mockLoadAll(...args),
    },
}));

vi.mock('../services/SoundService', () => ({
    SoundService: {
        loadAll: () => mockSoundLoadAll(),
    },
}));

describe('LoadingScreen Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows ARENA title', () => {
        mockLoadAll.mockReturnValue(new Promise(() => {}));
        render(<LoadingScreen onLoaded={() => {}} />);
        expect(screen.getByText('ARENA')).toBeTruthy();
    });

    it('shows initial loading status', () => {
        mockLoadAll.mockReturnValue(new Promise(() => {}));
        render(<LoadingScreen onLoaded={() => {}} />);
        expect(screen.getByText(/Loading sprites/)).toBeTruthy();
    });

    it('calls onLoaded after assets and audio load', async () => {
        const onLoaded = vi.fn();
        mockLoadAll.mockResolvedValue(undefined);
        mockSoundLoadAll.mockResolvedValue(undefined);

        render(<LoadingScreen onLoaded={onLoaded} />);

        // Wait for async loading to complete
        await vi.waitFor(() => {
            expect(screen.getByText(/Ready/)).toBeTruthy();
        });

        // Advance past the 300ms delay
        vi.advanceTimersByTime(300);
        expect(onLoaded).toHaveBeenCalled();
    });

    it('shows error but still calls onLoaded after delay on asset failure', async () => {
        const onLoaded = vi.fn();
        mockLoadAll.mockRejectedValue(new Error('Asset load failed'));

        render(<LoadingScreen onLoaded={onLoaded} />);

        await vi.waitFor(() => {
            expect(screen.getByText(/Failed to load assets/)).toBeTruthy();
        });

        // Advance past the 2000ms recovery delay
        vi.advanceTimersByTime(2000);
        expect(onLoaded).toHaveBeenCalled();
    });

    it('reports progress through AssetService callback', async () => {
        let progressCb: ((p: number) => void) | undefined;
        mockLoadAll.mockImplementation((cb: (p: number) => void) => {
            progressCb = cb;
            return new Promise(() => {}); // never resolves
        });

        render(<LoadingScreen onLoaded={() => {}} />);

        // Simulate 50% sprite progress → 35% total (0.5 × 0.7)
        await act(async () => {
            progressCb?.(0.5);
        });
        expect(screen.getByText(/35%/)).toBeTruthy();
    });
});
