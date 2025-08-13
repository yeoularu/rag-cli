import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { createClient } from '@libsql/client'
function getCliArgValue(flag: string): string | undefined {
  const argv = process.argv.slice(2)
  const eq = argv.find((a) => a.startsWith(`${flag}=`))
  if (eq) {
    const value = eq.split('=')[1]
    return value && value.length > 0 ? value : undefined
  }
  const idx = argv.indexOf(flag)
  if (idx !== -1) {
    const next = argv[idx + 1]
    if (typeof next === 'string' && !next.startsWith('-')) {
      return next
    }
  }
  return undefined
}

// Resolve DB path with precedence: env > CLI --db > default (~/.rag-cli/rag.db)
const cliDbPath = getCliArgValue('--db')
const envDbDir = process.env.RAG_DB_DIR
const defaultDbDir = envDbDir || join(homedir(), '.rag-cli')
const defaultDbPath = join(defaultDbDir, 'libsql.db')
export const DB_PATH = process.env.RAG_DB_PATH || cliDbPath || defaultDbPath

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
