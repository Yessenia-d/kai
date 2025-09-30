import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

function ensureEnv() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('Supabase not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE)')
  return { url, key }
}

export async function GET() {
  try {
    try {
      const { url, key } = ensureEnv()
    const res = await fetch(`${url}/rest/v1/chats?select=*&order=created_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
    const data = await res.json()
    return NextResponse.json({ chats: data })
    } catch {
      // Mock list when Supabase is not configured
      return NextResponse.json({ chats: [
        { id: 'mock-1', title: 'Practice ordering coffee', created_at: new Date().toISOString() },
        { id: 'mock-2', title: 'Job interview tips', created_at: new Date().toISOString() }
      ] })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, id, title } = await req.json()
    try {
      const { url, key } = ensureEnv()
    if (action === 'create') {
      const res = await fetch(`${url}/rest/v1/chats`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify([{ title: title || 'New Chat' }]),
      })
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      const data = await res.json()
      return NextResponse.json({ chat: data[0] })
    }
    if (action === 'delete') {
      const res = await fetch(`${url}/rest/v1/chats?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    } catch {
      if (action === 'create') return NextResponse.json({ chat: { id: 'mock-' + Date.now(), title: title || 'New Chat', created_at: new Date().toISOString() } })
      if (action === 'delete') return NextResponse.json({ ok: true })
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
