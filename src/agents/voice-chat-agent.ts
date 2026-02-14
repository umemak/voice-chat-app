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
import type { Bindings } from '../types';
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
   */
  async init(
    agentId: string,
    meetingId: string,
    authToken: string,
    workerUrl: string,
    accountId: string,
    apiToken: string,
    voiceId?: string
  ) {
    console.log(`[Agent] Initializing agent ${agentId} for meeting ${meetingId}`);

    // Create RAG text processor
    this.textProcessor = new RAGTextProcessor(this.env);

    // Create RealtimeKit transport for audio I/O
    const rtkTransport = new RealtimeKitTransport(meetingId, authToken);

    // Get default or custom voice ID
    const ttsVoiceId = voiceId || await this.getDefaultVoiceId();

    // Build pipeline: Transport → STT → TextProcessor → TTS → Transport
    await this.initPipeline(
      [
        rtkTransport,
        new DeepgramSTT(this.env.DEEPGRAM_API_KEY),
        this.textProcessor,
        new ElevenLabsTTS(this.env.ELEVENLABS_API_KEY, ttsVoiceId),
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
