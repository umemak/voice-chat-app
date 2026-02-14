/**
 * RAG Text Processor Component
 * - Handles transcribed text from STT
 * - Performs RAG search using Vectorize
 * - Generates LLM response with context
 * - Returns text for TTS
 */

import { TextComponent } from '@cloudflare/realtime-agents';
import type { Bindings } from '../types';
import { RAGService } from '../services/rag';
import { OpenAIService } from '../services/openai';

export class RAGTextProcessor extends TextComponent {
  private env: Bindings;
  private ragService: RAGService;
  private openaiService: OpenAIService;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(env: Bindings) {
    super();
    this.env = env;
    this.ragService = new RAGService(env);
    this.openaiService = new OpenAIService(env.OPENAI_API_KEY);
  }

  /**
   * Called when speech-to-text produces a transcript
   * This is where we implement our RAG logic
   */
  async onTranscript(text: string, reply: (text: string) => void) {
    try {
      console.log(`[RAG] User said: ${text}`);

      // Add user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: text,
      });

      // Step 1: Search for relevant context using RAG
      const ragContext = await this.ragService.getContext(text, 3);
      console.log(`[RAG] Found context: ${ragContext ? 'Yes' : 'No'}`);

      // Step 2: Generate response using LLM with RAG context
      const response = await this.openaiService.chatCompletion(
        this.conversationHistory,
        ragContext
      );

      console.log(`[RAG] AI response: ${response}`);

      // Add assistant message to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
      });

      // Keep conversation history manageable (last 10 messages)
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      // Step 3: Send response to TTS pipeline
      reply(response);

      // Optional: Save conversation to database
      await this.saveConversation(text, response);
    } catch (error) {
      console.error('[RAG] Error processing transcript:', error);
      const errorMessage = 'すみません、エラーが発生しました。もう一度お試しください。';
      reply(errorMessage);
    }
  }

  /**
   * Save conversation to D1 database for history
   */
  private async saveConversation(userText: string, assistantText: string) {
    try {
      // Create a session ID based on agent ID or meeting ID
      const sessionId = `realtime_${Date.now()}`;

      // Get or create conversation
      let conversation = await this.env.DB.prepare(
        'SELECT id FROM conversations WHERE session_id = ? AND ended_at IS NULL'
      )
        .bind(sessionId)
        .first<{ id: number }>();

      if (!conversation) {
        const result = await this.env.DB.prepare(
          'INSERT INTO conversations (session_id) VALUES (?)'
        )
          .bind(sessionId)
          .run();
        conversation = { id: result.meta.last_row_id as number };
      }

      // Save user message
      await this.env.DB.prepare(
        'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
      )
        .bind(conversation.id, 'user', userText)
        .run();

      // Save assistant message
      await this.env.DB.prepare(
        'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
      )
        .bind(conversation.id, 'assistant', assistantText)
        .run();
    } catch (error) {
      console.error('[RAG] Error saving conversation:', error);
      // Don't throw - this is optional functionality
    }
  }

  /**
   * Manually trigger speech (useful for events like participant joined)
   */
  speak(text: string) {
    console.log(`[RAG] Speaking: ${text}`);
    // This triggers the TTS pipeline
    super.speak(text);
  }

  /**
   * Clear conversation history (useful for new sessions)
   */
  clearHistory() {
    this.conversationHistory = [];
    console.log('[RAG] Conversation history cleared');
  }
}
