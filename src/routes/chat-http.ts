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
import { DIDService } from '../services/did';

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
      sessionId,
      enableVideo = false,
      avatarUrl
    } = await c.req.json<{
      audio: string; // base64 encoded audio
      sttProvider?: STTProvider;
      sttModel?: CloudflareSTTModel;
      llmProvider?: LLMProvider;
      llmModel?: CloudflareLLMModel;
      sessionId?: string;
      enableVideo?: boolean; // Enable D-ID video generation
      avatarUrl?: string; // Custom avatar image URL (optional)
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

    // Step 5: D-ID Video Generation or Static Image (optional)
    let videoUrl: string | undefined;
    let videoId: string | undefined;
    let staticImageUrl: string | undefined;
    
    if (enableVideo) {
      if (c.env.DID_API_KEY) {
        // Generate video with D-ID
        try {
          console.log('[ChatHTTP] Generating D-ID video...');
          
          // Upload audio to R2 first (D-ID needs a public URL)
          const audioKey = `audio/${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
          await c.env.R2.put(audioKey, audioResponse, {
            httpMetadata: {
              contentType: 'audio/mpeg'
            }
          });
          
          // Create a temporary signed URL for D-ID (valid for 1 hour)
          // Note: You need to set up R2 public access or use a signed URL
          // For now, we'll use a workaround: create an endpoint to serve R2 files
          const audioPublicUrl = `${new URL(c.req.url).origin}/api/r2-proxy/${audioKey}`;
          
          const didService = new DIDService(c.env.DID_API_KEY);
          videoId = await didService.createTalk(audioPublicUrl, avatarUrl);
          console.log(`[ChatHTTP] D-ID Talk created: ${videoId}`);
          
          // Wait for video generation (with 60 second timeout)
          videoUrl = await didService.waitForTalk(videoId, 60);
          console.log(`[ChatHTTP] Video ready: ${videoUrl}`);
        } catch (error) {
          console.error('[ChatHTTP] D-ID video generation failed:', error);
          // Fallback to static image
          staticImageUrl = avatarUrl || 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg';
        }
      } else {
        // No D-ID API key - use static image
        console.log('[ChatHTTP] D-ID API key not configured, using static image');
        staticImageUrl = avatarUrl || 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg';
      }
    }

    // Step 6: Save conversation (optional)
    if (sessionId) {
      await saveConversation(c.env, sessionId, transcript, responseText, videoUrl, staticImageUrl);
    }

    // Return response
    return c.json({
      success: true,
      transcript,
      responseText,
      audioBase64: Buffer.from(audioResponse).toString('base64'),
      sessionId: sessionId || `session_${Date.now()}`,
      videoUrl,
      videoId,
      staticImageUrl
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
  assistantText: string,
  videoUrl?: string,
  staticImageUrl?: string
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

    // Store either video URL or static image URL
    const mediaUrl = videoUrl || staticImageUrl;
    await env.DB.prepare(
      'INSERT INTO messages (conversation_id, role, content, video_url) VALUES (?, ?, ?, ?)'
    )
      .bind(conversation.id, 'assistant', assistantText, mediaUrl || null)
      .run();
  } catch (error) {
    console.error('[SaveConversation] Error:', error);
    // Don't throw - this is optional
  }
}

/**
 * R2 Proxy endpoint - Serve audio files from R2 with public access
 * GET /api/r2-proxy/:key
 */
app.get('/r2-proxy/*', async (c) => {
  try {
    const key = c.req.param('*');
    
    if (!key) {
      return c.json({ error: 'File key required' }, 400);
    }

    const object = await c.env.R2.get(key);

    if (!object) {
      return c.json({ error: 'File not found' }, 404);
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[R2Proxy] Error:', error);
    return c.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      500
    );
  }
});

export default app;
