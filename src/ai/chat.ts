import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { text, isCancel, cancel, note } from '@clack/prompts'
import { embedDocuments } from '../tools/embedMany'
import { searchDocuments } from '../tools/search'
import { stepCountIs } from 'ai'
import { SYSTEM_PROMPT } from './prompt'

const CHAT_MODEL = 'gemini-2.5-flash'

type Message = { role: 'user' | 'assistant'; content: string }

let isShuttingDown = false

function setupGracefulShutdown() {
  const shutdown = () => {
    if (isShuttingDown) return
    isShuttingDown = true
    cancel('Operation cancelled.')
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  return () => process.off('SIGINT', shutdown)
}

async function getAIResponse(messages: Message[]) {
  return streamText({
    model: google(CHAT_MODEL),
    system: SYSTEM_PROMPT,
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    },
    messages,
    tools: {
      embedDocuments,
      searchDocuments,
    },
    stopWhen: stepCountIs(5),
  })
}

async function streamResponse(result: any) {
  for await (const delta of result.textStream) {
    if (isShuttingDown) break
    process.stdout.write(delta)
  }
  if (isShuttingDown) return
  process.stdout.write('\n')
}

async function logReasoning(result: any) {
  if (isShuttingDown) return
  try {
    const reasoning = await result.reasoning
    if (Array.isArray(reasoning) && reasoning.length > 0) {
      const reasoningTexts = reasoning.map((r: any) => r.text).join('\n---\n')
      if (reasoningTexts.trim())
        console.log(`Reasonings:\n${reasoningTexts}\n---`)
    }
  } catch {
    // ignore
  }
}

export async function runChat(): Promise<void> {
  note('🤖 RAG Chat ready. ctrl+C to quit.', 'RAG')
  const cleanup = setupGracefulShutdown()
  const messages: Message[] = []

  while (true) {
    const input = await text({ message: 'Your message' })
    if (isCancel(input)) {
      cancel('Operation cancelled.')
      process.exit(0)
    }
    const user = String(input).trim()
    if (!user) continue

    messages.push({ role: 'user', content: user })

    try {
      if (isShuttingDown) break
      const result = await getAIResponse(messages)
      await streamResponse(result)

      if (!isShuttingDown) {
        const final = await result.text
        messages.push({ role: 'assistant', content: final })
      }

      await logReasoning(result)
    } catch (err: any) {
      if (!isShuttingDown) {
        note(`An error occurred: ${err?.message || String(err)}`, 'Error')
      }
    }

    if (isShuttingDown) break
  }

  cleanup()
}
