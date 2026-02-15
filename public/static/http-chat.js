/**
 * HTTP-based Voice Chat Frontend
 * - Simple HTTP API implementation
 * - Uses Cloudflare Workers AI
 * - No WebRTC/RealtimeKit required
 */

class HTTPVoiceChat {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.sessionId = `session_${Date.now()}`;
    
    this.selectedSTTProvider = 'cloudflare';
    this.selectedSTTModel = '@cf/openai/whisper-large-v3-turbo';
    this.selectedLLMProvider = 'cloudflare';
    this.selectedLLMModel = '@cf/openai/gpt-oss-120b';
    this.selectedTTSProvider = 'cloudflare';
    this.selectedTTSModel = '@cf/deepgram/aura-2-en';

    this.init();
  }

  async init() {
    this.attachEventListeners();
    this.updateStatus('準備完了', 'ready');
  }

  attachEventListeners() {
    // STT Provider
    document.getElementById('http-stt-provider').addEventListener('change', (e) => {
      this.selectedSTTProvider = e.target.value;
      const modelSection = document.getElementById('http-stt-model-section');
      modelSection.classList.toggle('hidden', e.target.value !== 'cloudflare');
    });

    // STT Model
    document.getElementById('http-stt-model').addEventListener('change', (e) => {
      this.selectedSTTModel = e.target.value;
    });

    // LLM Provider
    document.getElementById('http-llm-provider').addEventListener('change', (e) => {
      this.selectedLLMProvider = e.target.value;
      const modelSection = document.getElementById('http-llm-model-section');
      modelSection.classList.toggle('hidden', e.target.value !== 'cloudflare');
    });

    // LLM Model
    document.getElementById('http-llm-model').addEventListener('change', (e) => {
      this.selectedLLMModel = e.target.value;
    });

    // TTS Provider
    document.getElementById('http-tts-provider').addEventListener('change', (e) => {
      this.selectedTTSProvider = e.target.value;
      const modelSection = document.getElementById('http-tts-model-section');
      modelSection.classList.toggle('hidden', e.target.value !== 'cloudflare');
    });

    // TTS Model
    document.getElementById('http-tts-model').addEventListener('change', (e) => {
      this.selectedTTSModel = e.target.value;
    });

    // Record button
    document.getElementById('record-btn').addEventListener('click', () => {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    // Clear chat
    document.getElementById('clear-chat-btn').addEventListener('click', () => {
      this.clearChat();
    });
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        await this.processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      
      document.getElementById('record-btn').innerHTML = '<i class="fas fa-stop mr-2"></i>停止';
      document.getElementById('record-btn').classList.remove('bg-blue-600', 'hover:bg-blue-700');
      document.getElementById('record-btn').classList.add('bg-red-600', 'hover:bg-red-700');
      
      this.updateStatus('録音中...', 'recording');
    } catch (error) {
      console.error('Recording error:', error);
      alert('マイクへのアクセスが拒否されました');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      document.getElementById('record-btn').innerHTML = '<i class="fas fa-microphone mr-2"></i>録音開始';
      document.getElementById('record-btn').classList.remove('bg-red-600', 'hover:bg-red-700');
      document.getElementById('record-btn').classList.add('bg-blue-600', 'hover:bg-blue-700');
      
      this.updateStatus('処理中...', 'processing');
    }
  }

  async processAudio(audioBlob) {
    try {
      // Convert audio to base64
      const audioBase64 = await this.blobToBase64(audioBlob);

      // Call API
      const response = await fetch('/api/chat-http/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: audioBase64.split(',')[1], // Remove data:audio/webm;base64, prefix
          sttProvider: this.selectedSTTProvider,
          sttModel: this.selectedSTTModel,
          llmProvider: this.selectedLLMProvider,
          llmModel: this.selectedLLMModel,
          sessionId: this.sessionId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Display user message
        this.addMessage('user', data.transcript);

        // Display assistant message
        this.addMessage('assistant', data.responseText);

        // Play audio response
        if (data.audioBase64) {
          await this.playAudio(data.audioBase64);
        }

        this.updateStatus('完了', 'ready');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Process error:', error);
      this.updateStatus('エラー', 'error');
      alert(`エラー: ${error.message}`);
    }
  }

  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async playAudio(base64Audio) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play();
    });
  }

  addMessage(role, content) {
    const messagesContainer = document.getElementById('messages-container');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = role === 'user' 
      ? 'flex justify-end mb-4'
      : 'flex justify-start mb-4';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = role === 'user'
      ? 'bg-blue-600 text-white px-4 py-2 rounded-lg max-w-md'
      : 'bg-gray-200 text-gray-800 px-4 py-2 rounded-lg max-w-md';

    bubbleDiv.textContent = content;
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  clearChat() {
    document.getElementById('messages-container').innerHTML = '';
    this.sessionId = `session_${Date.now()}`;
    this.updateStatus('準備完了', 'ready');
  }

  updateStatus(text, state) {
    const statusText = document.getElementById('http-status-text');
    const statusIcon = statusText.previousElementSibling;

    statusText.textContent = text;

    statusIcon.classList.remove('text-gray-400', 'text-blue-500', 'text-green-500', 'text-red-500', 'text-yellow-500');
    
    switch (state) {
      case 'recording':
        statusIcon.classList.add('text-red-500');
        break;
      case 'processing':
        statusIcon.classList.add('text-yellow-500');
        break;
      case 'ready':
        statusIcon.classList.add('text-green-500');
        break;
      case 'error':
        statusIcon.classList.add('text-red-500');
        break;
      default:
        statusIcon.classList.add('text-gray-400');
        break;
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  new HTTPVoiceChat();
});
