/**
 * Realtime Chat Frontend
 * - Uses Cloudflare RealtimeKit SDK for WebRTC
 * - Manages voice chat connection
 * - Handles agent initialization
 */

class RealtimeVoiceChat {
  constructor() {
    this.meetingId = null;
    this.authToken = null;
    this.agentId = null;
    this.selectedVoiceId = null;
    this.selectedTTSProvider = 'cloudflare'; // Default to Cloudflare TTS
    this.selectedCloudflareTTSModel = '@cf/deepgram/aura-2-en'; // Default model
    this.isConnected = false;

    this.init();
  }

  async init() {
    await this.loadVoiceProfiles();
    this.attachEventListeners();
  }

  async loadVoiceProfiles() {
    try {
      const response = await fetch('/api/admin/voices');
      const data = await response.json();

      if (data.success && data.voices.length > 0) {
        const select = document.getElementById('voice-select');
        data.voices
          .filter(v => v.is_active)
          .forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.voice_id;
            option.textContent = voice.name;
            select.appendChild(option);
          });

        select.addEventListener('change', (e) => {
          this.selectedVoiceId = e.target.value || null;
        });
      }
    } catch (error) {
      console.error('Failed to load voice profiles:', error);
    }
  }

  attachEventListeners() {
    document.getElementById('connect-btn').addEventListener('click', () => {
      this.connect();
    });

    document.getElementById('disconnect-btn').addEventListener('click', () => {
      this.disconnect();
    });

    // TTS provider selection
    document.getElementById('tts-provider-select').addEventListener('change', (e) => {
      this.selectedTTSProvider = e.target.value;
      
      // Show/hide sections based on TTS provider
      const cloudflareModelSection = document.getElementById('cloudflare-model-section');
      const voiceSection = document.getElementById('voice-profile-section');
      
      if (this.selectedTTSProvider === 'elevenlabs') {
        cloudflareModelSection.classList.add('hidden');
        voiceSection.classList.remove('hidden');
      } else {
        cloudflareModelSection.classList.remove('hidden');
        voiceSection.classList.add('hidden');
      }
    });

    // Cloudflare TTS model selection
    document.getElementById('cloudflare-model-select').addEventListener('change', (e) => {
      this.selectedCloudflareTTSModel = e.target.value;
    });
  }

  async connect() {
    try {
      this.updateStatus('接続中...', 'connecting');

      // Step 1: Create RealtimeKit meeting
      // For now, we'll use a simplified approach
      // In production, you'd call RealtimeKit API to create a meeting
      
      // Generate a meeting ID (in production, this comes from RealtimeKit dashboard)
      this.meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // For demonstration purposes, we'll show instructions
      this.showRealtimeKitInstructions();

    } catch (error) {
      console.error('Connection error:', error);
      this.updateStatus('接続エラー', 'error');
      alert(`接続エラー: ${error.message}`);
    }
  }

  showRealtimeKitInstructions() {
    const container = document.querySelector('.max-w-4xl');
    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = 'bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-4';
    instructionsDiv.innerHTML = `
      <h3 class="text-lg font-bold mb-3 text-yellow-800">
        <i class="fas fa-info-circle mr-2"></i>
        RealtimeKit セットアップが必要です
      </h3>
      <p class="text-gray-700 mb-4">
        リアルタイム音声チャットを使用するには、以下の手順が必要です：
      </p>
      <ol class="list-decimal list-inside space-y-2 text-gray-700 mb-4">
        <li>
          <a href="https://dash.realtime.cloudflare.com/dashboard" 
             target="_blank" 
             class="text-blue-600 hover:underline">
            RealtimeKit Dashboard
          </a>
          にアクセス
        </li>
        <li>「Create Meeting」をクリックして新しいミーティングを作成</li>
        <li>「Join」ボタンからミーティングIDとAuthTokenを取得</li>
        <li>以下のフォームに入力してエージェントを起動</li>
      </ol>

      <div class="bg-white p-4 rounded border space-y-3">
        <div>
          <label class="block text-sm font-medium mb-1">Meeting ID:</label>
          <input type="text" id="meeting-id-input" 
                 class="w-full px-3 py-2 border rounded" 
                 placeholder="例: bbbb2fac-953c-4239-9ba8-75ba912d76fc">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Auth Token:</label>
          <input type="text" id="auth-token-input" 
                 class="w-full px-3 py-2 border rounded" 
                 placeholder="例: eyJ...">
        </div>
        <button id="start-agent-btn" 
                class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          <i class="fas fa-robot mr-2"></i>
          AIエージェントを起動
        </button>
      </div>

      <div class="mt-4 p-3 bg-blue-50 rounded">
        <p class="text-sm text-blue-800">
          <i class="fas fa-lightbulb mr-1"></i>
          <strong>ヒント:</strong> 
          別のブラウザタブで同じミーティングに参加すると、AIエージェントと会話できます。
        </p>
      </div>
    `;

    container.appendChild(instructionsDiv);

    // Hide connect button, show disconnect
    document.getElementById('connect-btn').classList.add('hidden');
    document.getElementById('disconnect-btn').classList.remove('hidden');

    // Attach event listener for agent start
    document.getElementById('start-agent-btn').addEventListener('click', () => {
      this.startAgent();
    });

    this.updateStatus('セットアップ待機中', 'waiting');
  }

  async startAgent() {
    try {
      const meetingId = document.getElementById('meeting-id-input').value.trim();
      const authToken = document.getElementById('auth-token-input').value.trim();

      if (!meetingId || !authToken) {
        alert('Meeting IDとAuth Tokenを入力してください');
        return;
      }

      this.meetingId = meetingId;
      this.authToken = authToken;

      this.updateStatus('エージェント起動中...', 'connecting');

      // Prepare request body
      const requestBody = {
        meetingId: this.meetingId,
        authToken: this.authToken,
        ttsProvider: this.selectedTTSProvider,
      };

      // Add provider-specific options
      if (this.selectedTTSProvider === 'elevenlabs' && this.selectedVoiceId) {
        requestBody.voiceId = this.selectedVoiceId;
      } else if (this.selectedTTSProvider === 'cloudflare') {
        requestBody.cloudflareTTSModel = this.selectedCloudflareTTSModel;
      }

      // Call agent init API
      const response = await fetch('/api/agent/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        this.agentId = data.agentId;
        this.isConnected = true;
        
        let providerInfo = '';
        if (data.ttsProvider === 'cloudflare') {
          const modelName = this.getModelDisplayName(data.cloudflareTTSModel);
          providerInfo = `Cloudflare Workers AI (${modelName})`;
        } else {
          providerInfo = 'ElevenLabs';
        }
        
        this.updateStatus(`接続成功 - AIエージェントが会話に参加しました（TTS: ${providerInfo}）`, 'connected');

        // Show success message
        alert(`AIエージェントが起動しました！\nTTS: ${providerInfo}\n\nRealtimeKitのミーティングに参加して話しかけてください。`);
      } else {
        throw new Error(data.error || 'Agent initialization failed');
      }
    } catch (error) {
      console.error('Agent start error:', error);
      this.updateStatus('起動エラー', 'error');
      alert(`エージェント起動エラー: ${error.message}`);
    }
  }

  getModelDisplayName(modelId) {
    const modelNames = {
      '@cf/deepgram/aura-2-en': 'Aura 2 EN',
      '@cf/deepgram/aura-1': 'Aura 1 EN',
      '@cf/deepgram/aura-2-es': 'Aura 2 ES',
      '@cf/myshell-ai/melotts': 'MeloTTS',
    };
    return modelNames[modelId] || modelId;
  }

  async disconnect() {
    try {
      if (this.meetingId && this.isConnected) {
        this.updateStatus('切断中...', 'disconnecting');

        await fetch('/api/agent/deinit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meetingId: this.meetingId,
          }),
        });
      }

      this.isConnected = false;
      this.meetingId = null;
      this.authToken = null;
      this.agentId = null;

      this.updateStatus('切断しました', 'disconnected');

      // Show connect button, hide disconnect
      document.getElementById('connect-btn').classList.remove('hidden');
      document.getElementById('disconnect-btn').classList.add('hidden');

      // Remove instructions if present
      const instructions = document.querySelector('.bg-yellow-50');
      if (instructions) {
        instructions.remove();
      }

      this.updateStatus('未接続', 'idle');
    } catch (error) {
      console.error('Disconnect error:', error);
      this.updateStatus('切断エラー', 'error');
    }
  }

  updateStatus(text, state) {
    const statusText = document.getElementById('status-text');
    const statusIcon = statusText.previousElementSibling;

    statusText.textContent = text;

    // Update icon color based on state
    statusIcon.classList.remove('text-gray-400', 'text-yellow-500', 'text-green-500', 'text-red-500', 'text-blue-500');
    
    switch (state) {
      case 'connecting':
      case 'disconnecting':
      case 'waiting':
        statusIcon.classList.add('text-yellow-500');
        break;
      case 'connected':
        statusIcon.classList.add('text-green-500');
        break;
      case 'error':
        statusIcon.classList.add('text-red-500');
        break;
      case 'idle':
      default:
        statusIcon.classList.add('text-gray-400');
        break;
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  new RealtimeVoiceChat();
});
