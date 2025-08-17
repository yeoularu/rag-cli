import { db } from '../config/db'

export type InsertDocumentParams = {
  title: string
  content: string
  vector: number[] // 768-dim, stored as F32_BLOB(768)
}

export type SearchResult = {
  id: number
  title: string
  content: string
  distance?: number
}

const INDEX_NAME = 'documents_embedding_vec_idx'

function toVecJson(vec: number[]): string {
  return JSON.stringify(vec)
}

export async function insertDocument({
  title,
  content,
  vector,
}: InsertDocumentParams): Promise<number> {
  const res = await db.execute({
    sql: 'INSERT INTO documents (title, content, embedding) VALUES (?, ?, vector32(?))',
    args: [title, content, toVecJson(vector)],
  })
  return Number(res.lastInsertRowid)
}

export async function searchByVector({
  vector,
  topK,
}: {
  vector: number[]
  topK: number
}): Promise<SearchResult[]> {
  const vjson = toVecJson(vector)
  // Try vector index path via vector_top_k
  try {
    const vss = await db.execute({
      sql: `SELECT d.id AS id, d.title AS title, d.content AS content, v.distance AS distance
            FROM vector_top_k(?, vector32(?), ?) AS v
            JOIN documents AS d ON d.rowid = v.rowid
            ORDER BY v.distance ASC`,
      args: [INDEX_NAME, vjson, topK],
    })

    return vss.rows.map((r: any) => ({
      id: Number(r.id),
      title: String(r.title),
      content: String(r.content),
      distance: Number(r.distance),
    }))
  } catch (e) {
    // Fallback: brute-force cosine distance
    const bf = await db.execute({
      sql: `SELECT id, title, content
            FROM documents
            ORDER BY vector_distance_cos(embedding, vector32(?)) ASC
            LIMIT ?`,
      args: [vjson, topK],
    })
    return bf.rows.map((r: any) => ({
      id: Number(r.id),
      title: String(r.title),
      content: String(r.content),
    }))
  }
}
