/**
 * Chat Page JavaScript
 * - Voice recording
 * - Message display
 * - Audio playback
 * - Video (lip-sync) display
 */

class VoiceChat {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.selectedVoiceId = null;
    
    this.init();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  async init() {
    await this.loadVoiceProfiles();
    this.render();
    this.loadHistory();
  }

  render() {
    const container = document.getElementById('chat-container');
    container.innerHTML = `
      <div class="space-y-4">
        <!-- Voice Profile Selector -->
        <div class="flex items-center space-x-2">
          <label class="font-medium">音声プロファイル:</label>
          <select id="voice-select" class="px-3 py-2 border rounded-lg">
            <option value="">デフォルト</option>
          </select>
        </div>

        <!-- Messages Container -->
        <div id="messages" class="space-y-4 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
          <p class="text-gray-500 text-center">会話を開始してください</p>
        </div>

        <!-- Input Area -->
        <div class="flex flex-col space-y-2">
          <!-- Text Input -->
          <div class="flex space-x-2">
            <input type="text" id="text-input" placeholder="テキストで入力..." 
                   class="flex-1 px-4 py-2 border rounded-lg">
            <button id="send-text-btn" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>

          <!-- Voice Input -->
          <div class="flex items-center space-x-2">
            <button id="record-btn" class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center">
              <i class="fas fa-microphone mr-2"></i>
              <span id="record-text">音声録音</span>
            </button>
            <span id="record-status" class="text-sm text-gray-500"></span>
          </div>
        </div>

        <!-- Status -->
        <div id="status" class="text-sm text-gray-600"></div>
      </div>
    `;

    this.attachEventListeners();
  }

  async loadVoiceProfiles() {
    try {
      const response = await fetch('/api/admin/voices');
      const data = await response.json();

      if (data.success && data.voices.length > 0) {
        const select = document.getElementById('voice-select');
        if (select) {
          data.voices
            .filter(v => v.is_active)
            .forEach(voice => {
              const option = document.createElement('option');
              option.value = voice.id;
              option.textContent = voice.name;
              select.appendChild(option);
            });

          select.addEventListener('change', (e) => {
            this.selectedVoiceId = e.target.value || null;
          });
        }
      }
    } catch (error) {
      console.error('Failed to load voice profiles:', error);
    }
  }

  attachEventListeners() {
    // Text send
    document.getElementById('send-text-btn').addEventListener('click', () => {
      this.sendTextMessage();
    });

    document.getElementById('text-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendTextMessage();
      }
    });

    // Voice recording
    document.getElementById('record-btn').addEventListener('click', () => {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });
  }

  async sendTextMessage() {
    const input = document.getElementById('text-input');
    const text = input.value.trim();

    if (!text) return;

    input.value = '';
    this.showStatus('送信中...');

    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('session_id', this.sessionId);
      if (this.selectedVoiceId) {
        formData.append('voice_profile_id', this.selectedVoiceId);
      }

      const response = await fetch('/api/chat/message', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        this.addMessage('user', text);
        this.addMessage('assistant', data.message.content, data.message.audio_url, data.message.video_url);
        this.showStatus('');
      } else {
        this.showStatus(`エラー: ${data.error}`, 'error');
      }
    } catch (error) {
      this.showStatus(`エラー: ${error.message}`, 'error');
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        this.audioChunks.push(event.data);
      });

      this.mediaRecorder.addEventListener('stop', () => {
        this.sendAudioMessage();
      });

      this.mediaRecorder.start();
      this.isRecording = true;

      document.getElementById('record-btn').classList.add('bg-red-700');
      document.getElementById('record-text').textContent = '停止';
      document.getElementById('record-status').textContent = '録音中...';
    } catch (error) {
      this.showStatus(`マイクアクセスエラー: ${error.message}`, 'error');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;

      document.getElementById('record-btn').classList.remove('bg-red-700');
      document.getElementById('record-text').textContent = '音声録音';
      document.getElementById('record-status').textContent = '';
    }
  }

  async sendAudioMessage() {
    this.showStatus('音声処理中...');

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('session_id', this.sessionId);
      if (this.selectedVoiceId) {
        formData.append('voice_profile_id', this.selectedVoiceId);
      }

      const response = await fetch('/api/chat/message', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        this.addMessage('user', '[音声入力]');
        this.addMessage('assistant', data.message.content, data.message.audio_url, data.message.video_url);
        this.showStatus('');
      } else {
        this.showStatus(`エラー: ${data.error}`, 'error');
      }
    } catch (error) {
      this.showStatus(`エラー: ${error.message}`, 'error');
    }
  }

  addMessage(role, content, audioUrl = null, videoUrl = null) {
    const messagesDiv = document.getElementById('messages');
    
    // Remove placeholder
    if (messagesDiv.children.length === 1 && messagesDiv.children[0].textContent.includes('会話を開始')) {
      messagesDiv.innerHTML = '';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = role === 'user' 
      ? 'flex justify-end' 
      : 'flex justify-start';

    let mediaContent = '';
    if (audioUrl) {
      mediaContent += `
        <audio controls class="mt-2 w-full max-w-md">
          <source src="/api/chat/audio/${audioUrl.split('/').pop()}" type="audio/mpeg">
        </audio>
      `;
    }
    if (videoUrl) {
      mediaContent += `
        <video controls class="mt-2 w-full max-w-md rounded-lg">
          <source src="${videoUrl}" type="video/mp4">
        </video>
      `;
    }

    messageDiv.innerHTML = `
      <div class="max-w-md px-4 py-2 rounded-lg ${
        role === 'user' 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-200 text-gray-800'
      }">
        <p class="whitespace-pre-wrap">${content}</p>
        ${mediaContent}
      </div>
    `;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async loadHistory() {
    try {
      const response = await fetch(`/api/chat/history/${this.sessionId}`);
      const data = await response.json();

      if (data.success && data.messages.length > 0) {
        data.messages.forEach(msg => {
          this.addMessage(msg.role, msg.content, msg.audio_url, msg.video_url);
        });
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `text-sm ${
      type === 'error' ? 'text-red-600' : 'text-gray-600'
    }`;
  }
}

// Initialize chat
let voiceChat;

document.addEventListener('DOMContentLoaded', () => {
  voiceChat = new VoiceChat();
});
