import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.appUrl),
  title: BRAND.name,
  description: BRAND.description,
  icons: {
    icon: BRAND.logoUrl,
    shortcut: BRAND.logoUrl,
    apple: BRAND.logoUrl,
  },
  openGraph: {
    title: BRAND.name,
    description: BRAND.tagline,
    images: [
      {
        url: BRAND.logoUrl,
        width: 1200,
        height: 1200,
        alt: `${BRAND.name} logo`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.name,
    description: BRAND.tagline,
    images: [BRAND.logoUrl],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />
        <link rel="icon" href={BRAND.logoUrl} />
        <link rel="apple-touch-icon" href={BRAND.logoUrl} />
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-1TJL05MNMG" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1TJL05MNMG');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  )
}
