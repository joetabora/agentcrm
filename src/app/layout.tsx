import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AppSerwistProvider } from "@/components/pwa/serwist-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  applicationName: "Joe Real Estate OS",
  title: {
    default: "Joe Real Estate OS",
    template: "%s · Joe RE OS",
  },
  description: "Real estate CRM and operating system for agents and teams",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Joe RE OS",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2229" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider>
          <TooltipProvider>
            <AppSerwistProvider>
              {children}
              <Toaster />
            </AppSerwistProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
