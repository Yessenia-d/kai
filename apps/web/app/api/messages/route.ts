import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

function ensureEnv() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('Supabase not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE)')
  return { url, key }
}

export async function POST(req: NextRequest) {
  try {
    const { chat_id, role, content, meta } = await req.json()
    try {
      const { url, key } = ensureEnv()
      const res = await fetch(`${url}/rest/v1/messages`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify([{ chat_id, role, content, meta }]),
      })
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      const data = await res.json()
      return NextResponse.json({ message: data[0] })
    } catch {
      return NextResponse.json({ message: { id: 'mock-' + Date.now(), chat_id, role, content, meta, created_at: new Date().toISOString() } })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const chat_id = searchParams.get('chat_id')
    const direction = (searchParams.get('order') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
    if (!chat_id) return NextResponse.json({ error: 'chat_id required' }, { status: 400 })
    try {
      const { url, key } = ensureEnv()
      // Prefer server ordering; add id as a tie-breaker to stabilize results
      const orderParam = `order=created_at.${direction},id.${direction}`
      const endpoint = `${url}/rest/v1/messages?chat_id=eq.${encodeURIComponent(chat_id)}&select=*&${orderParam}`
      const res = await fetch(endpoint, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      const data = await res.json()
      // Extra safety: sort again on the edge in case upstream ignores order
      const sorted = Array.isArray(data) ? data.slice().sort((a: any, b: any) => {
        const ta = new Date(a?.created_at || 0).getTime()
        const tb = new Date(b?.created_at || 0).getTime()
        if (ta !== tb) return direction === 'asc' ? ta - tb : tb - ta
        const ia = String(a?.id || '')
        const ib = String(b?.id || '')
        return direction === 'asc' ? ia.localeCompare(ib) : ib.localeCompare(ia)
      }) : data
      return NextResponse.json({ messages: sorted })
    } catch {
      return NextResponse.json({ messages: [
        { id: 'm1', chat_id, role: 'user', content: 'Hi Kai, I want to practice ordering coffee.', created_at: new Date().toISOString() },
        { id: 'm2', chat_id, role: 'assistant', content: 'Sure! Let’s practice. Start with: "Could I have a cappuccino, please?"', created_at: new Date().toISOString(), meta: { vocab: [{ word: 'cappuccino', meaning: 'a coffee drink', why: 'ordering context' }] } },
      ] })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
