/**
 * OpenAI API Service
 * - STT (Whisper)
 * - Embeddings (text-embedding-3-small)
 * - LLM (GPT-4)
 */

export class OpenAIService {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  /**
   * Transcribe audio to text using Whisper API
   */
  async transcribe(audioBlob: Blob, language: string = 'ja'): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', language);

    const response = await fetch(`${this.baseURL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OpenAI Whisper API error: ${response.statusText}`);
    }

    const data = await response.json() as { text: string };
    return data.text;
  }

  /**
   * Generate embeddings for text
   */
  async createEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Embeddings API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Generate chat completion with RAG context
   */
  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    ragContext?: string
  ): Promise<string> {
    const systemMessage = ragContext
      ? {
          role: 'system',
          content: `あなたは親切なAIアシスタントです。以下の参考情報を基に、ユーザーの質問に答えてください。\n\n参考情報:\n${ragContext}`,
        }
      : {
          role: 'system',
          content: 'あなたは親切なAIアシスタントです。',
        };

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Chat API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
