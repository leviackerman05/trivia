/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Backend base URL (Express + Socket.io). Defaults to localhost:3000. */
  readonly PUBLIC_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
