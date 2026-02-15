/**
 * Cloudflare Workers AI TTS Service
 * - Text-to-Speech using Cloudflare Workers AI
 * - No external API key required
 * - Good for testing and development
 */

export class CloudflareTTSService {
  private ai: any;

  constructor(ai: any) {
    this.ai = ai;
  }

  /**
   * Generate speech from text using Workers AI
   * Uses @cf/deepgram/aura-1 model (via Workers AI partnership)
   */
  async textToSpeech(text: string): Promise<ArrayBuffer> {
    try {
      // Using Deepgram Aura via Workers AI
      const response = await this.ai.run('@cf/deepgram/aura-1', {
        text: text,
      });

      // Workers AI returns audio as ArrayBuffer
      if (response instanceof ArrayBuffer) {
        return response;
      } else if (response.audio) {
        return response.audio;
      }

      throw new Error('Unexpected response format from Workers AI TTS');
    } catch (error) {
      console.error('[CloudflareTTS] Error:', error);
      throw new Error(`Cloudflare TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available voices (currently Workers AI has limited voice options)
   */
  async getVoices(): Promise<string[]> {
    // Workers AI currently supports Deepgram Aura with default voice
    return ['default'];
  }
}
