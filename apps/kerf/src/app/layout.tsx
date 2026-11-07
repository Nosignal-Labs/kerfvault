import type { Metadata } from "next";
import Link from "next/link";
import { WalletProvider } from "../lib/WalletContext";
import { TestnetBanner } from "../components/TestnetBanner";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kerfvault Shopper [Testnet]",
  description: "Offline-first payment voucher wallet on Stellar Testnet",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased flex flex-col">
        <TestnetBanner />
        <ServiceWorkerRegister />
        <WalletProvider>
          <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-sky-400">Kerfvault Shopper</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30">
                TESTNET
              </span>
            </div>
            <nav className="flex space-x-4 text-sm text-zinc-400">
              <Link href="/" className="hover:text-zinc-200">
                Books
              </Link>
              <Link href="/pay" className="hover:text-zinc-200">
                Pay
              </Link>
              <Link href="/how-it-works" className="hover:text-zinc-200">
                How it works
              </Link>
              <Link href="/settings" className="hover:text-zinc-200">
                Settings
              </Link>
            </nav>
          </header>
          <main className="max-w-2xl mx-auto p-6 w-full flex-1">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
