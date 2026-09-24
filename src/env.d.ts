/// <reference types="astro/client" />

declare global {
  interface ImportMetaEnv {
    /** CloudFront URL of the analytics API (infra/ stack output). Tracking is off when unset. */
    readonly PUBLIC_ANALYTICS_URL?: string;
  }
}

export {};
