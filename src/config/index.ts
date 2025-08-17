import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ensureApiKey } from './key'

const argv = yargs(hideBin(process.argv))
  .option('db', {
    type: 'string',
    description: 'Database path',
    alias: 'd',
  })
  .option('reset-config', {
    type: 'boolean',
    description: 'Reset the API key',
    alias: 'r',
  })
  .help()
  .alias('help', 'h').argv

const cliDbPath = argv.db
const envDbDir = process.env.RAG_DB_DIR
const defaultDbDir = envDbDir || join(homedir(), '.rag-cli')
const defaultDbPath = join(defaultDbDir, 'libsql.db')
export const DB_PATH = process.env.RAG_DB_PATH || cliDbPath || defaultDbPath

export async function initConfig() {
  await ensureApiKey(argv['reset-config'])
}
