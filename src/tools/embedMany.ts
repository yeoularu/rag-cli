import { z } from 'zod'
import { tool } from 'ai'
import { tasks } from '@clack/prompts'
import { getDocumentEmbeddings } from '../services/embeddings'
import { insertDocument } from '../services/retrieval'

export const embedDocuments = tool({
  description:
    'Embed and store multiple documents into the local database efficiently using batch embeddings.',
  inputSchema: z.object({
    items: z
      .array(
        z.object({
          text: z.string().min(1),
          title: z.string().optional(),
        }),
      )
      .min(1),
  }),
  execute: async ({ items }) => {
    try {
      const texts = items.map((it) => it.text)
      const titles = items.map((it) => it.title)
      const results: { id: number; title: string }[] = []

      await tasks([
        {
          title: `📝 Embedding ${items.length} documents...`,
          task: async () => {
            const vectors = await getDocumentEmbeddings(texts)
            
            // Invariant: embedding count must match input count
            if (vectors.length !== items.length) {
              throw new Error(
                `Embedding count mismatch: expected ${items.length} got ${vectors.length}`,
              )
            }

            for (let i = 0; i < items.length; i++) {
              const text = texts[i]!
              const title = titles[i] ?? text.slice(0, 80)
              const vector = vectors[i]!
              const id = await insertDocument({ title, content: text, vector })
              results.push({ id, title })
            }

            return `✅ ${items.length} documents stored`
          },
        },
      ])

      const storedTitles = results.map(r => r.title).join(', ')
      return { 
        count: results.length, 
        results,
        summary: `Stored ${results.length} document(s): ${storedTitles}`
      }
    } catch (error) {
      throw error
    }
  },
})
