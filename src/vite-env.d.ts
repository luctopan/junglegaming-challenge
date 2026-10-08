/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client timeout of API calls in ms (default 8000). */
  readonly VITE_API_TIMEOUT_MS?: string;
}
