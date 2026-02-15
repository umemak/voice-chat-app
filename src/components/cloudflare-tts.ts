/**
 * Cloudflare TTS Component for Realtime Agents
 * - Text-to-Speech using Cloudflare Workers AI
 * - Compatible with Realtime Agents pipeline
 * - Supports multiple TTS models
 */

import { TTSComponent } from '@cloudflare/realtime-agents';
import type { CloudflareTTSModel } from '../types';

export class CloudflareTTS extends TTSComponent {
  private ai: any;
  private model: CloudflareTTSModel;

  constructor(ai: any, model: CloudflareTTSModel = '@cf/deepgram/aura-2-en') {
    super();
    this.ai = ai;
    this.model = model;
  }

  /**
   * Convert text to speech using Workers AI
   */
  async textToSpeech(text: string): Promise<ArrayBuffer> {
    try {
      console.log(`[CloudflareTTS] Generating speech for: ${text.substring(0, 50)}...`);
      console.log(`[CloudflareTTS] Using model: ${this.model}`);

      // Call Workers AI TTS
      const response = await this.ai.run(this.model, {
        text: text,
      });

      // Handle response format
      let audioBuffer: ArrayBuffer;
      if (response instanceof ArrayBuffer) {
        audioBuffer = response;
      } else if (response.audio) {
        audioBuffer = response.audio;
      } else {
        throw new Error('Unexpected response format from Workers AI TTS');
      }

      console.log(`[CloudflareTTS] Generated ${audioBuffer.byteLength} bytes of audio`);
      return audioBuffer;
    } catch (error) {
      console.error('[CloudflareTTS] Error:', error);
      throw new Error(`Cloudflare TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

