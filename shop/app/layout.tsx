import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./cybervault-shop.css";
import Header from '@/components/header'
import KeyboardNavigation from '@/components/KeyboardNavigation'
import HelpScreen from '@/components/HelpScreen'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoldCoins Shop",
  description: "Secure digital currency for exclusive goods and services",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased shop-app`}
      >
        <KeyboardNavigation />
        <Header />
        <main>
          {children}
        </main>
        <HelpScreen />
      </body>
    </html>
  );
}
