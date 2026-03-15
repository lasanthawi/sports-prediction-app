import type { Metadata } from 'next'
import './globals.css'

const BRAND_IMAGE = 'https://i.ibb.co/qLsG4ByG/70325951-97a2-4fb3-ad27-a3c7ba251676.png'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Prediction Arena',
  description: 'Cinematic sports prediction arena with live voting, match cards, and AI-powered battle artwork.',
  icons: {
    icon: BRAND_IMAGE,
    shortcut: BRAND_IMAGE,
    apple: BRAND_IMAGE,
  },
  openGraph: {
    title: 'Prediction Arena',
    description: 'Predict. Vote. Win Glory.',
    images: [
      {
        url: BRAND_IMAGE,
        width: 1200,
        height: 1200,
        alt: 'Prediction Arena logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prediction Arena',
    description: 'Predict. Vote. Win Glory.',
    images: [BRAND_IMAGE],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />
        <link rel="icon" href={BRAND_IMAGE} />
        <link rel="apple-touch-icon" href={BRAND_IMAGE} />
      </head>
      <body>{children}</body>
    </html>
  )
}
