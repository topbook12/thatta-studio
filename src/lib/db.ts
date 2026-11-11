import { PrismaClient } from '@prisma/client'

// ============================================================
// Sprint 7 — resilient Prisma singleton for serverless deploys.
//
// The studio is offline-first (localStorage + IndexedDB), so a missing
// or broken database must never take the app down. getDb() returns
// null when Prisma cannot start (e.g. missing DATABASE_URL on a fresh
// Vercel deploy) and API routes degrade gracefully to 503 responses.
// ============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaBroken: boolean
}

export function getDb(): PrismaClient | null {
  if (globalForPrisma.prismaBroken) return null
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  try {
    const client = new PrismaClient({
      log: ['error'],
    })
    globalForPrisma.prisma = client
    return client
  } catch (error) {
    console.error('[db] Prisma client unavailable:', error)
    globalForPrisma.prismaBroken = true
    return null
  }
}

/**
 * Ensure the Project table exists. On ephemeral serverless filesystems
 * (Vercel + SQLite in /tmp) each cold instance may start with an empty
 * database — this cheap bootstrap makes cloud save work out of the box.
 */
let ensured: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const db = getDb()
      if (!db) return
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "Project" (
           "id" TEXT NOT NULL PRIMARY KEY,
           "name" TEXT NOT NULL,
           "data" TEXT NOT NULL,
           "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
           "updatedAt" DATETIME NOT NULL
         )`,
      )
    })().catch((error) => {
      console.error('[db] schema bootstrap failed:', error)
      // retry on the next request
      ensured = null
    })
  }
  return ensured
}
