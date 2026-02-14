/**
 * ElevenLabs API Service
 * - Voice Cloning
 * - Text-to-Speech with custom voices
 */

export class ElevenLabsService {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string = 'https://api.elevenlabs.io/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * Generate speech from text using a specific voice
   */
  async textToSpeech(
    text: string,
    voiceId: string,
    modelId: string = 'eleven_multilingual_v2'
  ): Promise<ArrayBuffer> {
    const response = await fetch(`${this.baseURL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs TTS API error: ${response.statusText} - ${errorText}`);
    }

    return await response.arrayBuffer();
  }

  /**
   * Get all available voices
   */
  async getVoices(): Promise<any[]> {
    const response = await fetch(`${this.baseURL}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs Voices API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices;
  }

  /**
   * Clone a voice from audio samples
   */
  async cloneVoice(
    name: string,
    description: string,
    audioFiles: Blob[]
  ): Promise<string> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);

    audioFiles.forEach((file, index) => {
      formData.append('files', file, `sample_${index}.mp3`);
    });

    const response = await fetch(`${this.baseURL}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs Voice Clone API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.voice_id;
  }

  /**
   * Delete a cloned voice
   */
  async deleteVoice(voiceId: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs Delete Voice API error: ${response.statusText}`);
    }
  }
}
