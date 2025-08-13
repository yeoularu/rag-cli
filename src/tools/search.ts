import { z } from 'zod'
import { tool } from 'ai'
import { spinner } from '@clack/prompts'
import { getQueryEmbedding } from '../services/embeddings'
import { searchByVector } from '../services/retrieval'

export const searchDocuments = tool({
  description: 'Semantic search documents by query using vector similarity.',
  inputSchema: z.object({
    query: z.string().min(1),
    topK: z.number().int().min(1).max(50).optional(),
  }),
  execute: async ({ query, topK = 5 }) => {
    const s = spinner()
    s.start(`🔍 Searching for "${query}"...`)

    try {
      const vector = await getQueryEmbedding(query)
      const results = await searchByVector({ vector, topK })

      s.stop(`✅ Found ${results.length} documents`)
      return { query, results }
    } catch (error) {
      s.stop('❌ Search failed')
      throw error
    }
  },
})
