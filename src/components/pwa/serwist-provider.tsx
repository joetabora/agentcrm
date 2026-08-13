"use client"

import { SerwistProvider } from "@serwist/next/react"
import type { ReactNode } from "react"

export function AppSerwistProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === "development"}
      register
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  )
}
