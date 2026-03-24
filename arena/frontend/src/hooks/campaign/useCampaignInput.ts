import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';

const INPUT_RATE_HZ = 20;
const INPUT_INTERVAL_MS = 1000 / INPUT_RATE_HZ;

interface UseCampaignInputOptions {
    sessionId: string | null;
    socket: Socket | null;
    dialogueOpenRef: MutableRefObject<boolean>;
}

export interface CampaignInputState {
    keysRef: MutableRefObject<Set<string>>;
    interactPressed: boolean;
    mapTogglePressed: boolean;
}

export function useCampaignInput({
    sessionId,
    socket,
    dialogueOpenRef,
}: UseCampaignInputOptions): CampaignInputState {
    const keysRef = useRef<Set<string>>(new Set());
    const interactPressedRef = useRef(false);
    const mapTogglePressedRef = useRef(false);

    // Track interact/map toggle as single-fire events (not held)
    const interactConsumed = useRef(false);
    const mapToggleConsumed = useRef(false);

    // Keyboard listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            keysRef.current.add(key);

            // E key — interact or advance dialogue
            if (key === 'e' && !interactConsumed.current) {
                interactConsumed.current = true;
                interactPressedRef.current = true;

                if (dialogueOpenRef.current) {
                    // Advance dialogue handled by the component listening to this ref
                } else if (socket && sessionId) {
                    // Emit interact — server determines nearest NPC
                    socket.emit('campaign-interact', { sessionId, npcId: '' });
                }
            }

            // Space — advance dialogue
            if (key === ' ' && dialogueOpenRef.current) {
                e.preventDefault();
                interactPressedRef.current = true;
            }

            // M key — toggle map overlay
            if (key === 'm' && !mapToggleConsumed.current) {
                mapToggleConsumed.current = true;
                mapTogglePressedRef.current = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            keysRef.current.delete(key);

            if (key === 'e') {
                interactConsumed.current = false;
                interactPressedRef.current = false;
            }
            if (key === 'm') {
                mapToggleConsumed.current = false;
                mapTogglePressedRef.current = false;
            }
            if (key === ' ') {
                interactPressedRef.current = false;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [sessionId, socket, dialogueOpenRef]);

    // 20Hz input emission interval
    useEffect(() => {
        if (!socket || !sessionId) return;

        const interval = setInterval(() => {
            // When dialogue is open, suppress movement emission
            if (dialogueOpenRef.current) return;

            const keys = keysRef.current;

            let mx = 0;
            let my = 0;
            if (keys.has('w') || keys.has('arrowup')) my -= 1;
            if (keys.has('s') || keys.has('arrowdown')) my += 1;
            if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
            if (keys.has('d') || keys.has('arrowright')) mx += 1;

            // Normalize diagonal movement
            if (mx !== 0 && my !== 0) {
                const len = Math.sqrt(mx * mx + my * my);
                mx /= len;
                my /= len;
            }

            const sprint = keys.has('shift');
            const shooting = false;  // Campaign uses click-to-shoot, not hold
            const melee = keys.has('f');
            const interact = keys.has('e');

            socket.emit('campaign-input', {
                sessionId,
                input: {
                    movement: { x: mx, y: my },
                    aimAngle: 0,
                    shooting,
                    melee,
                    sprint,
                    interact,
                    timestamp: Date.now(),
                },
            });
        }, INPUT_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [sessionId, socket, dialogueOpenRef]);

    return {
        keysRef,
        interactPressed: interactPressedRef.current,
        mapTogglePressed: mapTogglePressedRef.current,
    };
}
