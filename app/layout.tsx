import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter'
import './globals.css'

export const metadata: Metadata = { title: 'Franneshot', description: 'Franneshot: place a screenshot in a device frame on a styled backdrop and download it as a PNG.' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('franneshot-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}" }} /></head>
      <body>{children}</body>
    </html>
  )
}
