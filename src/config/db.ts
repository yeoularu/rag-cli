import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@libsql/client'
import { DB_PATH } from './index'

const dbDir = dirname(DB_PATH)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

export const db = createClient({
  url: `file:${DB_PATH}`,
})

export async function initDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding F32_BLOB(768),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create vector index if available (Turso/libSQL vector extension)
  try {
    await db.execute(
      `CREATE INDEX IF NOT EXISTS documents_embedding_vec_idx ON documents(libsql_vector_idx(embedding))`,
    )
  } catch (e) {
    console.info(
      `Vector search: brute-force (embedded libSQL, no VSS). DB: file:${DB_PATH}`,
    )
  }
}
