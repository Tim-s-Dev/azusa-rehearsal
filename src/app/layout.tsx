import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import { PlayerProvider } from "@/components/PlayerProvider";
import { MetronomeProvider } from "@/components/MetronomeProvider";
import MiniPlayer from "@/components/MiniPlayer";
import { KeypadProvider } from "@/components/KeypadProvider";
import ChartKeypad from "@/components/ChartKeypad";
import Link from "next/link";
import { Music } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rehearsal Studio",
  description: "Modern music rehearsal app",
};

// Lock the viewport: no pinch-zoom, no horizontal scroll, app-like feel
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme') || 'dark';
                document.documentElement.classList.toggle('dark', t === 'dark');
                document.documentElement.classList.toggle('light', t === 'light');
              } catch(e) {}
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(function(){});
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col pb-32">
        <PlayerProvider>
          <MetronomeProvider>
            <KeypadProvider>
              <div className="max-w-5xl mx-auto px-4 py-6 w-full flex-1">
                <nav className="flex items-center justify-between mb-8">
                  <Link href="/" className="flex items-center gap-2 group">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 group-hover:scale-110 transition-transform">
                      <Music size={16} className="text-white" />
                    </div>
                    <span className="font-bold text-lg">Rehearsal</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/songs"
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
                    >
                      Songs
                    </Link>
                    <ThemeToggle />
                  </div>
                </nav>
                {children}
              </div>
              <ChartKeypad />
              <MiniPlayer />
            </KeypadProvider>
          </MetronomeProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
