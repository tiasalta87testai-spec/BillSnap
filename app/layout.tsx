import './globals.css';
import React from 'react';
import type { Metadata, Viewport } from 'next';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'BillSnap - Scontrini Digitali AI',
  description: 'Acquisisci e organizza scontrini e ricevute fiscali con l\'Intelligenza Artificiale di Gemini',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BillSnap',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1326' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <main style={{ maxWidth: '600px', margin: '0 auto', padding: '16px 20px 24px' }}>
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
