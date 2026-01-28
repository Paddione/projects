import { cleanupSeedProducts } from './seed'

async function globalTeardown() {
    await cleanupSeedProducts()
}

export default globalTeardown
