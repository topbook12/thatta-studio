import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 60

// 2MB limit for the serialized project data (JSON string)
const MAX_DATA_BYTES = 2 * 1024 * 1024

const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(80, 'name must be at most 80 characters'),
  data: z
    .string()
    .max(MAX_DATA_BYTES, 'data must be at most 2MB'),
})

export async function GET() {
  try {
    const projects = await db.project.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('[api/projects] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 }
    )
  }
}

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

  const parsed = createProjectSchema.safeParse(body)
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

  const { name, data } = parsed.data

  try {
    const project = await db.project.create({
      data: { name, data },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('[api/projects] POST failed:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
