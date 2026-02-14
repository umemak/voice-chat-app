/**
 * Chat API Routes
 * - Voice chat with STT, RAG, LLM, TTS, Lip-sync
 */

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { OpenAIService } from '../services/openai';
import { ElevenLabsService } from '../services/elevenlabs';
import { DIDService } from '../services/did';
import { RAGService } from '../services/rag';

const chat = new Hono<{ Bindings: Bindings }>();

/**
 * Chat endpoint - handles audio input, generates audio/video response
 */
chat.post('/message', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File | null;
    const textInput = formData.get('text') as string | null;
    const sessionId = formData.get('session_id') as string;
    const voiceProfileId = formData.get('voice_profile_id') as string | null;

    if (!audioFile && !textInput) {
      return c.json({ success: false, error: 'Audio or text input required' }, 400);
    }

    if (!sessionId) {
      return c.json({ success: false, error: 'session_id required' }, 400);
    }

    // Initialize services
    const openai = new OpenAIService(c.env.OPENAI_API_KEY);
    const elevenlabs = new ElevenLabsService(c.env.ELEVENLABS_API_KEY);
    const did = new DIDService(c.env.DID_API_KEY);
    const rag = new RAGService(c.env);

    // Get or create conversation
    let conversation = await c.env.DB.prepare(
      'SELECT * FROM conversations WHERE session_id = ? AND ended_at IS NULL'
    )
      .bind(sessionId)
      .first();

    if (!conversation) {
      const result = await c.env.DB.prepare(
        'INSERT INTO conversations (session_id) VALUES (?)'
      )
        .bind(sessionId)
        .run();
      conversation = { id: result.meta.last_row_id };
    }

    const conversationId = conversation.id as number;

    // Step 1: Transcribe audio if provided
    let userText = textInput || '';
    if (audioFile) {
      userText = await openai.transcribe(audioFile);

      // Save user audio to R2
      const audioKey = `audio/${Date.now()}_user.webm`;
      await c.env.R2.put(audioKey, audioFile.stream(), {
        httpMetadata: { contentType: 'audio/webm' },
      });

      // Save user message with audio
      await c.env.DB.prepare(
        'INSERT INTO messages (conversation_id, role, content, audio_url) VALUES (?, ?, ?, ?)'
      )
        .bind(conversationId, 'user', userText, audioKey)
        .run();
    } else {
      // Save user message (text only)
      await c.env.DB.prepare(
        'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
      )
        .bind(conversationId, 'user', userText)
        .run();
    }

    // Step 2: RAG - Search for relevant context
    const ragContext = await rag.getContext(userText, 3);

    // Step 3: Generate LLM response
    const assistantText = await openai.chatCompletion(
      [{ role: 'user', content: userText }],
      ragContext
    );

    // Step 4: Get voice profile
    let voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Default ElevenLabs voice
    if (voiceProfileId) {
      const voice = await c.env.DB.prepare(
        'SELECT voice_id FROM voice_profiles WHERE id = ? AND is_active = 1'
      )
        .bind(parseInt(voiceProfileId))
        .first<{ voice_id: string }>();

      if (voice) {
        voiceId = voice.voice_id;
      }
    }

    // Step 5: Generate TTS audio
    const audioBuffer = await elevenlabs.textToSpeech(assistantText, voiceId);

    // Save assistant audio to R2
    const assistantAudioKey = `audio/${Date.now()}_assistant.mp3`;
    await c.env.R2.put(assistantAudioKey, audioBuffer, {
      httpMetadata: { contentType: 'audio/mpeg' },
    });

    // Get public URL for audio (for D-ID)
    // Note: In production, you'd need to configure R2 public access or signed URLs
    const audioPublicUrl = `https://your-r2-domain.com/${assistantAudioKey}`;

    // Step 6: Generate lip-sync video (D-ID)
    // This can take time, so we'll start it and return immediately
    // In production, consider using a queue/worker pattern
    let videoUrl = '';
    try {
      const talkId = await did.createTalk(audioPublicUrl);
      // Poll for completion (simplified - in production use webhooks)
      videoUrl = await did.waitForTalk(talkId, 30);
    } catch (error) {
      console.error('D-ID video generation error:', error);
      // Continue without video
    }

    // Save assistant message
    const messageResult = await c.env.DB.prepare(
      'INSERT INTO messages (conversation_id, role, content, audio_url, video_url) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(conversationId, 'assistant', assistantText, assistantAudioKey, videoUrl || null)
      .run();

    return c.json({
      success: true,
      message: {
        id: messageResult.meta.last_row_id,
        content: assistantText,
        audio_url: assistantAudioKey,
        video_url: videoUrl,
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Chat processing failed',
      },
      500
    );
  }
});

/**
 * Get conversation history
 */
chat.get('/history/:session_id', async (c) => {
  try {
    const sessionId = c.req.param('session_id');

    const conversation = await c.env.DB.prepare(
      'SELECT id FROM conversations WHERE session_id = ?'
    )
      .bind(sessionId)
      .first();

    if (!conversation) {
      return c.json({ success: true, messages: [] });
    }

    const messages = await c.env.DB.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    )
      .bind(conversation.id as number)
      .all();

    return c.json({ success: true, messages: messages.results });
  } catch (error) {
    console.error('Get history error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch history',
      },
      500
    );
  }
});

/**
 * Get audio file from R2
 */
chat.get('/audio/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const object = await c.env.R2.get(`audio/${key}`);

    if (!object) {
      return c.notFound();
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('Get audio error:', error);
    return c.notFound();
  }
});

export default chat;
