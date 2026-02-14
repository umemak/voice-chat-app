/**
 * Admin API Routes
 * - File upload and management
 * - Document processing
 * - Voice profile management
 */

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { RAGService } from '../services/rag';

const admin = new Hono<{ Bindings: Bindings }>();

/**
 * Upload document file (PowerPoint, Text, PDF)
 */
admin.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const r2Key = `documents/${timestamp}_${randomStr}_${file.name}`;

    // Upload to R2
    await c.env.R2.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Insert document metadata into database
    const result = await c.env.DB.prepare(
      `INSERT INTO documents (filename, original_filename, file_type, file_size, r2_key)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(r2Key, file.name, file.type, file.size, r2Key)
      .run();

    const documentId = result.meta.last_row_id;

    // Extract text from file (simple text extraction for .txt files)
    // For PPTX/PDF, you would need additional processing
    let textContent = '';
    if (file.type === 'text/plain') {
      textContent = await file.text();
    } else {
      // For now, return success and mark as unprocessed
      return c.json({
        success: true,
        document: {
          id: documentId,
          filename: r2Key,
          original_filename: file.name,
          file_type: file.type,
          processed: false,
          message: 'File uploaded. Manual text extraction required for non-text files.',
        },
      });
    }

    // Process document for RAG
    const ragService = new RAGService(c.env);
    await ragService.processDocument(documentId as number, textContent);

    return c.json({
      success: true,
      document: {
        id: documentId,
        filename: r2Key,
        original_filename: file.name,
        file_type: file.type,
        processed: true,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      500
    );
  }
});

/**
 * Process uploaded document text manually
 */
admin.post('/process/:id', async (c) => {
  try {
    const documentId = parseInt(c.req.param('id'));
    const { text } = await c.req.json<{ text: string }>();

    if (!text) {
      return c.json({ success: false, error: 'No text content provided' }, 400);
    }

    // Process document for RAG
    const ragService = new RAGService(c.env);
    await ragService.processDocument(documentId, text);

    return c.json({ success: true, message: 'Document processed successfully' });
  } catch (error) {
    console.error('Process error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      },
      500
    );
  }
});

/**
 * Get all documents
 */
admin.get('/documents', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM documents ORDER BY uploaded_at DESC'
    ).all();

    return c.json({ success: true, documents: result.results });
  } catch (error) {
    console.error('Get documents error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch documents',
      },
      500
    );
  }
});

/**
 * Delete document
 */
admin.delete('/documents/:id', async (c) => {
  try {
    const documentId = parseInt(c.req.param('id'));

    // Get document info
    const doc = await c.env.DB.prepare('SELECT r2_key FROM documents WHERE id = ?')
      .bind(documentId)
      .first<{ r2_key: string }>();

    if (!doc) {
      return c.json({ success: false, error: 'Document not found' }, 404);
    }

    // Delete from R2
    await c.env.R2.delete(doc.r2_key);

    // Delete vectors from Vectorize
    const ragService = new RAGService(c.env);
    await ragService.deleteDocumentVectors(documentId);

    // Delete from database (cascades to chunks)
    await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(documentId).run();

    return c.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      },
      500
    );
  }
});

/**
 * Get all voice profiles
 */
admin.get('/voices', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM voice_profiles ORDER BY created_at DESC'
    ).all();

    return c.json({ success: true, voices: result.results });
  } catch (error) {
    console.error('Get voices error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch voices',
      },
      500
    );
  }
});

/**
 * Create voice profile (saves ElevenLabs voice ID)
 */
admin.post('/voices', async (c) => {
  try {
    const { name, voice_id, description } = await c.req.json<{
      name: string;
      voice_id: string;
      description?: string;
    }>();

    if (!name || !voice_id) {
      return c.json({ success: false, error: 'Name and voice_id required' }, 400);
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO voice_profiles (name, voice_id, description) VALUES (?, ?, ?)'
    )
      .bind(name, voice_id, description || '')
      .run();

    return c.json({
      success: true,
      voice: {
        id: result.meta.last_row_id,
        name,
        voice_id,
        description,
      },
    });
  } catch (error) {
    console.error('Create voice error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Voice creation failed',
      },
      500
    );
  }
});

export default admin;
