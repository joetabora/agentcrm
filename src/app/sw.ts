import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { NetworkFirst, Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) =>
        request.mode === "navigate" && url.pathname.startsWith("/app"),
      handler: new NetworkFirst({
        cacheName: "app-pages",
        networkTimeoutSeconds: 3,
        plugins: [],
      }),
    },
    ...defaultCache,
  ],
})

serwist.addEventListeners()
