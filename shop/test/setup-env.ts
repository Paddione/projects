import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const projectRoot = path.resolve(__dirname, '..');

const envVarPriority = [
    ['PAYMENT_DATABASE_URL_PROD', 'DATABASE_URL_PROD'],
    ['PAYMENT_DATABASE_URL_DEV', 'DATABASE_URL_DEV'],
    ['PAYMENT_DATABASE_URL_TEST', 'DATABASE_URL_TEST'],
];

const envFilePriority = ['.env-prod', '.env-dev', '.env-test'];

const pickFirstEnvValue = (keys: string[]): string | undefined => {
    for (const key of keys) {
        const value = process.env[key];
        if (value) return value;
    }
    return undefined;
};

const readDatabaseUrlFromFile = (filePath: string): string | undefined => {
    if (!fs.existsSync(filePath)) return undefined;
    const parsed = dotenv.parse(fs.readFileSync(filePath));
    return parsed.DATABASE_URL || parsed.PAYMENT_DATABASE_URL;
};

const deriveTestDatabaseUrl = (): string => {
    const fallback = 'postgresql://payment_user:payment_password@localhost:5432/payment_test?schema=public';
    const examplePath = path.join(projectRoot, '.env.example');

    if (!fs.existsSync(examplePath)) return fallback;

    const parsed = dotenv.parse(fs.readFileSync(examplePath));
    const baseUrl = parsed.DATABASE_URL || parsed.PAYMENT_DATABASE_URL;
    if (!baseUrl) return fallback;

    if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
        return fallback;
    }

    return baseUrl.replace(/\/([^/?]+)(\?|$)/, '/payment_test$2');
};

const resolveDatabaseUrl = (): string | undefined => {
    for (const keys of envVarPriority) {
        const value = pickFirstEnvValue(keys);
        if (value) return value;
    }

    for (const fileName of envFilePriority) {
        const value = readDatabaseUrlFromFile(path.join(projectRoot, fileName));
        if (value) return value;
    }

    return undefined;
};

const isRunningInDocker = (): boolean => {
    if (process.env.DOCKER_CONTAINER || process.env.RUNNING_IN_DOCKER) return true;
    if (fs.existsSync('/.dockerenv')) return true;
    try {
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
        return cgroup.includes('docker') || cgroup.includes('containerd');
    } catch {
        return false;
    }
};

const normalizeDatabaseUrl = (url: string): string => {
    if (isRunningInDocker()) return url;
    return url.replace('@shared-postgres:', '@localhost:');
};

if (!process.env.DATABASE_URL) {
    const resolved = resolveDatabaseUrl() || deriveTestDatabaseUrl();
    process.env.DATABASE_URL = normalizeDatabaseUrl(resolved);
}
