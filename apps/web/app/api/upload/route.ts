import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

function ensureEnv() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'kai-files'
  if (!url || !key) throw new Error('Supabase not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE)')
  return { url, key, bucket }
}

export async function POST(req: NextRequest) {
  try {
    const { url, key, bucket } = ensureEnv()
    const form = await req.formData()
    const chatId = String(form.get('chatId') || 'default')
    const entries = form.getAll('file')
    if (!entries.length) return NextResponse.json({ files: [] })

    const results: any[] = []
    for (const entry of entries) {
      if (typeof entry === 'string') continue
      const file = entry as File
      const stamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')
      const path = `chats/${chatId}/${stamp}-${safeName}`
      const upload = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: await file.arrayBuffer(),
      })
      if (!upload.ok) {
        const t = await upload.text()
        return NextResponse.json({ error: t }, { status: 500 })
      }
      const publicUrl = `${url}/storage/v1/object/public/${bucket}/${path}`
      results.push({ name: file.name, url: publicUrl, size: file.size, type: file.type })
    }

    return NextResponse.json({ files: results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upload error' }, { status: 500 })
  }
}

