/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  /** Release version without the "v", e.g. "1.2.0"; unset in local dev. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Runtime override for the backend URL, set via an inline script before the app bundle loads. */
  API_BASE?: string;
}
