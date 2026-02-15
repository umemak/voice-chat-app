/**
 * HTTP-based Voice Chat API
 * - Uses Cloudflare Workers AI directly
 * - Simpler implementation without Realtime Agents
 * - Supports both Cloudflare and external providers
 */

import { Hono } from 'hono';
import type { Bindings, STTProvider, LLMProvider, CloudflareSTTModel, CloudflareLLMModel } from '../types';
import { OpenAIService } from '../services/openai';
import { CloudflareLLMService } from '../services/cloudflare-llm';
import { RAGService } from '../services/rag';

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Process voice chat via HTTP
 * POST /api/chat-http/process
 * Body: { audio: base64, sttProvider, sttModel, llmProvider, llmModel, sessionId }
 */
app.post('/process', async (c) => {
  try {
    const { 
      audio, 
      sttProvider = 'cloudflare',
      sttModel = '@cf/openai/whisper-large-v3-turbo',
      llmProvider = 'cloudflare',
      llmModel = '@cf/openai/gpt-oss-120b',
      sessionId 
    } = await c.req.json<{
      audio: string; // base64 encoded audio
      sttProvider?: STTProvider;
      sttModel?: CloudflareSTTModel;
      llmProvider?: LLMProvider;
      llmModel?: CloudflareLLMModel;
      sessionId?: string;
    }>();

    if (!audio) {
      return c.json({ error: 'Audio data required' }, 400);
    }

    console.log(`[ChatHTTP] Processing request - STT: ${sttProvider}, LLM: ${llmProvider}`);

    // Step 1: Speech to Text
    let transcript: string;
    if (sttProvider === 'cloudflare') {
      transcript = await performCloudflareSTT(c.env.AI, audio, sttModel as CloudflareSTTModel);
    } else {
      // Deepgram STT (future implementation)
      throw new Error('Deepgram STT not yet implemented for HTTP mode');
    }

    console.log(`[ChatHTTP] Transcript: ${transcript}`);

    // Step 2: RAG Context Search
    const ragService = new RAGService(c.env);
    const ragContext = await ragService.getContext(transcript, 3);
    console.log(`[ChatHTTP] RAG context found: ${ragContext ? 'Yes' : 'No'}`);

    // Step 3: LLM Response Generation
    let responseText: string;
    if (llmProvider === 'cloudflare') {
      const llmService = new CloudflareLLMService(c.env.AI, llmModel as CloudflareLLMModel);
      responseText = await llmService.chatCompletion(
        [{ role: 'user', content: transcript }],
        ragContext
      );
    } else {
      const openaiService = new OpenAIService(c.env.OPENAI_API_KEY);
      responseText = await openaiService.chatCompletion(
        [{ role: 'user', content: transcript }],
        ragContext
      );
    }

    console.log(`[ChatHTTP] Response: ${responseText}`);

    // Step 4: Text to Speech
    const audioResponse = await performCloudflareTTS(c.env.AI, responseText);

    // Step 5: Save conversation (optional)
    if (sessionId) {
      await saveConversation(c.env, sessionId, transcript, responseText);
    }

    // Return response
    return c.json({
      success: true,
      transcript,
      responseText,
      audioBase64: Buffer.from(audioResponse).toString('base64'),
      sessionId: sessionId || `session_${Date.now()}`
    });

  } catch (error) {
    console.error('[ChatHTTP] Error:', error);
    return c.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      500
    );
  }
});

/**
 * Perform STT using Cloudflare Workers AI
 */
async function performCloudflareSTT(
  ai: any,
  audioBase64: string,
  model: CloudflareSTTModel
): Promise<string> {
  try {
    // Decode base64 audio
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Call Workers AI STT
    const response = await ai.run(model, {
      audio: Array.from(new Uint8Array(audioBuffer)),
    });

    // Handle response format
    if (response.text) {
      return response.text;
    } else if (response.transcription) {
      return response.transcription;
    } else if (typeof response === 'string') {
      return response;
    }

    console.error('[STT] Unexpected response format:', response);
    throw new Error('Unexpected STT response format');
  } catch (error) {
    console.error('[STT] Error:', error);
    throw new Error(`STT failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Perform TTS using Cloudflare Workers AI
 */
async function performCloudflareTTS(
  ai: any,
  text: string,
  model: string = '@cf/deepgram/aura-2-en'
): Promise<ArrayBuffer> {
  try {
    const response = await ai.run(model, { text });

    // Handle response format
    if (response instanceof ArrayBuffer) {
      return response;
    } else if (response.audio) {
      return response.audio;
    }

    throw new Error('Unexpected TTS response format');
  } catch (error) {
    console.error('[TTS] Error:', error);
    throw new Error(`TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save conversation to D1 database
 */
async function saveConversation(
  env: Bindings,
  sessionId: string,
  userText: string,
  assistantText: string
): Promise<void> {
  try {
    // Get or create conversation
    let conversation = await env.DB.prepare(
      'SELECT id FROM conversations WHERE session_id = ? AND ended_at IS NULL'
    )
      .bind(sessionId)
      .first<{ id: number }>();

    if (!conversation) {
      const result = await env.DB.prepare(
        'INSERT INTO conversations (session_id) VALUES (?)'
      )
        .bind(sessionId)
        .run();
      conversation = { id: result.meta.last_row_id as number };
    }

    // Save messages
    await env.DB.prepare(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
    )
      .bind(conversation.id, 'user', userText)
      .run();

    await env.DB.prepare(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
    )
      .bind(conversation.id, 'assistant', assistantText)
      .run();
  } catch (error) {
    console.error('[SaveConversation] Error:', error);
    // Don't throw - this is optional
  }
}

export default app;
