const L2P_SERVICE_URL = process.env.L2P_SERVICE_URL || 'http://localhost:3001';

export async function l2pFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${L2P_SERVICE_URL}${path}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    return fetch(url, { ...options, headers });
}

/**
 * Fetch random questions from given L2P question set IDs.
 * POST /api/questions/random with body { questionSetIds, count }
 * Returns array of question objects.
 */
export async function fetchCampaignQuestions(setIds: number[], count: number): Promise<any[]> {
    try {
        const res = await l2pFetch('/api/questions/random', {
            method: 'POST',
            body: JSON.stringify({ questionSetIds: setIds, count }),
        });
        if (!res.ok) {
            console.error(`L2P questions fetch failed: ${res.status} ${res.statusText}`);
            return [];
        }
        const data = await res.json();
        return Array.isArray(data) ? data : (data.questions || []);
    } catch (error) {
        console.error('Failed to fetch campaign questions from L2P:', error);
        return [];
    }
}
