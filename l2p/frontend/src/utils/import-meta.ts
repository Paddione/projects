/** Known Vite env vars used across the frontend */
export interface ImportMetaEnvShape extends Record<string, string | boolean | undefined> {
  VITE_API_URL?: string;
  VITE_SOCKET_URL?: string;
  VITE_AUTH_SERVICE_URL?: string;
  VITE_TEST_MODE?: string;
}

export const importMetaEnv: ImportMetaEnvShape =
  typeof __IMPORT_META_ENV__ !== 'undefined' && __IMPORT_META_ENV__
    ? __IMPORT_META_ENV__
    : {};
