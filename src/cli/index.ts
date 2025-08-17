import { initConfig, DB_PATH } from '../config'
import { initDatabase } from '../config/db'
import { runChat } from '../ai/chat'
import { intro, outro, spinner, note } from '@clack/prompts'

export async function main() {
  intro('RAG CLI')

  const s = spinner()
  s.start('Initializing...')
  await initConfig()
  await initDatabase()
  s.stop('Initialization complete')

  note(`DB path:\n${DB_PATH}`, 'Database')

  await runChat()
  outro('Goodbye 👋')
}

main().catch(console.error)
