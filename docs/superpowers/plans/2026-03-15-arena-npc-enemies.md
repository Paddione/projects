# Arena NPC Enemy System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add up to 3 configurable NPC enemies that patrol the map and shoot at human players, enabling solo play.

**Architecture:** Extend the existing NPC system in `GameService.ts` with a new `'enemy'` NPC type. Enemy NPCs use `patrol`/`engage` states (separate from zombie `wander`/`chase`). A new `createNPCProjectile()` helper produces projectiles from NPC positions. Round-end logic counts alive enemy NPCs alongside alive humans. The frontend renders enemy NPCs with red-tinted sprites and adds an NPC count selector to the lobby.

**Tech Stack:** TypeScript, Express, Socket.io, React, PixiJS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-arena-npc-enemies-design.md`

---

## Chunk 1: Backend Data Model & Constants

### Task 1: Extend types in `game.ts`

**Files:**
- Modify: `arena/backend/src/types/game.ts:156-182` (NPC types, ArenaLobbySettings)
- Modify: `arena/backend/src/types/game.ts:222` (player-killed event)

- [ ] **Step 1: Update NPCState and NPC interface**

In `arena/backend/src/types/game.ts`, replace lines 154-171:

```typescript
// -- NPC --

export type NPCType = 'zombie' | 'enemy';
export type NPCState = 'wander' | 'chase' | 'patrol' | 'engage';

export interface NPC {
    id: string;
    type: NPCType;
    x: number;
    y: number;
    hp: number;
    speed: number;
    rotation: number;
    targetPlayerId: string | null;
    state: NPCState;
    wanderAngle: number;
    wanderChangeTime: number;
    lastDamageTime: number;
    // Enemy NPC fields:
    weapon?: WeaponState;
    lastShotTime?: number;
    engageRange?: number;
    patrolTarget?: { x: number; y: number };
    losLostTime?: number;
    label?: string;
}
```

- [ ] **Step 2: Add `npcEnemies` to `ArenaLobbySettings`**

In `arena/backend/src/types/game.ts`, add to `ArenaLobbySettings` (after `itemSpawnInterval`):

```typescript
    npcEnemies: 0 | 1 | 2 | 3;
```

- [ ] **Step 3: Add `killerName`/`victimName` to `player-killed` event**

In `arena/backend/src/types/game.ts`, change the `player-killed` event type (line 222):

```typescript
    'player-killed': (data: { victimId: string; killerId: string; weapon: 'gun' | 'melee' | 'zone' | 'zombie' | 'npc'; killerName?: string; victimName?: string }) => void;
