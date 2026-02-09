import { ensureProductSeed } from './seed'

async function globalSetup() {
    await ensureProductSeed()
}

export default globalSetup
