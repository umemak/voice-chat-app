/**
 * Cloudflare Workers AI LLM Service
 * - Chat completion using Workers AI models
 * - Supports multiple LLM models including Japanese
 */

import type { CloudflareLLMModel } from '../types';

export class CloudflareLLMService {
  private ai: any;
  private model: CloudflareLLMModel;

  constructor(ai: any, model: CloudflareLLMModel = '@cf/openai/gpt-oss-120b') {
    this.ai = ai;
    this.model = model;
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

    try {
      const response = await this.ai.run(this.model, {
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 500,
      });

      // Handle different response formats
      if (typeof response === 'string') {
        return response;
      }
      
      if (response.response) {
        return response.response;
      }
      
      if (response.text) {
        return response.text;
      }

      if (response.choices && response.choices.length > 0) {
        return response.choices[0].message.content;
      }

      console.error('[CloudflareLLM] Unexpected response format:', response);
      throw new Error('Unexpected response format from Workers AI');
    } catch (error) {
      console.error('[CloudflareLLM] Error:', error);
      throw new Error(`Cloudflare Workers AI LLM error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get model display name
   */
  static getModelDisplayName(model: CloudflareLLMModel): string {
    const modelNames: Record<CloudflareLLMModel, string> = {
      '@cf/openai/gpt-oss-120b': 'GPT OSS 120B',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 'Llama 3.3 70B',
      '@cf/meta/llama-3.1-8b-instruct-fast': 'Llama 3.1 8B',
      '@cf/qwen/qwen2.5-72b-instruct-fp8': 'Qwen 2.5 72B',
      '@cf/google/gemma-2-9b-it-lora': 'Gemma 2 9B',
    };
    return modelNames[model] || model;
  }

  /**
   * Get model information
   */
  static getModelInfo(model: CloudflareLLMModel): {
    name: string;
    description: string;
    japaneseSupport: boolean;
    contextLength: number;
  } {
    const modelInfo: Record<CloudflareLLMModel, {
      name: string;
      description: string;
      japaneseSupport: boolean;
      contextLength: number;
    }> = {
      '@cf/openai/gpt-oss-120b': {
        name: 'GPT OSS 120B',
        description: '最新の大規模モデル、高品質・日本語対応',
        japaneseSupport: true,
        contextLength: 8192,
      },
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast': {
        name: 'Llama 3.3 70B',
        description: '高品質、日本語対応、高速',
        japaneseSupport: true,
        contextLength: 8192,
      },
      '@cf/meta/llama-3.1-8b-instruct-fast': {
        name: 'Llama 3.1 8B',
        description: '軽量・高速、日本語対応',
        japaneseSupport: true,
        contextLength: 8192,
      },
      '@cf/qwen/qwen2.5-72b-instruct-fp8': {
        name: 'Qwen 2.5 72B',
        description: '日本語特化、高品質',
        japaneseSupport: true,
        contextLength: 32768,
      },
      '@cf/google/gemma-2-9b-it-lora': {
        name: 'Gemma 2 9B',
        description: 'Google製、軽量',
        japaneseSupport: true,
        contextLength: 8192,
      },
    };
    return modelInfo[model];
  }
}
