"use client"

import { useEffect } from "react"
import { drainOutbox } from "@/lib/offline/hooks"

/** Mount once in the app shell so outbox drain is not duplicated. */
export function OfflineSyncBootstrap() {
  useEffect(() => {
    const run = () => {
      void drainOutbox()
    }
    window.addEventListener("online", run)
    const onVisibility = () => {
      if (document.visibilityState === "visible") run()
    }
    document.addEventListener("visibilitychange", onVisibility)
    run()
    const interval = window.setInterval(run, 30_000)
    return () => {
      window.removeEventListener("online", run)
      document.removeEventListener("visibilitychange", onVisibility)
      window.clearInterval(interval)
    }
  }, [])

  return null
}
