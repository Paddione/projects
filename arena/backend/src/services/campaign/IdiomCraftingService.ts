import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseService } from '../DatabaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface IdiomRecipe {
    id: string;
    idiom: string;
    meaning: string;
    fragments: string[];
    result: {
        name: string;
        description: string;
        type: 'consumable' | 'persistent';
        effect: string;
        effectValue: number;
        durationMinutes: number | null;
    };
}

export interface PlayerFragment {
    fragment: string;
    quantity: number;
}

export class IdiomCraftingService {
    private db: DatabaseService;
    private recipes: Map<string, IdiomRecipe> = new Map();
    private fragmentDropPools: Record<string, string[]> = {};

    constructor() {
        this.db = DatabaseService.getInstance();
        this.loadRecipes();
    }

    private loadRecipes(): void {
        const path = join(__dirname, '../../data/campaign/idiom-recipes.json');
        const data = JSON.parse(readFileSync(path, 'utf-8'));
        for (const [id, recipe] of Object.entries(data.recipes)) {
            this.recipes.set(id, recipe as IdiomRecipe);
        }
        this.fragmentDropPools = data.fragmentDropPools;
        console.log(`[IdiomCraftingService] Loaded ${this.recipes.size} recipes`);
    }

    /** Get player's fragment inventory */
    async getFragments(playerId: number): Promise<PlayerFragment[]> {
        const result = await this.db.query(
            'SELECT fragment, quantity FROM campaign_idiom_fragments WHERE player_id = $1 ORDER BY fragment',
            [playerId]
        );
        return result.rows;
    }

    /** Add a fragment to player's inventory */
    async addFragment(playerId: number, fragment: string): Promise<void> {
        await this.db.query(
            `INSERT INTO campaign_idiom_fragments (player_id, fragment, quantity)
             VALUES ($1, $2, 1)
             ON CONFLICT (player_id, fragment)
             DO UPDATE SET quantity = campaign_idiom_fragments.quantity + 1`,
            [playerId, fragment.toUpperCase()]
        );
    }

    /** Get random fragment from a drop pool */
    getRandomFragment(poolName: string): string | null {
        const pool = this.fragmentDropPools[poolName];
        if (!pool || pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    /** Get craftable recipes (player has all required fragments) */
    async getCraftableRecipes(playerId: number): Promise<IdiomRecipe[]> {
        const fragments = await this.getFragments(playerId);
        const fragmentMap = new Map(fragments.map(f => [f.fragment, f.quantity]));

        const craftable: IdiomRecipe[] = [];
        for (const recipe of this.recipes.values()) {
            // Check if already crafted (persistent items can only be crafted once)
            const alreadyCrafted = await this.db.query(
                'SELECT 1 FROM campaign_crafted_idioms WHERE player_id = $1 AND idiom_id = $2 AND consumed_at IS NULL',
                [playerId, recipe.id]
            );
            if (alreadyCrafted.rowCount && alreadyCrafted.rowCount > 0 && recipe.result.type === 'persistent') continue;

            // Check fragments
            const hasAll = recipe.fragments.every(f => (fragmentMap.get(f) ?? 0) >= 1);
            if (hasAll) craftable.push(recipe);
        }

        return craftable;
    }

    /** Craft an idiom from fragments */
    async craft(playerId: number, idiomId: string): Promise<{ success: boolean; error?: string; item?: IdiomRecipe['result'] }> {
        const recipe = this.recipes.get(idiomId);
        if (!recipe) return { success: false, error: 'Unknown recipe' };

        // Check fragments
        const fragments = await this.getFragments(playerId);
        const fragmentMap = new Map(fragments.map(f => [f.fragment, f.quantity]));

        for (const needed of recipe.fragments) {
            if ((fragmentMap.get(needed) ?? 0) < 1) {
                return { success: false, error: `Missing fragment: ${needed}` };
            }
        }

        // Consume fragments
        for (const needed of recipe.fragments) {
            await this.db.query(
                `UPDATE campaign_idiom_fragments SET quantity = quantity - 1
                 WHERE player_id = $1 AND fragment = $2 AND quantity > 0`,
                [playerId, needed]
            );
        }

        // Clean up zero-quantity entries
        await this.db.query(
            'DELETE FROM campaign_idiom_fragments WHERE player_id = $1 AND quantity <= 0',
            [playerId]
        );

        // Record crafted item
        await this.db.query(
            `INSERT INTO campaign_crafted_idioms (player_id, idiom_id)
             VALUES ($1, $2)
             ON CONFLICT (player_id, idiom_id) DO UPDATE SET crafted_at = NOW(), consumed_at = NULL`,
            [playerId, idiomId]
        );

        return { success: true, item: recipe.result };
    }

    /** Use a consumable crafted idiom */
    async useItem(playerId: number, idiomId: string): Promise<{ success: boolean; effect?: string; effectValue?: number }> {
        const recipe = this.recipes.get(idiomId);
        if (!recipe || recipe.result.type !== 'consumable') return { success: false };

        const result = await this.db.query(
            `UPDATE campaign_crafted_idioms SET consumed_at = NOW()
             WHERE player_id = $1 AND idiom_id = $2 AND consumed_at IS NULL
             RETURNING id`,
            [playerId, idiomId]
        );

        if (!result.rowCount || result.rowCount === 0) return { success: false };

        return { success: true, effect: recipe.result.effect, effectValue: recipe.result.effectValue };
    }

    /** Get all recipes (for UI display) */
    getAllRecipes(): IdiomRecipe[] {
        return Array.from(this.recipes.values());
    }

    /** Get a single recipe by ID */
    getRecipe(idiomId: string): IdiomRecipe | undefined {
        return this.recipes.get(idiomId);
    }

    /** Get player's crafted items (active persistent + unused consumables) */
    async getCraftedItems(playerId: number): Promise<Array<{ idiomId: string; type: string; craftedAt: string }>> {
        const result = await this.db.query(
            `SELECT idiom_id, crafted_at FROM campaign_crafted_idioms
             WHERE player_id = $1 AND consumed_at IS NULL
             ORDER BY crafted_at DESC`,
            [playerId]
        );
        return result.rows.map((r: any) => ({
            idiomId: r.idiom_id,
            type: this.recipes.get(r.idiom_id)?.result.type ?? 'unknown',
            craftedAt: r.crafted_at,
        }));
    }
}
