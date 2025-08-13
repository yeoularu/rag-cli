import { embed, embedMany } from 'ai'
import { google } from '@ai-sdk/google'

type TaskType = 'SEMANTIC_SIMILARITY' | 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

const DIM = 768

// Concurrency control for embedMany: configurable via env, clamped to [1, 16]
const DEFAULT_MAX_PAR = 8
const _ENV_MAX_PAR = Number(process.env.RAG_EMBED_MAX_PAR ?? '')
const MAX_PARALLEL_CALLS =
  Number.isFinite(_ENV_MAX_PAR) && _ENV_MAX_PAR > 0
    ? Math.min(16, Math.max(1, Math.floor(_ENV_MAX_PAR)))
    : DEFAULT_MAX_PAR

function l2Normalize(vec: number[]): number[] {
  const norm = Math.hypot(...vec)
  if (!isFinite(norm) || norm === 0) return vec
  return vec.map((v) => v / norm)
}

// Returns a 768-dim embedding for the given text using Gemini embeddings
export async function getEmbedding(
  text: string,
  taskType: TaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[]> {
  const value = (text ?? '').trim()
  if (!value) return Array(DIM).fill(0)

  const { embedding } = await embed({
    model: google.textEmbeddingModel('gemini-embedding-001'),
    value,
    providerOptions: {
      google: {
        outputDimensionality: DIM,
        taskType,
      },
    },
  })

  // For non-3072 dims, normalize to unit length as recommended by Google docs
  return l2Normalize(embedding)
}

export async function getDocumentEmbedding(text: string): Promise<number[]> {
  return getEmbedding(text, 'RETRIEVAL_DOCUMENT')
}

export async function getQueryEmbedding(text: string): Promise<number[]> {
  return getEmbedding(text, 'RETRIEVAL_QUERY')
}

// Batch embeddings with consistent 768-dim output and normalization.
export async function getEmbeddings(
  texts: string[],
  taskType: TaskType = 'SEMANTIC_SIMILARITY',
): Promise<number[][]> {
  const values = texts.map((t) => (t ?? '').trim())
  const isEmpty = values.map((v) => v.length === 0)
  const nonEmptyValues = values.filter((v) => v.length > 0)

  let embedded: number[][] = []
  if (nonEmptyValues.length > 0) {
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel('gemini-embedding-001'),
      values: nonEmptyValues,
      maxParallelCalls: MAX_PARALLEL_CALLS,
      providerOptions: {
        google: {
          outputDimensionality: DIM,
          taskType,
        },
      },
    })
    // embeddings type may be (number[] | undefined)[] in types; guard and normalize
    embedded = embeddings.map((e) =>
      l2Normalize((e ?? Array(DIM).fill(0)) as number[]),
    )
  }

  // Reconstruct original order and fill zeros for empties
  const result: number[][] = []
  let idx = 0
  for (let i = 0; i < values.length; i++) {
    if (isEmpty[i]) result.push(Array(DIM).fill(0))
    else result.push(embedded[idx++] ?? Array(DIM).fill(0))
  }
  return result
}

export async function getDocumentEmbeddings(
  texts: string[],
): Promise<number[][]> {
  return getEmbeddings(texts, 'RETRIEVAL_DOCUMENT')
}

export async function getQueryEmbeddings(texts: string[]): Promise<number[][]> {
  return getEmbeddings(texts, 'RETRIEVAL_QUERY')
}
