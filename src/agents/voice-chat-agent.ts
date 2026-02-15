/**
 * Voice Chat Agent - Cloudflare Realtime Agent
 * - Manages WebRTC connection via RealtimeKit
 * - Orchestrates STT → RAG → LLM → TTS pipeline
 * - Handles participant events
 */

import {
  RealtimeAgent,
  RealtimeKitTransport,
  DeepgramSTT,
  ElevenLabsTTS,
} from '@cloudflare/realtime-agents';
import type { DurableObjectState } from '@cloudflare/workers-types';
import type { 
  Bindings, 
  TTSProvider, 
  CloudflareTTSModel, 
  STTProvider, 
  CloudflareSTTModel,
  LLMProvider,
  CloudflareLLMModel
} from '../types';
import { RAGTextProcessor } from '../components/rag-text-processor';

export class VoiceChatAgent extends RealtimeAgent<Bindings> {
  private textProcessor?: RAGTextProcessor;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
  }

  /**
   * Initialize the agent and join a RealtimeKit meeting
   * 
   * @param agentId - Unique agent identifier
   * @param meetingId - RealtimeKit meeting ID
   * @param authToken - RealtimeKit authentication token
   * @param workerUrl - Worker URL for internal pipeline routing
   * @param accountId - Cloudflare account ID
   * @param apiToken - Cloudflare API token
   * @param voiceId - Optional ElevenLabs voice ID for custom voice
   * @param ttsProvider - TTS provider to use ('cloudflare' or 'elevenlabs')
   * @param cloudflareTTSModel - Cloudflare TTS model to use (if provider is 'cloudflare')
   * @param sttProvider - STT provider to use ('cloudflare' or 'deepgram')
   * @param cloudflareSTTModel - Cloudflare STT model to use (if provider is 'cloudflare')
   * @param llmProvider - LLM provider to use ('cloudflare' or 'openai')
   * @param cloudflareLLMModel - Cloudflare LLM model to use (if provider is 'cloudflare')
   */
  async init(
    agentId: string,
    meetingId: string,
    authToken: string,
    workerUrl: string,
    accountId: string,
    apiToken: string,
    voiceId?: string,
    ttsProvider: TTSProvider = 'cloudflare',
    cloudflareTTSModel: CloudflareTTSModel = '@cf/deepgram/aura-2-en',
    sttProvider: STTProvider = 'cloudflare',
    cloudflareSTTModel: CloudflareSTTModel = '@cf/openai/whisper-large-v3-turbo',
    llmProvider: LLMProvider = 'cloudflare',
    cloudflareLLMModel: CloudflareLLMModel = '@cf/openai/gpt-oss-120b'
  ) {
    console.log(`[Agent] Initializing agent ${agentId} for meeting ${meetingId}`);
    console.log(`[Agent] STT Provider: ${sttProvider}`);
    console.log(`[Agent] LLM Provider: ${llmProvider}`);
    console.log(`[Agent] TTS Provider: ${ttsProvider}`);

    // Create RAG text processor with LLM provider
    this.textProcessor = new RAGTextProcessor(this.env, llmProvider, cloudflareLLMModel);

    // Create RealtimeKit transport for audio I/O
    const rtkTransport = new RealtimeKitTransport(meetingId, authToken);

    // Note: Realtime Agents SDK only supports Deepgram STT and ElevenLabs TTS
    // For Cloudflare Workers AI STT/TTS, use HTTP mode (/http-chat)
    console.log('[Agent] Using Deepgram STT (Realtime Agents)');
    const sttComponent = new DeepgramSTT(this.env.DEEPGRAM_API_KEY);

    console.log('[Agent] Using ElevenLabs TTS (Realtime Agents)');
    const ttsVoiceId = voiceId || await this.getDefaultVoiceId();
    const ttsComponent = new ElevenLabsTTS(this.env.ELEVENLABS_API_KEY, ttsVoiceId);

    // Build pipeline: Transport → STT → TextProcessor → TTS → Transport
    await this.initPipeline(
      [
        rtkTransport,
        sttComponent,
        this.textProcessor,
        ttsComponent,
        rtkTransport,
      ],
      agentId,
      workerUrl,
      accountId,
      apiToken
    );

    const { meeting } = rtkTransport;

    // Register event handlers
    this.registerMeetingEvents(meeting);

    // Join the meeting
    await meeting.join();
    console.log(`[Agent] Successfully joined meeting ${meetingId}`);

    // Welcome message
    this.textProcessor.speak('こんにちは。AIアシスタントです。何かお手伝いできることはありますか？');
  }

  /**
   * Register handlers for meeting events
   */
  private registerMeetingEvents(meeting: any) {
    // Participant joined event
    meeting.participants.joined.on('participantJoined', (participant: any) => {
      console.log(`[Agent] Participant joined: ${participant.name}`);
      if (this.textProcessor) {
        this.textProcessor.speak(`${participant.name}さんが参加しました。`);
      }
    });

    // Participant left event
    meeting.participants.joined.on('participantLeft', (participant: any) => {
      console.log(`[Agent] Participant left: ${participant.name}`);
      if (this.textProcessor) {
        this.textProcessor.speak(`${participant.name}さんが退出しました。`);
      }
    });

    // Optional: Handle chat messages
    // meeting.chat.on('message', (message: any) => {
    //   console.log(`[Agent] Chat message: ${message.text}`);
    // });
  }

  /**
   * Get default voice ID from database or use fallback
   */
  private async getDefaultVoiceId(): Promise<string> {
    try {
      const voice = await this.env.DB.prepare(
        'SELECT voice_id FROM voice_profiles WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
      ).first<{ voice_id: string }>();

      if (voice) {
        console.log(`[Agent] Using voice profile: ${voice.voice_id}`);
        return voice.voice_id;
      }
    } catch (error) {
      console.warn('[Agent] Could not fetch voice profile:', error);
    }

    // Fallback to default ElevenLabs voice
    const defaultVoice = 'EXAVITQu4vr4xnSDxMaL'; // Sarah (default)
    console.log(`[Agent] Using default voice: ${defaultVoice}`);
    return defaultVoice;
  }

  /**
   * Clean up and leave the meeting
   */
  async deinit() {
    console.log('[Agent] Deinitializing agent');
    
    // Clear conversation history
    if (this.textProcessor) {
      this.textProcessor.clearHistory();
    }

    // Cleanup pipeline
    await this.deinitPipeline();
    
    console.log('[Agent] Agent deinitialized');
  }

  /**
   * Update voice profile during active session
   */
  async updateVoice(voiceId: string) {
    console.log(`[Agent] Updating voice to: ${voiceId}`);
    // This would require recreating the TTS component
    // For simplicity, we'll handle this in a future enhancement
    // For now, voice changes require reinitialization
  }
}
