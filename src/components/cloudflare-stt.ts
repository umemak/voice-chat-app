/**
 * Cloudflare STT Component for Realtime Agents
 * - Speech-to-Text using Cloudflare Workers AI
 * - Compatible with Realtime Agents pipeline
 * - Supports multiple STT models (Whisper, Deepgram)
 */

import { STTComponent } from '@cloudflare/realtime-agents';
import type { CloudflareSTTModel } from '../types';

export class CloudflareSTT extends STTComponent {
  private ai: any;
  private model: CloudflareSTTModel;

  constructor(ai: any, model: CloudflareSTTModel = '@cf/openai/whisper-large-v3-turbo') {
    super();
    this.ai = ai;
    this.model = model;
  }

  /**
   * Convert speech to text using Workers AI
   */
  async speechToText(audioBuffer: ArrayBuffer): Promise<string> {
    try {
      console.log(`[CloudflareSTT] Transcribing audio (${audioBuffer.byteLength} bytes)...`);
      console.log(`[CloudflareSTT] Using model: ${this.model}`);

      // Call Workers AI STT
      const response = await this.ai.run(this.model, {
        audio: audioBuffer,
      });

      // Handle response format
      let transcription: string;
      if (typeof response === 'string') {
        transcription = response;
      } else if (response.text) {
        transcription = response.text;
      } else if (response.transcription) {
        transcription = response.transcription;
      } else {
        throw new Error('Unexpected response format from Workers AI STT');
      }

      console.log(`[CloudflareSTT] Transcription: ${transcription}`);
      return transcription;
    } catch (error) {
      console.error('[CloudflareSTT] Error:', error);
      throw new Error(`Cloudflare STT failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
