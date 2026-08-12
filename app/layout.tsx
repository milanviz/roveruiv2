import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"
import { LanguageProvider } from "@/lib/language-context"
import AuthProvider from "@/components/auth-provider"
import RootLayoutClient from "./root-layout-client"
// import "react-pdf/dist/Page/TextLayer.css";
// import "react-pdf/dist/Page/AnnotationLayer.css";

// Load Inter font
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Rover",
  description: "Modern research assistant powered by AI.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body
        className="font-sans antialiased dark bg-transparent"
        style={
          {
            "--bg-image-url": `url('${process.env.NEXT_PUBLIC_ASSET_PREFIX || ""}/assets/images/bg.png')`,
          } as React.CSSProperties
        }
      >
        <LanguageProvider>
          <AuthProvider>
            <RootLayoutClient>{children}</RootLayoutClient>
          </AuthProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
