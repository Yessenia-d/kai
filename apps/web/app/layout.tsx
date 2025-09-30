import './globals.css'
import type { Metadata } from 'next'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export const metadata: Metadata = {
  title: 'Kai — Language Coach',
  description: 'Immersive, comprehensible input, i+1 conversational coach.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container py-4">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Kai · Language Coach (Beta)</h1>
              <p className="text-gray-600 text-sm">Comprehensible input, gentle corrections, contextual vocab.</p>
            </div>
            <ThemeToggle />
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
