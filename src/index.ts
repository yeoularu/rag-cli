import { ensureApiKey } from './key'
import { initDatabase, DB_PATH } from './db'
import { runChat } from './ai/chat'
import { intro, outro, spinner, note } from '@clack/prompts'

export async function main() {
  intro('RAG CLI')

  const s = spinner()
  s.start('Initializing database...')
  await initDatabase()
  s.stop('Database ready')

  note(`DB path:\n${DB_PATH}`, 'Database')

  s.start('Initializing API key...')
  await ensureApiKey()
  s.stop('API key initialized')

  await runChat()
  outro('Goodbye 👋')
}

main().catch(console.error)
