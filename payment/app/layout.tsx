import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./cybervault-payment.css";
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
  title: "PatrickCoin - Digital Currency Platform",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased payment-app`}
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
