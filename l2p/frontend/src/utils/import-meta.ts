export type ImportMetaEnvShape = Record<string, string | boolean | undefined>;

export const importMetaEnv: ImportMetaEnvShape =
  typeof __IMPORT_META_ENV__ !== 'undefined' && __IMPORT_META_ENV__
    ? __IMPORT_META_ENV__
    : {};
