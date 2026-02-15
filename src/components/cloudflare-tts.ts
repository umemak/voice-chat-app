/**
 * Cloudflare TTS Component for Realtime Agents
 * - Text-to-Speech using Cloudflare Workers AI
 * - Compatible with Realtime Agents pipeline
 */

import { TTSComponent } from '@cloudflare/realtime-agents';

export class CloudflareTTS extends TTSComponent {
  private ai: any;

  constructor(ai: any) {
    super();
    this.ai = ai;
  }

  /**
   * Convert text to speech using Workers AI
   */
  async textToSpeech(text: string): Promise<ArrayBuffer> {
    try {
      console.log(`[CloudflareTTS] Generating speech for: ${text.substring(0, 50)}...`);

      // Use Deepgram Aura via Workers AI
      const response = await this.ai.run('@cf/deepgram/aura-1', {
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
