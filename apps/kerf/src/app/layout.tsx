import type { Metadata } from "next";
import Link from "next/link";
import { WalletProvider } from "../lib/WalletContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kerfvault Shopper",
  description: "Offline-first payment voucher wallet on Stellar/Soroban",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <WalletProvider>
          <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
            <div className="font-bold text-lg text-sky-400">Kerfvault Shopper</div>
            <nav className="flex space-x-4 text-sm text-zinc-400">
              <Link href="/" className="hover:text-zinc-200">
                Books
              </Link>
              <Link href="/pay" className="hover:text-zinc-200">
                Pay
              </Link>
              <Link href="/settings" className="hover:text-zinc-200">
                Settings
              </Link>
            </nav>
          </header>
          <main className="max-w-2xl mx-auto p-6">{children}</main>
        </WalletProvider>
        {/* Service Worker registration script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  // TODO: Register real service worker file (sw.js) for offline caching and asset fallback
                  // navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
