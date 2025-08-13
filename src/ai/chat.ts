import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { text, isCancel, cancel, note, spinner, log, stream } from '@clack/prompts'
import { embedDocuments } from '../tools/embedMany'
import { searchDocuments } from '../tools/search'
import { stepCountIs } from 'ai'

const SYSTEM_PROMPT = `You are a Retrieval-Augmented Generation (RAG) assistant. You can call tools and must incorporate the tool results into your next response. Prefer facts grounded in retrieved documents over speculation.

- Tools you can use:
  - embedDocuments: Batch-embed and store user-provided documents into the local database.
    - Input: { items: [{ text: string; title?: string }, ...] }
  - searchDocuments: Retrieve relevant documents by semantic similarity.
    - Input: { query: string; topK?: number } (default topK = 5)

- Internals (FYI): Embeddings are 768-dim, L2-normalized, and task-typed (documents: RETRIEVAL_DOCUMENT, queries: RETRIEVAL_QUERY). Concurrency is controlled internally; do not attempt to set it from the chat.

## When to use tools

- embedDocuments
  - Use immediately when:
    - The user explicitly asks to save or index documents/content.
    - The context makes it clear the user intends to store content (e.g., "add this to my knowledge base").
  - Ask the user before using when:
    - It is ambiguous whether the content should be stored (e.g., "I'm thinking about adding notes…").
    - You are unsure if the content is transient vs persistent.
  - Titles:
    - If title is not provided, derive from the first ~80 characters of the text.

- searchDocuments
  - Use when:
    - The user asks a question that likely depends on stored knowledge you cannot infer from the current turn alone.
    - You start a new conversation and need to check if prior data exists that could answer the question.
    - The user references content that may have been saved earlier (e.g., "from that guide I uploaded yesterday").
  - It's fine to use search at your discretion whenever retrieved context could improve answer quality.
  - If search returns no or weak results, ask a clarifying question or proceed with a best-effort answer clearly noting uncertainty.

## Tool-use protocol

- Always integrate tool results into your next message.
  - After embedDocuments: confirm what was stored (count, titles) and offer to proceed (e.g., run a search or answer related questions).
  - After searchDocuments: summarize the top results concisely and answer grounded in them. If insufficient, ask a clarifying question.
- Do not expose raw vectors or internal implementation details.
- If a tool input is ambiguous or incomplete, ask a short clarifying question before calling the tool.
- Be concise and factual. Cite document titles in-line when helpful.

## Answering policy

- Ground answers in retrieved content when a search was performed.
- If you did not search and are unsure, consider running searchDocuments. If still uncertain, ask a clarifying question.
- If the user asked to store data but provided none, request the content and confirm intent before embedding.
`

const CHAT_MODEL = 'gemini-2.5-flash'

export async function runChat(): Promise<void> {
  note('🤖 RAG Chat ready. ctrl+C to quit.', 'RAG')

  // Set up graceful shutdown handler
  let isShuttingDown = false
  const shutdown = () => {
    if (isShuttingDown) return
    isShuttingDown = true
    cancel('Operation cancelled.')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)

  // Minimal message memory for context across turns
  const messages: { role: 'user' | 'assistant'; content: string }[] = []

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
      // Check if we're shutting down before starting stream
      if (isShuttingDown) break

      const result = streamText({
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
        // Enable multi-step tool calling: after a tool call, run another step
        // with the tool result until the model produces text or step limit is reached.
        stopWhen: stepCountIs(5),
      })

      // Stream the assistant response
      for await (const delta of result.textStream) {
        if (isShuttingDown) break
        process.stdout.write(delta)
      }
      
      if (isShuttingDown) break
      process.stdout.write('\n')

      if (!isShuttingDown) {
        const final = await result.text
        messages.push({ role: 'assistant', content: final })
      }

      // Some models may not return reasoning; guard access
      if (!isShuttingDown) {
        try {
          const reasoning = await (result as any).reasoning
          if (Array.isArray(reasoning) && reasoning.length > 0) {
            const reasoningTexts = reasoning
              .map((r: any) => r.text)
              .join('\n---\n')
            if (reasoningTexts.trim())
              console.log(`Reasonings:\n${reasoningTexts}\n---`)
          }
        } catch {
          // ignore reasoning if not available
        }
      }
    } catch (err: any) {
      if (!isShuttingDown) {
        note(
          `An error occurred while generating a response: ${err?.message || String(err)}\nIf this persists, try re-running with --reset-config or check your API key.`,
          'Error',
        )
      }
    }

    if (isShuttingDown) break
  }

  // Clean up event listener
  process.off('SIGINT', shutdown)
}
