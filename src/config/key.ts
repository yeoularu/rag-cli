import { confirm, isCancel, select, text, outro, spinner } from '@clack/prompts'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { getEmbedding } from '../services/embeddings'

// Types
type KeySource = 'google' | 'gemini' | 'manual'

// Config helpers (store only preferences, not secrets)
const CONFIG_DIR = join(homedir(), '.rag-cli')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

function readConfig(): { preferredKeySource?: KeySource } {
  try {
    if (!existsSync(CONFIG_PATH)) return {}
    const raw = readFileSync(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed
      ? (parsed as { preferredKeySource?: KeySource })
      : {}
  } catch {
    return {}
  }
}

function writeConfig(cfg: { preferredKeySource?: KeySource }): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8')
}

function clearConfig(): void {
  try {
    if (!existsSync(CONFIG_DIR)) return
    writeConfig({})
  } catch {
    // ignore
  }
}

function maskKey(k?: string): string {
  if (!k) return '(unset)'
  return k.length <= 8
    ? '*'.repeat(k.length)
    : `${k.slice(0, 4)}...${k.slice(-4)}`
}

export async function ensureApiKey(reset: boolean = false) {
  const keyFromGoogle = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const keyFromGemini = process.env.GEMINI_API_KEY

  const cfg = readConfig()
  if (reset && cfg.preferredKeySource) {
    clearConfig()
  }

  const normalize = (v?: string): KeySource | undefined =>
    v && ['google', 'gemini', 'manual'].includes(v.toLowerCase())
      ? (v.toLowerCase() as KeySource)
      : undefined

  const envKeySource = normalize(process.env.RAG_KEY_SOURCE)
  const initialSource: KeySource =
    envKeySource ||
    (cfg.preferredKeySource as KeySource | undefined) ||
    (keyFromGoogle ? 'google' : keyFromGemini ? 'gemini' : 'manual')

  const shouldSkipPrompt = Boolean(cfg.preferredKeySource && !envKeySource)

  let choice: KeySource
  if (shouldSkipPrompt) {
    choice = cfg.preferredKeySource as KeySource
  } else {
    const envOptions: { value: KeySource; label: string }[] = []
    if (keyFromGoogle) {
      envOptions.push({
        value: 'google',
        label: `Google Generative AI env (GOOGLE_GENERATIVE_AI_API_KEY): ${maskKey(
          keyFromGoogle,
        )}`,
      })
    }
    if (keyFromGemini) {
      envOptions.push({
        value: 'gemini',
        label: `Gemini env (GEMINI_API_KEY): ${maskKey(keyFromGemini)}`,
      })
    }
    if (envOptions.length === 0) {
      choice = 'manual'
    } else {
      const selected = (await select({
        message: 'Select API key source',
        initialValue: initialSource,
        options: [...envOptions, { value: 'manual', label: 'Manual input' }],
      })) as KeySource | symbol
      if (isCancel(selected)) {
        outro('API key is required. Exiting.')
        process.exit(1)
      }
      choice = selected as KeySource
    }
  }

  let finalKey: string | undefined
  if (choice === 'google') {
    if (keyFromGoogle && keyFromGoogle.trim().length >= 20) {
      finalKey = keyFromGoogle
    } else {
      const inputKey = await text({
        message:
          'Enter your Google Generative AI API key (Ctrl+C to cancel)\nGet one at https://aistudio.google.com/apikey',
        placeholder: 'AIza... (input will be visible)',
        validate(value) {
          if (!value || value.trim().length < 20) {
            return 'Please enter a valid API key.'
          }
        },
      })
      if (isCancel(inputKey)) {
        outro('API key is required. Exiting.')
        process.exit(1)
      }
      finalKey = String(inputKey)
    }
  } else if (choice === 'gemini') {
    if (keyFromGemini && keyFromGemini.trim().length >= 20) {
      finalKey = keyFromGemini
    } else {
      const inputKey = await text({
        message:
          'Enter your GEMINI_API_KEY (Ctrl+C to cancel)\nGet one at https://aistudio.google.com/apikey',
        placeholder: 'AIza... (input will be visible)',
        validate(value) {
          if (!value || value.trim().length < 20) {
            return 'Please enter a valid API key.'
          }
        },
      })
      if (isCancel(inputKey)) {
        outro('API key is required. Exiting.')
        process.exit(1)
      }
      finalKey = String(inputKey)
    }
  } else {
    const inputKey = await text({
      message:
        'Enter your GOOGLE_GENERATIVE_AI_API_KEY (Ctrl+C to cancel)\nGet one at https://aistudio.google.com/apikey',
      placeholder: 'AIza... (input will be visible)',
      validate(value) {
        if (!value || value.trim().length < 20) {
          return 'Please enter a valid API key.'
        }
      },
    })
    if (isCancel(inputKey)) {
      outro('API key is required. Exiting.')
      process.exit(1)
    }
    finalKey = String(inputKey)
  }

  if (finalKey) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = finalKey
    process.env.GEMINI_API_KEY = finalKey
  }

  // Quick health check: try a tiny embedding request to verify connectivity/key
  const s2 = spinner()
  s2.start('Verifying embeddings connectivity...')
  try {
    await getEmbedding('healthcheck')
    s2.stop('Embeddings connectivity verified')
  } catch (e: any) {
    s2.stop('')
    const msg = e?.message || String(e)
    outro(
      `Failed to verify google api connectivity. ${msg}\nPlease check your network and API key, then try again.`,
    )
    process.exit(1)
  }

  if (!shouldSkipPrompt) {
    const remember = await confirm({
      message:
        'Remember this key source as default? (You can change it later with --key-source or --reset-config)',
      initialValue: cfg.preferredKeySource === choice,
    })
    if (!isCancel(remember) && remember) {
      writeConfig({ preferredKeySource: choice })
    }
  }
}
