"use client";
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('kai_theme', theme)
  }, [theme])
  useEffect(() => {
    const saved = localStorage.getItem('kai_theme') as 'light' | 'dark' | null
    if (saved) setTheme(saved)
  }, [])
  return (
    <Button variant="secondary" size="sm" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
    </Button>
  )
}

