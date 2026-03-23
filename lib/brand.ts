export const BRAND = {
  name: 'Vote League',
  shortName: 'Vote League',
  tagline: 'Predict. Vote. Track the league pulse.',
  description:
    'Vote League is a cinematic fan-voting platform for live and upcoming sports matchups, community predictions, and premium match visuals.',
  logoUrl: 'https://i.ibb.co/7tvVtQ3p/75-BD34-CD-F577-4-DEA-BDD3-ADEFE80-E3762.png',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.voteleague.org',
  supportEmail: 'support@voteleague.org',
} as const

export const LEGAL_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/guide', label: 'Guide' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/community-guidelines', label: 'Community Guidelines' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/contact', label: 'Contact' },
] as const
