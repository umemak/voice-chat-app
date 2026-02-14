/**
 * Admin Page JavaScript
 * - Document management
 * - Voice profile management
 */

// Document Manager
class DocumentManager {
  constructor() {
    this.container = document.getElementById('document-manager');
    this.init();
  }

  async init() {
    await this.loadDocuments();
    this.renderUploadForm();
  }

  renderUploadForm() {
    const uploadSection = document.createElement('div');
    uploadSection.className = 'mb-6';
    uploadSection.innerHTML = `
      <h3 class="font-semibold mb-2">ファイルアップロード</h3>
      <form id="upload-form" class="space-y-3">
        <div class="flex items-center space-x-2">
          <input type="file" id="file-input" accept=".txt,.pptx,.pdf" 
                 class="flex-1 px-3 py-2 border rounded-lg" required>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <i class="fas fa-upload mr-1"></i>アップロード
          </button>
        </div>
        <p class="text-sm text-gray-500">対応形式: .txt, .pptx, .pdf</p>
        <div id="upload-status" class="text-sm"></div>
      </form>
    `;

    this.container.insertBefore(uploadSection, this.container.firstChild);

    document.getElementById('upload-form').addEventListener('submit', (e) => {
      this.handleUpload(e);
    });
  }

  async handleUpload(e) {
    e.preventDefault();

    const fileInput = document.getElementById('file-input');
    const statusDiv = document.getElementById('upload-status');
    const file = fileInput.files[0];

    if (!file) return;

    statusDiv.innerHTML = '<p class="text-blue-600">アップロード中...</p>';

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        statusDiv.innerHTML = '<p class="text-green-600">✓ アップロード成功</p>';
        fileInput.value = '';
        await this.loadDocuments();

        // If not processed, allow manual text input
        if (data.document && !data.document.processed) {
          this.showTextInputDialog(data.document.id);
        }
      } else {
        statusDiv.innerHTML = `<p class="text-red-600">✗ エラー: ${data.error}</p>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<p class="text-red-600">✗ エラー: ${error.message}</p>`;
    }
  }

  showTextInputDialog(documentId) {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <h3 class="text-lg font-bold mb-4">テキストコンテンツを入力</h3>
        <p class="text-sm text-gray-600 mb-4">
          PowerPointやPDFから抽出したテキストを貼り付けてください。
        </p>
        <textarea id="text-content" rows="10" 
                  class="w-full px-3 py-2 border rounded-lg mb-4"
                  placeholder="テキストを入力..."></textarea>
        <div class="flex justify-end space-x-2">
          <button id="cancel-btn" class="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400">
            キャンセル
          </button>
          <button id="process-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            処理開始
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#cancel-btn').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    dialog.querySelector('#process-btn').addEventListener('click', async () => {
      const text = document.getElementById('text-content').value;
      if (!text.trim()) {
        alert('テキストを入力してください');
        return;
      }

      try {
        const response = await fetch(`/api/admin/process/${documentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        const data = await response.json();
        if (data.success) {
          alert('処理完了しました');
          document.body.removeChild(dialog);
          await this.loadDocuments();
        } else {
          alert(`エラー: ${data.error}`);
        }
      } catch (error) {
        alert(`エラー: ${error.message}`);
      }
    });
  }

  async loadDocuments() {
    try {
      const response = await fetch('/api/admin/documents');
      const data = await response.json();

      if (data.success) {
        this.renderDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }

  renderDocuments(documents) {
    const listDiv = document.createElement('div');
    listDiv.id = 'document-list';
    listDiv.className = 'space-y-2';

    if (documents.length === 0) {
      listDiv.innerHTML = '<p class="text-gray-500">まだドキュメントがありません</p>';
    } else {
      listDiv.innerHTML = documents.map(doc => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div class="flex-1">
            <p class="font-medium">${doc.original_filename}</p>
            <p class="text-sm text-gray-500">
              ${(doc.file_size / 1024).toFixed(1)} KB · 
              ${doc.processed ? '✓ 処理済み' : '未処理'}
            </p>
          </div>
          <button onclick="documentManager.deleteDocument(${doc.id})" 
                  class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `).join('');
    }

    const existingList = this.container.querySelector('#document-list');
    if (existingList) {
      existingList.replaceWith(listDiv);
    } else {
      this.container.appendChild(listDiv);
    }
  }

  async deleteDocument(id) {
    if (!confirm('このドキュメントを削除しますか？')) return;

    try {
      const response = await fetch(`/api/admin/documents/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        await this.loadDocuments();
      } else {
        alert(`エラー: ${data.error}`);
      }
    } catch (error) {
      alert(`エラー: ${error.message}`);
    }
  }
}

// Voice Manager
class VoiceManager {
  constructor() {
    this.container = document.getElementById('voice-manager');
    this.init();
  }

  async init() {
    await this.loadVoices();
    this.renderAddForm();
  }

  renderAddForm() {
    const formSection = document.createElement('div');
    formSection.className = 'mb-6';
    formSection.innerHTML = `
      <h3 class="font-semibold mb-2">音声プロファイル追加</h3>
      <form id="voice-form" class="space-y-3">
        <input type="text" id="voice-name" placeholder="プロファイル名" 
               class="w-full px-3 py-2 border rounded-lg" required>
        <input type="text" id="voice-id" placeholder="ElevenLabs Voice ID" 
               class="w-full px-3 py-2 border rounded-lg" required>
        <textarea id="voice-description" placeholder="説明（任意）" rows="2"
                  class="w-full px-3 py-2 border rounded-lg"></textarea>
        <button type="submit" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <i class="fas fa-plus mr-1"></i>追加
        </button>
        <div id="voice-status" class="text-sm"></div>
      </form>
    `;

    this.container.insertBefore(formSection, this.container.firstChild);

    document.getElementById('voice-form').addEventListener('submit', (e) => {
      this.handleAddVoice(e);
    });
  }

  async handleAddVoice(e) {
    e.preventDefault();

    const name = document.getElementById('voice-name').value;
    const voiceId = document.getElementById('voice-id').value;
    const description = document.getElementById('voice-description').value;
    const statusDiv = document.getElementById('voice-status');

    try {
      const response = await fetch('/api/admin/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, voice_id: voiceId, description }),
      });

      const data = await response.json();

      if (data.success) {
        statusDiv.innerHTML = '<p class="text-green-600">✓ 追加成功</p>';
        document.getElementById('voice-form').reset();
        await this.loadVoices();
      } else {
        statusDiv.innerHTML = `<p class="text-red-600">✗ エラー: ${data.error}</p>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<p class="text-red-600">✗ エラー: ${error.message}</p>`;
    }
  }

  async loadVoices() {
    try {
      const response = await fetch('/api/admin/voices');
      const data = await response.json();

      if (data.success) {
        this.renderVoices(data.voices);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
    }
  }

  renderVoices(voices) {
    const listDiv = document.createElement('div');
    listDiv.id = 'voice-list';
    listDiv.className = 'space-y-2';

    if (voices.length === 0) {
      listDiv.innerHTML = '<p class="text-gray-500">まだ音声プロファイルがありません</p>';
    } else {
      listDiv.innerHTML = voices.map(voice => `
        <div class="p-3 bg-gray-50 rounded-lg">
          <div class="flex items-center justify-between">
            <p class="font-medium">${voice.name}</p>
            <span class="text-xs px-2 py-1 rounded ${voice.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200'}">
              ${voice.is_active ? '有効' : '無効'}
            </span>
          </div>
          <p class="text-sm text-gray-500 mt-1">ID: ${voice.voice_id}</p>
          ${voice.description ? `<p class="text-sm mt-1">${voice.description}</p>` : ''}
        </div>
      `).join('');
    }

    const existingList = this.container.querySelector('#voice-list');
    if (existingList) {
      existingList.replaceWith(listDiv);
    } else {
      this.container.appendChild(listDiv);
    }
  }
}

// Initialize managers
let documentManager, voiceManager;

document.addEventListener('DOMContentLoaded', () => {
  documentManager = new DocumentManager();
  voiceManager = new VoiceManager();
});
