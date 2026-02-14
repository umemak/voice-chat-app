/**
 * D-ID API Service
 * - Lip-sync video generation from audio
 */

export class DIDService {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string = 'https://api.d-id.com') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * Create a talking avatar video from audio URL
   */
  async createTalk(
    audioUrl: string,
    sourceUrl?: string // Avatar image URL (optional, D-ID has defaults)
  ): Promise<string> {
    const requestBody: any = {
      script: {
        type: 'audio',
        audio_url: audioUrl,
      },
      config: {
        fluent: true,
        pad_audio: 0,
      },
    };

    if (sourceUrl) {
      requestBody.source_url = sourceUrl;
    } else {
      // Use D-ID default avatar
      requestBody.presenter_id = 'amy-jcwCkr1grs';
    }

    const response = await fetch(`${this.baseURL}/talks`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`D-ID Create Talk API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Get talk video status and result URL
   */
  async getTalk(talkId: string): Promise<{
    status: string;
    result_url?: string;
  }> {
    const response = await fetch(`${this.baseURL}/talks/${talkId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`D-ID Get Talk API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      status: data.status,
      result_url: data.result_url,
    };
  }

  /**
   * Wait for video generation to complete and return URL
   */
  async waitForTalk(talkId: string, maxWaitSeconds: number = 60): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      const talk = await this.getTalk(talkId);

      if (talk.status === 'done' && talk.result_url) {
        return talk.result_url;
      }

      if (talk.status === 'error') {
        throw new Error('D-ID video generation failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('D-ID video generation timeout');
  }

  /**
   * Delete a talk video
   */
  async deleteTalk(talkId: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/talks/${talkId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`D-ID Delete Talk API error: ${response.statusText}`);
    }
  }
}
