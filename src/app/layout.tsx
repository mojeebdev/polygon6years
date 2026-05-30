import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Polygon 6th Birthday — When Did You Go On-Chain?',
  description: 'Polygon just turned 6! Find out when you first transacted on Polygon mainnet and share your on-chain anniversary card. #Polygon6',
  keywords: ['Polygon', 'MATIC', 'POL', 'Web3', 'blockchain', 'anniversary', 'on-chain'],
  authors: [{ name: 'mojeebeth', url: 'https://x.com/mojeebeth' }],
  openGraph: {
    title: 'Polygon 6th Birthday — When Did You Go On-Chain?',
    description: 'Discover your first Polygon transaction date and share your on-chain anniversary card.',
    type: 'website',
    siteName: 'Polygon 6 Years',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polygon 6th Birthday — When Did You Go On-Chain?',
    description: 'Discover your first Polygon transaction date and share your on-chain anniversary card.',
    creator: '@mojeebeth',
  },
  icons: {
    icon: '/polygon.jpg',
    apple: '/polygon.jpg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