```

- [ ] **Step 4: Add `ENEMY_CONST` constants**

In `arena/backend/src/types/game.ts`, after `NPC_CONST` (after line 322):

```typescript
export const ENEMY_CONST = {
    SPEED_FACTOR: 0.5,
    AGGRO_RANGE: 192,
    DEAGGRO_RANGE: 256,
    FIRE_RATE_MS: 600,
    SPREAD_RAD: 0.26,
    HP: 3,
    LOS_LOSS_MS: 2000,
} as const;
```

- [ ] **Step 5: Update all `makeSettings` test helpers across the codebase**

Any test file with a `makeSettings()` helper must now include `npcEnemies: 0`. Update `arena/backend/src/services/GameService.features.test.ts`, `GameService.test.ts`, `GameService.anticheat.test.ts`, and any other test file containing `makeSettings`:

```typescript
function makeSettings(overrides: Partial<ArenaLobbySettings> = {}): ArenaLobbySettings {
    return {
        maxPlayers: 2,
        bestOf: 1,
        shrinkingZone: false,
        shrinkInterval: 30,
        itemSpawns: false,
        itemSpawnInterval: 60,
        npcEnemies: 0,
        ...overrides,
    };
}
```

This must happen now (not in Task 12) because all subsequent test runs depend on `makeSettings` compiling.

- [ ] **Step 6: Run typecheck to verify**

Run: `cd /home/patrick/projects/arena/backend && npx tsc --noEmit`
Expected: Errors in LobbyService `DEFAULT_SETTINGS` (missing `npcEnemies`) — that's expected and fixed in Task 2.

- [ ] **Step 7: Commit**

```bash
git add arena/backend/src/types/game.ts arena/backend/src/services/GameService.features.test.ts arena/backend/src/services/GameService.test.ts arena/backend/src/services/GameService.anticheat.test.ts
git commit -m "feat(arena): extend NPC types and lobby settings for enemy NPCs"
```

---

### Task 2: Update LobbyService defaults and solo play validation

**Files:**
- Modify: `arena/backend/src/services/LobbyService.ts:21-28` (DEFAULT_SETTINGS)
- Modify: `arena/backend/src/services/LobbyService.ts:235-237` (startGame validation)
- Test: `arena/backend/src/services/LobbyService.test.ts`

- [ ] **Step 1: Write failing test for solo play with NPCs**

Add to `arena/backend/src/services/LobbyService.test.ts`:

```typescript
describe('Solo play with NPC enemies', () => {
    it('should allow starting game with 1 player when npcEnemies >= 1', async () => {
        // Create lobby
        const lobby = await lobbyService.createLobby({
            hostId: 1,
            username: 'solo_player',
            settings: { npcEnemies: 2 },
        });

        // Ready up
        await lobbyService.updatePlayerReady(lobby.code, lobby.players[0].id, true);

        // Should not throw — 1 human + 2 NPCs = 3 participants
        const started = await lobbyService.startGame(lobby.code, 1);
        expect(started.status).toBe('starting');
    });

    it('should reject starting game with 1 player when npcEnemies is 0', async () => {
        const lobby = await lobbyService.createLobby({
            hostId: 1,
            username: 'solo_player',
            settings: { npcEnemies: 0 },
        });
        await lobbyService.updatePlayerReady(lobby.code, lobby.players[0].id, true);

        await expect(lobbyService.startGame(lobby.code, 1))
            .rejects.toThrow('At least 2 players are required');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/LobbyService.test.ts -t "Solo play"`
Expected: FAIL — `npcEnemies` not in `DEFAULT_SETTINGS`, solo start throws.

- [ ] **Step 3: Add `npcEnemies` to DEFAULT_SETTINGS**

In `arena/backend/src/services/LobbyService.ts`, update `DEFAULT_SETTINGS` (line 21-28):

```typescript
const DEFAULT_SETTINGS: ArenaLobbySettings = {
    maxPlayers: 4,
    bestOf: 1,
    shrinkingZone: false,
    shrinkInterval: 30,
    itemSpawns: true,
    itemSpawnInterval: 60,
    npcEnemies: 0,
};
```

- [ ] **Step 4: Relax startGame validation**

In `arena/backend/src/services/LobbyService.ts`, change the player count check (line 235-237):

```typescript
        const totalParticipants = lobby.players.length + (lobby.settings.npcEnemies || 0);
        if (totalParticipants < 2) {
            throw new Error('At least 2 players are required to start');
        }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/LobbyService.test.ts -t "Solo play"`
Expected: PASS

- [ ] **Step 6: Run all LobbyService tests to check no regressions**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/LobbyService.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add arena/backend/src/services/LobbyService.ts arena/backend/src/services/LobbyService.test.ts
git commit -m "feat(arena): allow solo play when NPC enemies configured"
```

---

### Task 3: Export NPC spawn positions from map

**Files:**
- Modify: `arena/backend/src/maps/campus-courtyard.ts:113` (export ITEM_SPAWN_POINTS)
- Test: `arena/backend/src/maps/campus-courtyard.test.ts`

- [ ] **Step 1: Export `ITEM_SPAWN_POINTS`**

In `arena/backend/src/maps/campus-courtyard.ts`, change line 113 from `const` to `export const`:

```typescript
export const ITEM_SPAWN_POINTS: { x: number; y: number }[] = [
```

- [ ] **Step 2: Verify map tests still pass**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/maps/campus-courtyard.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add arena/backend/src/maps/campus-courtyard.ts
git commit -m "refactor(arena): export ITEM_SPAWN_POINTS for NPC spawning"
```

---

## Chunk 2: Backend AI Logic

### Task 4: Line-of-sight raycast

**Files:**
- Modify: `arena/backend/src/services/GameService.ts` (add `hasLineOfSight` method)
- Test: `arena/backend/src/services/GameService.features.test.ts`

- [ ] **Step 1: Write failing tests for LOS**

Add to `arena/backend/src/services/GameService.features.test.ts`:

```typescript
describe('Line of Sight', () => {
    it('should have clear LOS between two open positions', () => {
        const gs = new GameService(20);
        const lobby = makeLobby([makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')]);
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        // Two positions in open area (tile 2,2 and 4,2 — both grass)
        const result = (gs as any).hasLineOfSight(
            2.5 * 32, 2.5 * 32,  // from
            4.5 * 32, 2.5 * 32,  // to
            game.map
        );
        expect(result).toBe(true);
    });

    it('should block LOS through wall tiles', () => {
        const gs = new GameService(20);
        const lobby = makeLobby([makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')]);
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        // From inside map to outside wall (tile 0 is wall)
        const result = (gs as any).hasLineOfSight(
            1.5 * 32, 1.5 * 32,  // from: inside
            0.5 * 32, 1.5 * 32,  // to: wall tile
            game.map
        );
        expect(result).toBe(false);
    });

    it('should block LOS through cover with blocksLineOfSight', () => {
        const gs = new GameService(20);
        const lobby = makeLobby([makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')]);
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        // Find a building cover object (blocksLineOfSight=true)
        const building = game.map.coverObjects.find((c: any) => c.type === 'building');
        expect(building).toBeDefined();

        // Ray that passes through the building
        const centerX = building.x + building.width / 2;
        const centerY = building.y + building.height / 2;
        const result = (gs as any).hasLineOfSight(
            building.x - 32, centerY,      // from: left of building
            building.x + building.width + 32, centerY,  // to: right of building
            game.map
        );
        expect(result).toBe(false);
    });

    it('should allow LOS through hedge (blocksLineOfSight=false)', () => {
        const gs = new GameService(20);
        const lobby = makeLobby([makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')]);
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        // Find a hedge cover object
        const hedge = game.map.coverObjects.find((c: any) => c.type === 'hedge');
        if (!hedge) return; // skip if no hedges in map

        const centerY = hedge.y + hedge.height / 2;
        const result = (gs as any).hasLineOfSight(
            hedge.x - 32, centerY,
            hedge.x + hedge.width + 32, centerY,
            game.map
        );
        expect(result).toBe(true);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "Line of Sight"`
Expected: FAIL — `hasLineOfSight` does not exist.

- [ ] **Step 3: Implement `hasLineOfSight` in GameService**

Add to `GameService` class in `arena/backend/src/services/GameService.ts`, in the UTILITY section (before `serializeState`):

```typescript
    private hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number, map: GameMap): boolean {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.hypot(dx, dy);
        const stepSize = GAME.TILE_SIZE / 2; // 16px steps
        const steps = Math.ceil(dist / stepSize);

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const x = fromX + dx * t;
            const y = fromY + dy * t;

            // Wall tile check
            const tileX = Math.floor(x / GAME.TILE_SIZE);
            const tileY = Math.floor(y / GAME.TILE_SIZE);
            if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
                if (map.tiles[tileY][tileX] === 1) return false;
            }

            // Cover LOS check
            for (const cover of map.coverObjects) {
                if (cover.blocksLineOfSight && this.pointInRect(x, y, cover)) {
                    return false;
                }
            }
        }

        return true;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "Line of Sight"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add arena/backend/src/services/GameService.ts arena/backend/src/services/GameService.features.test.ts
git commit -m "feat(arena): add line-of-sight raycast for NPC enemy vision"
```

---

### Task 5: Enemy NPC spawning

**Files:**
- Modify: `arena/backend/src/services/GameService.ts` (add `spawnEnemyNPCs`, update `startMatch`, update imports)
- Test: `arena/backend/src/services/GameService.features.test.ts`

- [ ] **Step 1: Write failing tests for enemy spawning**

Add to `arena/backend/src/services/GameService.features.test.ts`:

```typescript
describe('Enemy NPC Spawning', () => {
    it('should spawn enemy NPCs at match start when npcEnemies > 0', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 2 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        const enemyNPCs = game.npcs.filter((n: any) => n.type === 'enemy');
        expect(enemyNPCs).toHaveLength(2);
        expect(enemyNPCs[0].state).toBe('patrol');
        expect(enemyNPCs[0].hp).toBe(3);
        expect(enemyNPCs[0].label).toBe('Bot 1');
        expect(enemyNPCs[1].label).toBe('Bot 2');
    });

    it('should not spawn enemy NPCs when npcEnemies is 0', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 0 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        const enemyNPCs = game.npcs.filter((n: any) => n.type === 'enemy');
        expect(enemyNPCs).toHaveLength(0);
    });

    it('should allow solo match with 1 player and 3 NPCs', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'solo')],
            { npcEnemies: 3 }
        );
        // getSpawnPoints should allocate all 4 corners (1 human + 3 NPCs)
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        expect(game.players.size).toBe(1);
        const enemyNPCs = game.npcs.filter((n: any) => n.type === 'enemy');
        expect(enemyNPCs).toHaveLength(3);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "Enemy NPC Spawning"`
Expected: FAIL — no enemy NPCs spawned.

- [ ] **Step 3: Update imports in GameService.ts**

At the top of `arena/backend/src/services/GameService.ts`, update the imports:

```typescript
import { GAME, HP, DAMAGE, NPC_CONST, ENEMY_CONST } from '../types/game.js';
import { createCampusCourtyard, ITEM_SPAWN_POINTS } from '../maps/campus-courtyard.js';
```

- [ ] **Step 4: Implement `spawnEnemyNPCs` and call it from `startMatch`**

Add `spawnEnemyNPCs` method to `GameService` (in the NPC section, after `spawnNPCDrop`):

```typescript
    private spawnEnemyNPCs(game: GameState): void {
        const npcCount = game.settings.npcEnemies || 0;
        if (npcCount === 0) return;

        const totalEntities = game.players.size + npcCount;
        const allSpawns = this.getSpawnPoints(totalEntities, game.map);

        // Human players took the first game.players.size spawn points
        const npcSpawns = allSpawns.slice(game.players.size);

        for (let i = 0; i < npcCount; i++) {
            let x: number, y: number;

            if (i < npcSpawns.length) {
                // Use remaining spawn points
                const spawn = npcSpawns[i];
                x = spawn.x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2;
                y = spawn.y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2;
            } else {
                // Fallback: random item spawn point near center
                const fallback = ITEM_SPAWN_POINTS[i % ITEM_SPAWN_POINTS.length];
                x = fallback.x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2;
                y = fallback.y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2;
            }

            const npc: NPC = {
                id: uuidv4(),
                type: 'enemy',
                x,
                y,
                hp: ENEMY_CONST.HP,
                speed: GAME.PLAYER_SPEED * ENEMY_CONST.SPEED_FACTOR,
                rotation: 0,
                targetPlayerId: null,
                state: 'patrol',
                wanderAngle: 0,
                wanderChangeTime: 0,
                lastDamageTime: 0,
                lastShotTime: 0,
                engageRange: ENEMY_CONST.AGGRO_RANGE,
                patrolTarget: undefined,
                losLostTime: undefined,
                label: `Bot ${i + 1}`,
            };

            game.npcs.push(npc);
        }
    }
```

In `startMatch`, after the player loop (after line ~100 where players are set up), add:

```typescript
        // Spawn enemy NPCs
        this.spawnEnemyNPCs(game);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "Enemy NPC Spawning"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add arena/backend/src/services/GameService.ts arena/backend/src/services/GameService.features.test.ts
git commit -m "feat(arena): spawn enemy NPCs at match start"
```

---

### Task 6: NPC projectile creation

**Files:**
- Modify: `arena/backend/src/services/GameService.ts` (add `createNPCProjectile`)
- Test: `arena/backend/src/services/GameService.features.test.ts`

- [ ] **Step 1: Write failing test**

Add to `arena/backend/src/services/GameService.features.test.ts`:

```typescript
describe('NPC Projectile Creation', () => {
    it('should create a projectile from NPC position', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);
        const npc = game.npcs.find((n: any) => n.type === 'enemy');

        const initialProjectiles = game.projectiles.length;
        (gs as any).createNPCProjectile(game, npc, 0); // angle 0 = right

        expect(game.projectiles.length).toBe(initialProjectiles + 1);
        const proj = game.projectiles[game.projectiles.length - 1];
        expect(proj.ownerId).toBe(npc.id);
        expect(proj.x).toBe(npc.x);
        expect(proj.y).toBe(npc.y);
        expect(proj.damage).toBe(1); // DAMAGE.GUN
        expect(proj.velocityX).toBeCloseTo(16); // PROJECTILE_SPEED * cos(0)
        expect(proj.velocityY).toBeCloseTo(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "NPC Projectile"`
Expected: FAIL — `createNPCProjectile` does not exist.

- [ ] **Step 3: Implement `createNPCProjectile`**

Add to `GameService` class (in the PROJECTILES section, after `createProjectile`):

```typescript
    private createNPCProjectile(game: GameState, npc: NPC, angle: number): void {
        const projectile: Projectile = {
            id: uuidv4(),
            ownerId: npc.id,
            x: npc.x,
            y: npc.y,
            velocityX: Math.cos(angle) * GAME.PROJECTILE_SPEED,
            velocityY: Math.sin(angle) * GAME.PROJECTILE_SPEED,
            damage: DAMAGE.GUN,
            createdAt: Date.now(),
        };
        game.projectiles.push(projectile);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "NPC Projectile"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add arena/backend/src/services/GameService.ts arena/backend/src/services/GameService.features.test.ts
git commit -m "feat(arena): add NPC projectile creation helper"
```

---

### Task 7: Enemy NPC AI update loop

**Files:**
- Modify: `arena/backend/src/services/GameService.ts` (add `updateEnemyNPCs`, `pickPatrolTarget`, wire into tick)
- Test: `arena/backend/src/services/GameService.features.test.ts`

- [ ] **Step 1: Write failing tests for AI states**

Add to `arena/backend/src/services/GameService.features.test.ts`:

```typescript
describe('Enemy NPC AI', () => {
    it('should patrol toward target position', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);
        const npc = game.npcs.find((n: any) => n.type === 'enemy');

        // Set a patrol target far away
        npc.patrolTarget = { x: npc.x + 200, y: npc.y };
        const startX = npc.x;

        (gs as any).updateEnemyNPCs(game);

        // NPC should have moved toward target
        expect(npc.x).toBeGreaterThan(startX);
        expect(npc.state).toBe('patrol');
    });

    it('should engage when player is in LOS and range', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);
        const npc = game.npcs.find((n: any) => n.type === 'enemy');
        const player = game.players.get('1')!;

        // Place player within aggro range and clear LOS
        player.x = npc.x + 100;
        player.y = npc.y;

        (gs as any).updateEnemyNPCs(game);

        expect(npc.state).toBe('engage');
        expect(npc.targetPlayerId).toBe('1');
    });

    it('should disengage when player leaves range', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);
        const npc = game.npcs.find((n: any) => n.type === 'enemy');
        const player = game.players.get('1')!;

        // Engage first
        npc.state = 'engage';
        npc.targetPlayerId = '1';

        // Move player far away (beyond DEAGGRO_RANGE)
        player.x = npc.x + 500;
        player.y = npc.y + 500;

        (gs as any).updateEnemyNPCs(game);

        expect(npc.state).toBe('patrol');
        expect(npc.targetPlayerId).toBeNull();
    });

    it('should fire projectile when engaged and fire rate allows', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);
        const npc = game.npcs.find((n: any) => n.type === 'enemy');
        const player = game.players.get('1')!;

        // Place player in range
        player.x = npc.x + 100;
        player.y = npc.y;

        // Set lastShotTime to long ago so fire rate allows shooting
        npc.lastShotTime = 0;
        npc.state = 'engage';
        npc.targetPlayerId = '1';

        const initialProjectiles = game.projectiles.length;
        (gs as any).updateEnemyNPCs(game);

        expect(game.projectiles.length).toBeGreaterThan(initialProjectiles);
    });

    it('should not disengage during LOS grace period (< 2s)', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);
        const npc = game.npcs.find((n: any) => n.type === 'enemy');
        const player = game.players.get('1')!;

        // Engage the NPC
        npc.state = 'engage';
        npc.targetPlayerId = '1';
        player.x = npc.x + 100;
        player.y = npc.y;

        // Simulate LOS lost recently (500ms ago — within 2s grace)
        npc.losLostTime = Date.now() - 500;

        // Place player behind cover so LOS check fails, but mock it by keeping losLostTime set
        // The NPC should stay engaged during the grace period
        (gs as any).updateEnemyNPCs(game);

        // NPC should still be engaged (grace period active, player still in range)
        expect(npc.state).toBe('engage');
    });

    it('should disengage after LOS grace period expires (> 2s)', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);
        const npc = game.npcs.find((n: any) => n.type === 'enemy');
        const player = game.players.get('1')!;

        // Engage and set LOS lost 3s ago (past 2s grace)
        npc.state = 'engage';
        npc.targetPlayerId = '1';
        npc.losLostTime = Date.now() - 3000;
        // Player in range but behind cover — force LOS failure by placing behind wall
        player.x = 0.5 * 32; // wall tile at column 0
        player.y = npc.y;

        (gs as any).updateEnemyNPCs(game);

        expect(npc.state).toBe('patrol');
        expect(npc.targetPlayerId).toBeNull();
    });

    it('should not target other NPCs', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 2 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        // Kill all human players
        for (const [, player] of game.players) {
            player.isAlive = false;
        }

        // Update NPCs — they should not target each other
        for (const npc of game.npcs) {
            npc.state = 'patrol';
            npc.targetPlayerId = null;
        }

        (gs as any).updateEnemyNPCs(game);

        for (const npc of game.npcs) {
            expect(npc.targetPlayerId).toBeNull();
            expect(npc.state).toBe('patrol');
        }
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "Enemy NPC AI"`
Expected: FAIL — `updateEnemyNPCs` does not exist.

- [ ] **Step 3: Implement `pickPatrolTarget` helper**

Add to `GameService`:

```typescript
    private pickPatrolTarget(game: GameState): { x: number; y: number } {
        const mapWidth = game.map.width * GAME.TILE_SIZE;
        const mapHeight = game.map.height * GAME.TILE_SIZE;
        const margin = GAME.TILE_SIZE * 2;

        // Try up to 10 random positions to find a walkable one
        for (let attempt = 0; attempt < 10; attempt++) {
            const x = margin + Math.random() * (mapWidth - margin * 2);
            const y = margin + Math.random() * (mapHeight - margin * 2);
            if (this.isValidPosition(x, y, game.map)) {
                return { x, y };
            }
        }

        // Fallback to map center
        return { x: mapWidth / 2, y: mapHeight / 2 };
    }
```

- [ ] **Step 4: Implement `updateEnemyNPCs`**

Add to `GameService`:

```typescript
    private updateEnemyNPCs(game: GameState): void {
        const now = Date.now();

        for (const npc of game.npcs) {
            if (npc.type !== 'enemy' || npc.hp <= 0) continue;

            // Find nearest alive human player
            let nearestPlayer: PlayerState | null = null;
            let nearestDist = Infinity;
            for (const [, player] of game.players) {
                if (!player.isAlive) continue;
                const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestPlayer = player;
                }
            }

            // State transitions
            if (npc.state === 'patrol') {
                // Check for aggro
                if (nearestPlayer && nearestDist <= ENEMY_CONST.AGGRO_RANGE) {
                    if (this.hasLineOfSight(npc.x, npc.y, nearestPlayer.x, nearestPlayer.y, game.map)) {
                        npc.state = 'engage';
                        npc.targetPlayerId = nearestPlayer.id;
                        npc.losLostTime = undefined;
                    }
                }
            } else if (npc.state === 'engage') {
                const target = npc.targetPlayerId ? game.players.get(npc.targetPlayerId) : null;

                if (!target || !target.isAlive) {
                    // Target dead — scan for next or disengage
                    if (nearestPlayer && nearestDist <= ENEMY_CONST.AGGRO_RANGE &&
                        this.hasLineOfSight(npc.x, npc.y, nearestPlayer.x, nearestPlayer.y, game.map)) {
                        npc.targetPlayerId = nearestPlayer.id;
                        npc.losLostTime = undefined;
                    } else {
                        npc.state = 'patrol';
                        npc.targetPlayerId = null;
                        npc.patrolTarget = undefined;
                        npc.losLostTime = undefined;
                    }
                } else {
                    const targetDist = Math.hypot(target.x - npc.x, target.y - npc.y);
                    const hasLOS = this.hasLineOfSight(npc.x, npc.y, target.x, target.y, game.map);

                    if (targetDist > ENEMY_CONST.DEAGGRO_RANGE) {
                        // Out of range — disengage immediately
                        npc.state = 'patrol';
                        npc.targetPlayerId = null;
                        npc.patrolTarget = undefined;
                        npc.losLostTime = undefined;
                    } else if (!hasLOS) {
                        // Lost LOS — start grace timer
                        if (!npc.losLostTime) {
                            npc.losLostTime = now;
                        } else if (now - npc.losLostTime >= ENEMY_CONST.LOS_LOSS_MS) {
                            npc.state = 'patrol';
                            npc.targetPlayerId = null;
                            npc.patrolTarget = undefined;
                            npc.losLostTime = undefined;
                        }
                    } else {
                        // Has LOS — reset grace timer
                        npc.losLostTime = undefined;
                    }
                }
            }

            // Movement
            if (npc.state === 'patrol') {
                // Pick patrol target if none
                if (!npc.patrolTarget) {
                    npc.patrolTarget = this.pickPatrolTarget(game);
                }

                const dx = npc.patrolTarget.x - npc.x;
                const dy = npc.patrolTarget.y - npc.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 16) {
                    // Reached target — pick new one
                    npc.patrolTarget = this.pickPatrolTarget(game);
                } else {
                    const angle = Math.atan2(dy, dx);
                    const newX = npc.x + Math.cos(angle) * npc.speed;
                    const newY = npc.y + Math.sin(angle) * npc.speed;

                    if (this.isValidPosition(newX, newY, game.map)) {
                        npc.x = newX;
                        npc.y = newY;
                    } else {
                        // Blocked — pick new target
                        npc.patrolTarget = this.pickPatrolTarget(game);
                    }
                    npc.rotation = angle;
                }
            } else if (npc.state === 'engage') {
                // Face the target, don't move
                const target = npc.targetPlayerId ? game.players.get(npc.targetPlayerId) : null;
                if (target && target.isAlive) {
                    npc.rotation = Math.atan2(target.y - npc.y, target.x - npc.x);

                    // Fire if cooldown allows
                    if (now - (npc.lastShotTime || 0) >= ENEMY_CONST.FIRE_RATE_MS) {
                        const spread = (Math.random() - 0.5) * 2 * ENEMY_CONST.SPREAD_RAD;
                        this.createNPCProjectile(game, npc, npc.rotation + spread);
                        npc.lastShotTime = now;
                    }
                }
            }

            // Clamp to map bounds
            const mapWidth = game.map.width * GAME.TILE_SIZE;
            const mapHeight = game.map.height * GAME.TILE_SIZE;
            npc.x = Math.max(GAME.TILE_SIZE, Math.min(mapWidth - GAME.TILE_SIZE, npc.x));
            npc.y = Math.max(GAME.TILE_SIZE, Math.min(mapHeight - GAME.TILE_SIZE, npc.y));
        }
    }
```

- [ ] **Step 5: Wire `updateEnemyNPCs` into the tick loop**

In the `tick()` method, after the `this.updateNPCs(game);` call (around line 278), add:

```typescript
        // Enemy NPC AI
        this.updateEnemyNPCs(game);
```

- [ ] **Step 6: Suppress zombie spawning when enemy NPCs are active**

In the `tick()` method, wrap the zombie spawn check (around lines 271-275) with:

```typescript
        // Zombie NPC spawning (disabled when enemy NPCs are present)
        if (!game.settings.npcEnemies || game.settings.npcEnemies === 0) {
            const npcSpawnTicks = NPC_CONST.SPAWN_INTERVAL_S * this.tickRate;
            if (game.tickCount - game.lastNPCSpawnTick >= npcSpawnTicks) {
                this.spawnNPC(game);
                game.lastNPCSpawnTick = game.tickCount;
            }
        }
```

- [ ] **Step 6b: Add type filter to existing `updateNPCs` (zombie AI)**

**CRITICAL**: The existing `updateNPCs()` iterates all `game.npcs` with no type filter. Without this fix, zombie AI will corrupt enemy NPC positions and deal unintended contact damage. At the top of the `for (const npc of game.npcs)` loop in `updateNPCs()` (around line 783), add:

```typescript
            if (npc.type !== 'zombie') continue;
```

- [ ] **Step 7: Run AI tests to verify they pass**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "Enemy NPC AI"`
Expected: PASS

- [ ] **Step 8: Run all GameService feature tests**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add arena/backend/src/services/GameService.ts arena/backend/src/services/GameService.features.test.ts
git commit -m "feat(arena): implement enemy NPC patrol/engage AI with shooting"
```

---

## Chunk 3: Round-End Logic & DB Persistence

### Task 8: Round-end with NPC participants

**Files:**
- Modify: `arena/backend/src/services/GameService.ts` (`checkRoundEnd`, `startNextRound`, `endMatchWithResults`, `onPlayerKilled` callback type)
- Test: `arena/backend/src/services/GameService.features.test.ts`

- [ ] **Step 1: Write failing tests for round-end with NPCs**

Add to `arena/backend/src/services/GameService.features.test.ts`:

```typescript
describe('Round-End with NPCs', () => {
    it('should not end round while enemy NPCs are still alive', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        // Kill player 2 — but NPC is still alive
        const player2 = game.players.get('2')!;
        player2.isAlive = false;
        player2.hp = 0;
        game.currentRound.alivePlayers = ['1'];

        (gs as any).checkRoundEnd(game);

        // Round should NOT end — 1 human + 1 NPC = 2 alive
        expect(game.currentRound.phase).toBe('playing');
    });

    it('should end round when only 1 human remains and all NPCs dead', () => {
        const gs = new GameService(20);
        let roundEndData: any = null;
        gs.setCallbacks({
            onRoundEnd: (_matchId: string, data: any) => { roundEndData = data; },
        });

        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        // Kill player 2 and all NPCs
        game.players.get('2')!.isAlive = false;
        game.currentRound.alivePlayers = ['1'];
        for (const npc of game.npcs) {
            if (npc.type === 'enemy') npc.hp = 0;
        }

        (gs as any).checkRoundEnd(game);

        expect(game.currentRound.phase).toBe('ended');
        expect(roundEndData?.winnerId).toBe('1');
    });

    it('should preserve and reset enemy NPCs on startNextRound', () => {
        const gs = new GameService(20);
        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 2, bestOf: 3 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        // Damage NPCs during the round
        for (const npc of game.npcs) {
            if (npc.type === 'enemy') {
                npc.hp = 1;
                npc.state = 'engage';
                npc.targetPlayerId = '1';
            }
        }

        // Simulate startNextRound
        (gs as any).startNextRound(game);

        // Enemy NPCs should be preserved with full HP and patrol state
        const enemyNPCs = game.npcs.filter((n: any) => n.type === 'enemy');
        expect(enemyNPCs).toHaveLength(2);
        for (const npc of enemyNPCs) {
            expect(npc.hp).toBe(3); // ENEMY_CONST.HP
            expect(npc.state).toBe('patrol');
            expect(npc.targetPlayerId).toBeNull();
        }
    });

    it('should set winnerId to empty string when NPC is last alive', () => {
        const gs = new GameService(20);
        let roundEndData: any = null;
        gs.setCallbacks({
            onRoundEnd: (_matchId: string, data: any) => { roundEndData = data; },
        });

        const lobby = makeLobby(
            [makeLobbyPlayer('1', 'p1'), makeLobbyPlayer('2', 'p2')],
            { npcEnemies: 1 }
        );
        const matchId = gs.startMatch(lobby);
        const game = (gs as any).activeGames.get(matchId);

        // Kill both humans — NPC survives
        game.players.get('1')!.isAlive = false;
        game.players.get('2')!.isAlive = false;
        game.currentRound.alivePlayers = [];

        (gs as any).checkRoundEnd(game);

        expect(game.currentRound.phase).toBe('ended');
        // winnerId should be empty — no human won
        expect(roundEndData?.winnerId).toBe('');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "Round-End with NPCs"`
Expected: FAIL — round ends prematurely when NPCs alive.

- [ ] **Step 3: Modify `checkRoundEnd` to count enemy NPCs**

Replace `checkRoundEnd` in `GameService.ts`:

```typescript
    private checkRoundEnd(game: GameState): void {
        const aliveHumans = game.currentRound.alivePlayers;
        const aliveEnemyNPCs = game.npcs.filter(n => n.type === 'enemy' && n.hp > 0);
        const aliveCount = aliveHumans.length + aliveEnemyNPCs.length;

        if (aliveCount <= 1) {
            // Determine winner — only a human can win
            const winnerId = aliveHumans.length === 1 ? aliveHumans[0] : '';
            game.currentRound.phase = 'ended';
            game.currentRound.endedAt = Date.now();
            game.currentRound.winnerId = winnerId;

            if (winnerId) {
                game.roundScores[winnerId] = (game.roundScores[winnerId] || 0) + 1;
                const winner = game.players.get(winnerId);
                if (winner) winner.roundsWon++;
            }

            this.onRoundEnd?.(game.matchId, {
                roundNumber: game.currentRound.roundNumber,
                winnerId,
                scores: { ...game.roundScores },
            });

            // Check if match is over
            const winsNeeded = Math.ceil(game.bestOf / 2);
            const matchWinner = Object.entries(game.roundScores).find(
                ([, wins]) => wins >= winsNeeded
            );

            if (matchWinner || game.currentRound.roundNumber >= game.bestOf) {
                this.endMatchWithResults(game, matchWinner?.[0] || winnerId).catch(err => {
                    console.error('Error ending match:', err);
                });
            } else {
                game.phase = 'round-transition';
                setTimeout(() => this.startNextRound(game), 5000);
            }
        }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run src/services/GameService.features.test.ts -t "Round-End with NPCs"`
Expected: PASS

- [ ] **Step 5: Update `startNextRound` to preserve and reset enemy NPCs**

In `startNextRound`, replace the entire method body. **Key fix**: Use a single `getSpawnPoints` call with `totalEntities` for both humans and NPCs, so they don't share the same corners:

```typescript
    private startNextRound(game: GameState): void {
        // Preserve enemy NPCs, clear zombies
        const enemyNPCs = game.npcs.filter(n => n.type === 'enemy');
        const npcCount = enemyNPCs.length;
        const totalEntities = game.players.size + npcCount;
        const allSpawns = this.getSpawnPoints(totalEntities, game.map);

        // Reset human players using first N spawn points
        let index = 0;
        for (const [, player] of game.players) {
            const spawn = allSpawns[index % allSpawns.length];
            this.playerService.resetForRound(
                player,
                spawn.x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2,
                spawn.y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2
            );
            index++;
        }

        // Reset game state for new round
        game.projectiles = [];
        game.items = [];
        game.npcs = [];
        game.tickCount = 0;
        game.lastItemSpawnTick = 0;
        game.lastNPCSpawnTick = 0;
        if (game.zone) {
            game.zone = this.createInitialZone(game.map);
        }

        // Reset and respawn enemy NPCs using remaining spawn points
        if (npcCount > 0) {
            const npcSpawns = allSpawns.slice(game.players.size);
            enemyNPCs.forEach((npc, i) => {
                if (i < npcSpawns.length) {
                    npc.x = npcSpawns[i].x * GAME.TILE_SIZE + GAME.TILE_SIZE / 2;
                    npc.y = npcSpawns[i].y * GAME.TILE_SIZE + GAME.TILE_SIZE / 2;
                }
                npc.hp = ENEMY_CONST.HP;
                npc.state = 'patrol';
                npc.targetPlayerId = null;
                npc.patrolTarget = undefined;
                npc.losLostTime = undefined;
                npc.lastShotTime = 0;
                npc.rotation = 0;
                game.npcs.push(npc);
            });
        }

        game.currentRound = {
            roundNumber: game.currentRound.roundNumber + 1,
            phase: 'playing',
            alivePlayers: Array.from(game.players.keys()),
            startedAt: Date.now(),
        };

        game.phase = 'round-active';
    }
```

- [ ] **Step 6: Guard `saveMatchResults` against NPC winnerId**

In `endMatchWithResults`, the `winnerId` passed to `saveMatchResults` could be `''` (empty string). In `saveMatchResults`, the `parseInt(winnerId)` on an empty string returns `NaN`. Add a guard in `saveMatchResults` around the winner_id query (line 1146-1151):

```typescript
        // Insert match — use NULL winner_id if no human won
        const winnerIdNum = winnerId ? parseInt(winnerId) : null;
        const matchResult = await this.db.query(
            `INSERT INTO matches (lobby_code, winner_id, player_count, total_rounds, duration_seconds, settings)
             VALUES ($1, ${winnerIdNum ? '(SELECT id FROM players WHERE auth_user_id = $2)' : 'NULL'}, $3, $4, $5, $6)
             RETURNING id`,
            winnerIdNum
                ? [game.lobbyCode, winnerIdNum, game.players.size, game.currentRound.roundNumber, duration, JSON.stringify(game.settings)]
                : [game.lobbyCode, game.players.size, game.currentRound.roundNumber, duration, JSON.stringify(game.settings)]
        );
```

Note: The parameter indices shift when `winnerIdNum` is null. To keep it simpler, use a conditional approach:

```typescript
        const winnerIdInt = winnerId ? parseInt(winnerId) : null;
        let matchResult;
        if (winnerIdInt) {
            matchResult = await this.db.query(
                `INSERT INTO matches (lobby_code, winner_id, player_count, total_rounds, duration_seconds, settings)
                 VALUES ($1, (SELECT id FROM players WHERE auth_user_id = $2), $3, $4, $5, $6)
                 RETURNING id`,
                [game.lobbyCode, winnerIdInt, game.players.size, game.currentRound.roundNumber, duration, JSON.stringify(game.settings)]
            );
        } else {
            matchResult = await this.db.query(
                `INSERT INTO matches (lobby_code, winner_id, player_count, total_rounds, duration_seconds, settings)
                 VALUES ($1, NULL, $2, $3, $4, $5)
                 RETURNING id`,
                [game.lobbyCode, game.players.size, game.currentRound.roundNumber, duration, JSON.stringify(game.settings)]
            );
        }
```

- [ ] **Step 7: Update `onPlayerKilled` callback type to include weapon `'npc'` and name fields**

In `GameService.ts`, update the `onPlayerKilled` callback type (line 37):

```typescript
    private onPlayerKilled?: (matchId: string, data: { victimId: string; killerId: string; weapon: 'gun' | 'melee' | 'zone' | 'zombie' | 'npc'; killerName?: string; victimName?: string }) => void;
```

- [ ] **Step 8: Add NPC kill tracking in `updateProjectiles` player-hit section**

In the projectile-hits-player section of `updateProjectiles`, where `onPlayerKilled` is called, add NPC name resolution. Find the section where a player dies from a projectile (around line 460-480). After the existing kill event, add a check for NPC-owned projectiles:

Look for the pattern where `this.onPlayerKilled` is called after a projectile kill. Add the `killerName` field when the projectile owner is an NPC:

```typescript
// When emitting player-killed for projectile hits, resolve NPC names
const killerNPC = game.npcs.find(n => n.id === projectile.ownerId);
this.onPlayerKilled?.(game.matchId, {
    victimId: targetId,
    killerId: projectile.ownerId,
    weapon: killerNPC ? 'npc' : (isGrenade ? 'gun' : 'gun'),
    killerName: killerNPC?.label,
});
```

Similarly, in the NPC hit section of `updateProjectiles` (around line 494), add two fixes:

1. **Skip NPC owner** — prevent NPC projectiles from hitting the firing NPC or other enemy NPCs:

```typescript
for (const npc of game.npcs) {
    if (npc.id === projectile.ownerId) continue;  // Don't hit self
    // Also skip other enemy NPCs (NPCs ignore each other per spec)
    const ownerIsNPC = game.npcs.some(n => n.id === projectile.ownerId);
    if (ownerIsNPC && npc.type === 'enemy') continue;
    // ... existing distance check ...
```

2. **Credit kills and emit events when NPC dies** — after `npc.hp -= projectile.damage;`, add kill tracking:

```typescript
    if (npc.hp <= 0) {
        this.spawnNPCDrop(game, npc);

        this.onPlayerKilled?.(game.matchId, {
            victimId: npc.id,
            killerId: projectile.ownerId,
            weapon: 'gun',
            victimName: npc.label,
        });

        // Credit the kill to human attacker
        const attacker = game.players.get(projectile.ownerId);
        if (attacker) attacker.kills++;
    }
```

3. **Prevent double-processing**: Dead enemy NPCs must be removed immediately. After the NPC hit loop in `updateProjectiles`, filter them out:

```typescript
game.npcs = game.npcs.filter(n => n.hp > 0);
```

This prevents `updateEnemyNPCs` and `updateNPCs` from re-processing dead NPCs on the next tick.

- [ ] **Step 9: Run all backend tests**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run`
Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add arena/backend/src/services/GameService.ts arena/backend/src/services/GameService.features.test.ts
git commit -m "feat(arena): NPC round-end logic, round reset, and kill tracking"
```

---

## Chunk 4: Frontend

### Task 9: Update gameStore settings type

**Files:**
- Modify: `arena/frontend/src/stores/gameStore.ts:17-24` (settings type)

- [ ] **Step 1: Add `npcEnemies` to settings type and initial state**

In `arena/frontend/src/stores/gameStore.ts`, update the settings type (lines 17-24):

```typescript
    settings: {
        maxPlayers: 2 | 3 | 4;
        bestOf: 1 | 3 | 5;
        shrinkingZone: boolean;
        shrinkInterval: number;
        itemSpawns: boolean;
        itemSpawnInterval: number;
        npcEnemies: 0 | 1 | 2 | 3;
    };
```

And update the initial state (lines 71-78):

```typescript
    settings: {
        maxPlayers: 4,
        bestOf: 1,
        shrinkingZone: false,
        shrinkInterval: 30,
        itemSpawns: true,
        itemSpawnInterval: 60,
        npcEnemies: 0,
    },
```

- [ ] **Step 2: Commit**

```bash
git add arena/frontend/src/stores/gameStore.ts
git commit -m "feat(arena): add npcEnemies to frontend game store settings"
```

---

### Task 10: Lobby settings UI for NPC count

**Files:**
- Modify: `arena/frontend/src/components/Lobby.tsx`

- [ ] **Step 1: Add NPC enemies handler function**

In `arena/frontend/src/components/Lobby.tsx`, after `handleBestOf` (after line 126), add:

```typescript
    const handleNpcEnemies = (value: 0 | 1 | 2 | 3) => {
        if (!isHost || !code || !playerId) return;
        socket.emit('update-settings', {
            lobbyCode: code,
            hostId: parseInt(playerId),
            settings: { npcEnemies: value },
        });
    };
```

- [ ] **Step 2: Update `allReady` check for solo play**

Replace the `allReady` const (line 128):

```typescript
    const totalParticipants = players.length + (settings.npcEnemies || 0);
    const allReady = totalParticipants >= 2 && players.every((p) => p.isReady);
```

- [ ] **Step 3: Add NPC Enemies setting row in JSX**

After the "Item Spawns" setting row (after line 214), add:

```tsx
                    <div className="setting-row">
                        <span className="setting-label">NPC Enemies</span>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            {([0, 1, 2, 3] as const).map((n) => (
                                <button
                                    key={n}
                                    className={`btn ${settings.npcEnemies === n ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                                    onClick={() => handleNpcEnemies(n)}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
```

- [ ] **Step 4: Update "Waiting for player" text for optional slots**

Replace the "Waiting for player..." section (lines 170-174):

```tsx
                {players.length < settings.maxPlayers && (
                    <div className="player-item" style={{ opacity: 0.3, borderStyle: 'dashed' }}>
                        <span className="player-name">
                            Waiting for player...{settings.npcEnemies > 0 ? ' (optional)' : ''}
                        </span>
                    </div>
                )}
```

- [ ] **Step 5: Commit**

```bash
git add arena/frontend/src/components/Lobby.tsx
git commit -m "feat(arena): add NPC enemies lobby setting UI with solo play support"
```

---

### Task 11: Render enemy NPCs in Game.tsx

**Files:**
- Modify: `arena/frontend/src/components/Game.tsx`

- [ ] **Step 1: Add `renderEnemyNPCs` function**

In `Game.tsx`, after the `renderPlayers` function (around line 720), add:

```typescript
        function renderEnemyNPCs(npcContainer: Container, labelContainer: Container, state: any) {
            for (const npc of state.npcs || []) {
                if (npc.type !== 'enemy' || npc.hp <= 0) continue;

                if (useSprites) {
                    // Try zombie sprite with red tint
                    const frames = AssetService.getAnimation('zombie', 'idle', AssetService.angleToDirection(npc.rotation));
                    if (frames.length > 0) {
                        const sprite = frames.length > 1
                            ? new AnimatedSprite(frames)
                            : new Sprite(frames[0]);
                        sprite.anchor.set(0.5);
                        sprite.position.set(npc.x, npc.y);
                        sprite.width = 28;
                        sprite.height = 28;
                        sprite.tint = 0xFF4444;
                        if (sprite instanceof AnimatedSprite) {
                            sprite.animationSpeed = 0.05;
                            sprite.play();
                        }
                        npcContainer.addChild(sprite);

                        // Name and HP labels
                        renderNPCLabel(labelContainer, npc);
                        continue;
                    }
                }

                // Fallback: red circle with direction indicator
                const ng = new Graphics();
                // Body
                ng.beginFill(0xCC3333, 0.9);
                ng.drawCircle(npc.x, npc.y, 14);
                ng.endFill();
                // Direction indicator
                ng.lineStyle(3, 0xFFFFFF, 0.9);
                ng.moveTo(npc.x, npc.y);
                ng.lineTo(
                    npc.x + Math.cos(npc.rotation) * 18,
                    npc.y + Math.sin(npc.rotation) * 18
                );
                // Engage indicator (brighter ring when shooting)
                if (npc.state === 'engage') {
                    ng.lineStyle(2, 0xFF6666, 0.8);
                    ng.drawCircle(npc.x, npc.y, 17);
                }
                npcContainer.addChild(ng);

                renderNPCLabel(labelContainer, npc);
            }
        }

        function renderNPCLabel(container: Container, npc: any) {
            const label = new Text(npc.label || 'Bot', {
                fontFamily: 'monospace',
                fontSize: 10,
                fill: 0xFF4444,
                align: 'center',
            });
            label.anchor.set(0.5);
            label.position.set(npc.x, npc.y - 24);
            container.addChild(label);

            // HP pips
            const maxHp = 3;
            const pipStartX = npc.x - (maxHp * 6) / 2;
            for (let i = 0; i < maxHp; i++) {
                const pip = new Graphics();
                const color = i < npc.hp ? 0xFF4444 : 0x444444;
                pip.beginFill(color);
                pip.drawRect(pipStartX + i * 6, npc.y - 32, 4, 4);
                pip.endFill();
                container.addChild(pip);
            }
        }
```

- [ ] **Step 2: Call `renderEnemyNPCs` in the render loop**

Find the PixiJS ticker render loop in `Game.tsx` where `renderPlayers` is called. After the `renderPlayers` call, add:

```typescript
                renderEnemyNPCs(playerContainer, labelContainer, state);
```

Note: `Text` is already imported from PixiJS in `Game.tsx` (line 4). No import changes needed.

- [ ] **Step 3: Update kill feed to use `killerName`/`victimName`**

In the `player-killed` socket handler (around line 827-835), update:

```typescript
        socket.on('player-killed', (data: any) => {
            const state = gameStateRef.current;
            const killer = state?.players?.find((p: any) => p.id === data.killerId);
            const victim = state?.players?.find((p: any) => p.id === data.victimId);
            addKillfeed({
                killer: data.killerName || killer?.username || data.killerId,
                victim: data.victimName || victim?.username || data.victimId,
                weapon: data.weapon,
            });

            SoundService.playSFX('player_death');

            if (data.weapon === 'melee') {
                SoundService.playSFX('melee_hit');
            }
        });
```

- [ ] **Step 4: Run frontend typecheck**

Run: `cd /home/patrick/projects/arena/frontend && npx tsc --noEmit`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 5: Commit**

```bash
git add arena/frontend/src/components/Game.tsx
git commit -m "feat(arena): render enemy NPCs with red tint, labels, HP pips, and kill feed"
```

---

## Chunk 5: Integration Testing & Final Verification

### Task 12: Full integration test and typecheck

**Files:**
- All modified files

- [ ] **Step 1: Run backend typecheck**

Run: `cd /home/patrick/projects/arena/backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run all backend tests**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run`
Expected: All PASS

- [ ] **Step 3: Run frontend typecheck**

Run: `cd /home/patrick/projects/arena/frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run frontend build**

Run: `cd /home/patrick/projects/arena && npm run build:all`
Expected: PASS

- [ ] **Step 5: Fix any remaining test failures**

The `makeSettings` helpers were already updated in Task 1 Step 5. If any other tests fail, fix them here.

Run: `cd /home/patrick/projects/arena/backend && npx vitest run`
Expected: All PASS

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A arena/
git commit -m "fix(arena): integration fixes for NPC enemy system"
```
