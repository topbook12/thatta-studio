import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

const VOICES = [
  'tongtong',
  'chuichui',
  'xiaochen',
  'jam',
  'kazi',
  'douji',
  'luodo',
] as const

const ttsRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'text is required')
    .max(1000, 'text must be at most 1000 characters'),
  voice: z.enum(VOICES).optional().default('tongtong'),
  speed: z
    .number()
    .min(0.5, 'speed must be between 0.5 and 2.0')
    .max(2.0, 'speed must be between 0.5 and 2.0')
    .optional()
    .default(1.0),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = ttsRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 }
    )
  }

  const { text, voice, speed } = parsed.data

  try {
    const zai = await ZAI.create()
    const response = await zai.audio.tts.create({
      input: text.trim(),
      voice,
      speed,
      response_format: 'wav',
      stream: false,
    })

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'TTS returned empty audio' },
        { status: 500 }
      )
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/tts] TTS generation failed:', error)
    const message =
      error instanceof Error ? error.message : 'Unknown TTS error'
    return NextResponse.json(
      { error: 'TTS generation failed', message },
      { status: 500 }
    )
  }
}
