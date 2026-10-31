import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kerfvault Merchant Reader",
  description: "Offline-first payment voucher verification and redemption terminal",
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
        <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-lg text-emerald-400">Kerfvault Reader</div>
          <nav className="flex space-x-4 text-sm text-zinc-400">
            <Link href="/" className="hover:text-zinc-200">Terminal</Link>
            <Link href="/scan" className="hover:text-zinc-200">Scan</Link>
            <Link href="/accepted" className="hover:text-zinc-200">Vouchers</Link>
            <Link href="/settings" className="hover:text-zinc-200">Settings</Link>
          </nav>
        </header>
        <main className="max-w-2xl mx-auto p-6">{children}</main>
        {/* Service Worker registration script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  // TODO: Register service worker (sw.js) for offline merchant operation
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
