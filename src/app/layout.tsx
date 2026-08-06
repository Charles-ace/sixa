import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sixa — AI Yield Optimization Agent",
  description: "Autonomous AI agent that maximizes returns on your crypto assets using natural language. Analyze, optimize, and execute DeFi strategies with institutional-grade risk management.",
  icons: {
    icon: [
      { url: "/favicon-16x16.svg", sizes: "16x16", type: "image/svg+xml" },
      { url: "/favicon-32x32.svg", sizes: "32x32", type: "image/svg+xml" },
    ],
    shortcut: "/favicon-32x32.svg",
    apple: "/apple-touch-icon.svg",
  },
  metadataBase: new URL("https://sixa.xyz"),
  openGraph: {
    title: "Sixa — AI Yield Optimization Agent",
    description: "Autonomous AI agent that maximizes returns on your crypto assets using natural language.",
    type: "website",
    locale: "en_US",
    siteName: "Sixa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sixa — AI Yield Optimization Agent",
    description: "Autonomous AI agent that maximizes returns on your crypto assets using natural language.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F6F3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}