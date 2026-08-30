/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DAV_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
