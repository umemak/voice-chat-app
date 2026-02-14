/**
 * RAG (Retrieval-Augmented Generation) Service
 * - Document chunking
 * - Vector search using Cloudflare Vectorize
 * - Context retrieval for LLM
 */

import type { Bindings } from '../types';
import { OpenAIService } from './openai';

export class RAGService {
  private db: D1Database;
  private vectorize: VectorizeIndex;
  private openai: OpenAIService;

  constructor(bindings: Bindings) {
    this.db = bindings.DB;
    this.vectorize = bindings.VECTORIZE;
    this.openai = new OpenAIService(bindings.OPENAI_API_KEY);
  }

  /**
   * Split text into chunks for vectorization
   */
  chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;

      if (start >= text.length - overlap) break;
    }

    return chunks;
  }

  /**
   * Process and vectorize a document
   */
  async processDocument(documentId: number, text: string): Promise<void> {
    // Split text into chunks
    const chunks = this.chunkText(text);

    // Insert chunks into database and vectorize
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Generate embedding
      const embedding = await this.openai.createEmbedding(chunk);

      // Generate unique vector ID
      const vectorId = `doc_${documentId}_chunk_${i}`;

      // Insert into Vectorize
      await this.vectorize.upsert([
        {
          id: vectorId,
          values: embedding,
          metadata: {
            document_id: documentId,
            chunk_index: i,
            content: chunk,
          },
        },
      ]);

      // Insert chunk into database
      await this.db
        .prepare(
          'INSERT INTO document_chunks (document_id, chunk_index, content, vector_id) VALUES (?, ?, ?, ?)'
        )
        .bind(documentId, i, chunk, vectorId)
        .run();
    }

    // Mark document as processed
    await this.db
      .prepare('UPDATE documents SET processed = 1, processed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(documentId)
      .run();
  }

  /**
   * Search for relevant document chunks using vector similarity
   */
  async search(query: string, topK: number = 5): Promise<Array<{
    content: string;
    document_id: number;
    filename: string;
    score: number;
  }>> {
    // Generate query embedding
    const queryEmbedding = await this.openai.createEmbedding(query);

    // Search in Vectorize
    const results = await this.vectorize.query(queryEmbedding, {
      topK,
      returnMetadata: true,
    });

    // Fetch document information
    const enrichedResults = await Promise.all(
      results.matches.map(async (match) => {
        const documentId = match.metadata?.document_id as number;

        const doc = await this.db
          .prepare('SELECT filename FROM documents WHERE id = ?')
          .bind(documentId)
          .first<{ filename: string }>();

        return {
          content: match.metadata?.content as string,
          document_id: documentId,
          filename: doc?.filename || 'Unknown',
          score: match.score,
        };
      })
    );

    return enrichedResults;
  }

  /**
   * Get RAG context for LLM
   */
  async getContext(query: string, topK: number = 3): Promise<string> {
    const results = await this.search(query, topK);

    if (results.length === 0) {
      return '';
    }

    const context = results
      .map(
        (result, index) =>
          `[参考資料 ${index + 1}: ${result.filename}]\n${result.content}\n`
      )
      .join('\n');

    return context;
  }

  /**
   * Delete document vectors from Vectorize
   */
  async deleteDocumentVectors(documentId: number): Promise<void> {
    // Get all chunk vector IDs
    const chunks = await this.db
      .prepare('SELECT vector_id FROM document_chunks WHERE document_id = ?')
      .bind(documentId)
      .all<{ vector_id: string }>();

    if (chunks.results.length > 0) {
      const vectorIds = chunks.results
        .map((c) => c.vector_id)
        .filter((id): id is string => id !== null);

      // Delete from Vectorize
      await this.vectorize.deleteByIds(vectorIds);
    }

    // Delete chunks from database
    await this.db
      .prepare('DELETE FROM document_chunks WHERE document_id = ?')
      .bind(documentId)
      .run();
  }
}
