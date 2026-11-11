import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ensureSchema, getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 60

// 2MB limit for the serialized project data (JSON string)
const MAX_DATA_BYTES = 2 * 1024 * 1024

const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'name must not be empty')
      .max(80, 'name must be at most 80 characters')
      .optional(),
    data: z
      .string()
      .max(MAX_DATA_BYTES, 'data must be at most 2MB')
      .optional(),
  })
  .refine((value) => value.name !== undefined || value.data !== undefined, {
    message: 'at least one of "name" or "data" must be provided',
  })

type RouteContext = { params: Promise<{ id: string }> }

const cloudUnavailable = () =>
  NextResponse.json(
    {
      error: 'Cloud save is unavailable on this deployment',
      hint: 'The app keeps working offline — projects save on the device.',
    },
    { status: 503 },
  )

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params
  const db = getDb()
  if (!db) return cloudUnavailable()

  try {
    await ensureSchema()
    const project = await db.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        data: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }
    return NextResponse.json({ project })
  } catch (error) {
    console.error('[api/projects/[id]] GET failed:', error)
    return cloudUnavailable()
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = updateProjectSchema.safeParse(body)
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

  const db = getDb()
  if (!db) return cloudUnavailable()

  try {
    await ensureSchema()
    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const project = await db.project.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ project })
  } catch (error) {
    console.error('[api/projects/[id]] PUT failed:', error)
    return cloudUnavailable()
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params
  const db = getDb()
  if (!db) return cloudUnavailable()

  try {
    await ensureSchema()
    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    await db.project.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[api/projects/[id]] DELETE failed:', error)
    return cloudUnavailable()
  }
}
