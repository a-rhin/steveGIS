// GitHub Storage Integration for Portfolio

const GITHUB_CONFIG = {
  username: 'a-rhin',  // Hard-coded: Your GitHub username
  repo: 'portfolio-uploads',  // Hard-coded: Your repo name
  token: '',
  branch: 'main'
};

let isGitHubConfigured = false;
let githubWorks = []; // Store works data

// Load saved config from localStorage (for admin token only)
function loadGitHubConfig() {
  const savedConfig = localStorage.getItem('githubConfig');
  if (savedConfig) {
    const config = JSON.parse(savedConfig);
    GITHUB_CONFIG.token = config.token;  // Only load token for admin
    GITHUB_CONFIG.branch = config.branch || 'main';
    isGitHubConfigured = true;
    console.log('✅ Loaded GitHub token from localStorage (for admin)');
    return true;
  }
  return false;
}

// Setup GitHub credentials (for token only, since username/repo are hard-coded)
function setupGitHub() {
  const modal = document.createElement('div');
  modal.id = 'githubSetupModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); z-index: 3000; display: flex;
    align-items: center; justify-content: center;
  `;

  modal.innerHTML = `
    <div style="background: #11385f; padding: 40px; border-radius: 15px; max-width: 500px; width: 90%;">
      <h2 style="color: #6cc4f7; margin-bottom: 30px; text-align: center;">
        <i class='bx bxl-github' style="font-size: 32px;"></i><br>
        GitHub Setup (Token Only)
      </h2>

      <div style="margin-bottom: 20px;">
        <label style="display: block; color: #fff; margin-bottom: 8px; font-weight: 500;">
          Personal Access Token
        </label>
        <input type="password" id="githubToken" placeholder="ghp_xxxxxxxxxxxx"
               style="width: 100%; padding: 12px; border: 2px solid rgba(255,255,255,0.2);
                      border-radius: 8px; background: rgba(255,255,255,0.1); color: #fff;
                      font-family: 'Poppins', sans-serif;">
      </div>

      <p style="margin-bottom: 20px; color: rgba(255,255,255,0.8);">
        Username and repo are pre-configured. Enter token for uploads/deletes.
      </p>

      <div style="display: flex; gap: 15px;">
        <button onclick="saveGitHubConfig()"
                style="flex: 1; padding: 12px; background: linear-gradient(45deg, #56a7f2, #6cc4f7);
                       border: none; color: #fff; border-radius: 8px; font-weight: 600;
                       cursor: pointer; font-family: 'Poppins', sans-serif;">
          Save & Test
        </button>
        <button onclick="closeGitHubModal()"
                style="flex: 1; padding: 12px; background: transparent; border: 2px solid #6cc4f7;
                       color: #6cc4f7; border-radius: 8px; font-weight: 600; cursor: pointer;
                       font-family: 'Poppins', sans-serif;">
          Cancel
        </button>
      </div>

      <div style="margin-top: 20px; padding: 15px; background: rgba(108, 196, 247, 0.1);
                  border-radius: 8px; font-size: 13px; color: rgba(255,255,255,0.8);">
        <strong>How to get a Personal Access Token:</strong><br>
        1. Go to github.com → Settings → Developer settings<br>
        2. Click "Personal access tokens" → "Tokens (classic)"<br>
        3. Click "Generate new token (classic)"<br>
        4. Select scopes: <code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px;">repo</code><br>
        5. Copy token (starts with ghp_)<br><br>
        <strong>Notes:</strong><br>
        • Files stored as base64 in JSON<br>
        • Max 100MB per file (GitHub limit)
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// Save GitHub configuration (token only)
function saveGitHubConfig() {
  const token = document.getElementById('githubToken').value.trim();

  if (!token) {
    alert('Please enter your token');
    return;
  }

  GITHUB_CONFIG.token = token;

  // Save token to localStorage
  localStorage.setItem('githubConfig', JSON.stringify({
    token,
    branch: GITHUB_CONFIG.branch
  }));

  testGitHubConnection().then(success => {
    if (success) {
      alert('✅ GitHub connected successfully!');
      closeGitHubModal();

      const storageMode = document.getElementById('storageMode');
      if (storageMode) storageMode.textContent = 'GitHub';

      window.uploadWork = uploadToGitHub;
      window.loadWorks = loadFromGitHub;
      loadFromGitHub();
    } else {
      alert('❌ GitHub connection failed. Check your credentials.');
    }
  });
}

// Close GitHub modal
function closeGitHubModal() {
  const modal = document.getElementById('githubSetupModal');
  if (modal && modal.parentNode) {
    document.body.removeChild(modal);
  }
}

// Test GitHub connection
async function testGitHubConnection() {
  try {
    const response = await fetch(`https://api.github.com/user`, {
      headers: {
        'Authorization': `token ${GITHUB_CONFIG.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      console.error('GitHub auth failed:', response.status);
      return false;
    }

    const userData = await response.json();
    console.log('✅ GitHub authenticated as:', userData.login);

    await ensureRepoExists();
    isGitHubConfigured = true;
    return true;
  } catch (error) {
    console.error('GitHub connection test failed:', error);
    return false;
  }
}

// Ensure repository exists
async function ensureRepoExists() {
  try {
    const checkResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`,
      {
        headers: {
          'Authorization': `token ${GITHUB_CONFIG.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (checkResponse.ok) {
      console.log('✅ Repository exists');
      return true;
    }

    if (checkResponse.status === 404) {
      console.log('📦 Creating repository...');

      const createResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_CONFIG.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: GITHUB_CONFIG.repo,
          description: 'Portfolio works and projects storage',
          private: false,
          auto_init: true
        })
      });

      if (createResponse.ok) {
        console.log('✅ Repository created successfully');
        return true;
      } else {
        console.error('Failed to create repo');
        return false;
      }
    }

    return false;
  } catch (error) {
    console.error('Error ensuring repo exists:', error);
    return false;
  }
}

// Upload work to GitHub
async function uploadToGitHub(event) {
  event.preventDefault();
  console.log('📤 GitHub upload started');

  if (!isGitHubConfigured || !GITHUB_CONFIG.token) {
    alert('Please configure GitHub token first');
    setupGitHub();
    return;
  }

  const title = document.getElementById('workTitle').value.trim();
  const description = document.getElementById('workDescription').value.trim();
  const type = document.getElementById('workType').value;
  const file = document.getElementById('workFile').files[0];

  if (!file) {
    alert('Please select a file to upload.');
    return;
  }

  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    alert(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). GitHub max is 100MB.`);
    return;
  }

  const uploadBtn = event.target.querySelector('.upload-btn');
  const originalText = uploadBtn.innerHTML;

  try {
    uploadBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Uploading...';
    uploadBtn.disabled = true;

    const base64 = await fileToBase64(file);

    const workData = {
      id: Date.now().toString(),
      title,
      description,
      type,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      isImage: file.type.startsWith('image/'),
      uploadDate: new Date().toISOString(),
      base64Data: base64
    };

    const timestamp = Date.now();
    const filePath = `works/${timestamp}.json`;

    const uploadResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_CONFIG.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Add work: ${title}`,
          content: btoa(unescape(encodeURIComponent(JSON.stringify(workData, null, 2)))),
          branch: GITHUB_CONFIG.branch
        })
      }
    );

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    console.log('✅ Upload successful to GitHub');

    document.querySelector('.admin-form').reset();
    document.getElementById('fileLabel').textContent = 'Choose File (PNG, JPG, PDF, DOC)';
    toggleAdminPanel();
    loadFromGitHub();

    alert('✅ Work uploaded to GitHub successfully!');

  } catch (error) {
    console.error('GitHub upload failed:', error);
    alert('Upload failed: ' + error.message);
  } finally {
    uploadBtn.innerHTML = originalText;
    uploadBtn.disabled = false;
  }
}

// Load works from GitHub (always attempts load with hard-coded repo, public access)
async function loadFromGitHub() {
  const worksGrid = document.getElementById('worksGrid');

  try {
    worksGrid.innerHTML = `
      <div class="empty-state">
        <i class='bx bx-loader-alt bx-spin'></i>
        <h3>Loading works...</h3>
      </div>
    `;

    // Fetch without token for public access
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    // Only add token if available (for admin rate limits)
    if (GITHUB_CONFIG.token) {
      headers['Authorization'] = `token ${GITHUB_CONFIG.token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/works`,
      { headers }
    );

    if (response.status === 404) {
      worksGrid.innerHTML = `
        <div class="empty-state">
          <i class='bx bx-folder-open'></i>
          <h3>No works uploaded yet</h3>
          <p>Upload your first project to GitHub!</p>
        </div>
      `;
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch works');
    }

    const files = await response.json();
    githubWorks = [];

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        try {
          const fileResponse = await fetch(file.download_url);
          const workData = await fileResponse.json();
          workData.sha = file.sha;      // For delete
          workData.filePath = file.path; // For delete
          githubWorks.push(workData);
        } catch (error) {
          console.error('Error loading work file:', error);
        }
      }
    }

    githubWorks.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    if (githubWorks.length === 0) {
      worksGrid.innerHTML = `
        <div class="empty-state">
          <i class='bx bx-folder-open'></i>
          <h3>No works uploaded yet</h3>
          <p>Upload your first project to GitHub!</p>
        </div>
      `;
      return;
    }

    let worksHTML = '';
    githubWorks.forEach((work, index) => {
      const previewSrc = work.isImage ? work.base64Data : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEzIDJMMTMuMDkgMi4yNkwyMC4yMiA5LjY3TDIwLjc4IDEwLjIzTDIxIDExVjIwQTIgMiAwIDAgMSAxOSAyMkg1QTIgMiAwIDAgMSAzIDIwVjRDMiAyIDAgMCAxIDUgMkgxM1pNMTkgMTFIMTVBMiAyIDAgMCAxIDEzIDlWNUg1VjIwSDE5VjExWk0xNSA5SDE4LjVMMTUgNS41Vjlask0iIGZpbGw9IiM2Y2M0ZjciLz4KPHN2Zz4K';

      worksHTML += `
        <div class="work-item" data-type="${work.type}">
          <img src="${previewSrc}" alt="${work.title}" style="width: 100%; height: 250px; object-fit: ${work.isImage ? 'cover' : 'contain'}; background: ${work.isImage ? 'transparent' : 'rgba(108, 196, 247, 0.1)'};">
          <div class="work-item-content">
            <h3>${work.title}</h3>
            <p>${work.description}</p>
            <span class="work-item-type">${work.type}</span>
            <div style="margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.6);">
              📁 ${work.fileName} (${(work.fileSize / 1024 / 1024).toFixed(2)}MB)
              <br>☁️ Stored on GitHub
            </div>
            <div class="work-actions">
              <button onclick="viewGitHubWork(${index})">
                <i class='bx bx-show'></i> View
              </button>
              <button onclick="downloadGitHubWork(${index})">
                <i class='bx bx-download'></i> Download
              </button>
              ${GITHUB_CONFIG.token ? `
                <button onclick="deleteGitHubWork(${index})" style="background: #ff4d4d; border-color: #ff4d4d; color: #fff;">
                  <i class='bx bx-trash'></i> Delete
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    });

    worksGrid.innerHTML = worksHTML;
    console.log(`✅ Loaded ${githubWorks.length} works from GitHub`);

  } catch (error) {
    console.error('Failed to load works from GitHub:', error);
    worksGrid.innerHTML = `
      <div class="empty-state">
        <i class='bx bx-error'></i>
        <h3>Error loading works</h3>
        <p>Please check GitHub configuration</p>
      </div>
    `;
  }
}

// View GitHub work
function viewGitHubWork(index) {
  const work = githubWorks[index];
  
  if (!work) {
    alert('Work not found');
    return;
  }

  const modal = document.getElementById('fileModal');
  const modalBody = document.getElementById('modalBody');

  if (work.isImage) {
    modalBody.innerHTML = `
      <button class="modal-close" onclick="closeModal()">&times;</button>
      <img src="${work.base64Data}" alt="${work.fileName}" style="max-width: 100%; height: auto;">
      <h3 style="color: #6cc4f7; margin-top: 20px;">${work.title}</h3>
      <p style="color: rgba(255,255,255,0.7); margin-top: 10px;">${work.fileName}</p>
    `;
  } else {
    modalBody.innerHTML = `
      <button class="modal-close" onclick="closeModal()">&times;</button>
      <div style="text-align: center; padding: 40px;">
        <i class='bx bx-file' style="font-size: 64px; color: #6cc4f7; margin-bottom: 20px;"></i>
        <h3 style="color: #6cc4f7; margin-bottom: 20px;">${work.title}</h3>
        <p style="color: rgba(255,255,255,0.8); margin-bottom: 10px;">${work.fileName}</p>
        <p style="color: rgba(255,255,255,0.6); margin-bottom: 30px; font-size: 14px;">
          ${work.description}
        </p>
        <button onclick="downloadGitHubWork(${index})" 
                style="padding: 12px 30px; background: #56a7f2; border: none; color: #fff; border-radius: 8px; cursor: pointer; font-family: 'Poppins', sans-serif;">
          <i class='bx bx-download'></i> Download File
        </button>
      </div>
    `;
  }

  modal.classList.add('open');
}

// Download GitHub work
function downloadGitHubWork(index) {
  const work = githubWorks[index];
  
  if (!work) {
    alert('Work not found');
    return;
  }

  const link = document.createElement('a');
  link.href = work.base64Data;
  link.download = work.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Delete GitHub work
async function deleteGitHubWork(index) {
  const work = githubWorks[index];
  if (!work || !work.filePath || !work.sha) {
    alert('Work not found or missing delete info');
    return;
  }

  if (!confirm(`Are you sure you want to delete "${work.title}"?`)) {
    return;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${work.filePath}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${GITHUB_CONFIG.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Delete work: ${work.title}`,
          sha: work.sha,
          branch: GITHUB_CONFIG.branch
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Delete failed: ${errorData.message || response.status}`);
    }

    console.log('✅ Work deleted from GitHub');
    alert('✅ Work deleted successfully!');
    loadFromGitHub(); // Reload the works list

  } catch (error) {
    console.error('GitHub delete failed:', error);
    alert('Delete failed: ' + error.message);
  }
}

// Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('☁️ GitHub Storage Integration Loaded');
  
  // Load token if saved (for admin)
  loadGitHubConfig();
  
  // Always set GitHub as default and load works
  const storageMode = document.getElementById('storageMode');
  if (storageMode) storageMode.textContent = 'GitHub';
  window.uploadWork = uploadToGitHub;
  window.loadWorks = loadFromGitHub;
  loadFromGitHub();
});

// Global functions
window.setupGitHub = setupGitHub;
window.saveGitHubConfig = saveGitHubConfig;
window.closeGitHubModal = closeGitHubModal;
window.uploadToGitHub = uploadToGitHub;
window.loadFromGitHub = loadFromGitHub;
window.viewGitHubWork = viewGitHubWork;
window.downloadGitHubWork = downloadGitHubWork;
window.deleteGitHubWork = deleteGitHubWork;

// Enable GitHub mode
window.useGitHubMode = function() {
  console.log('☁️ Switching to GitHub storage mode');
  setupGitHub();
};

console.log(`
☁️ GITHUB STORAGE READY
========================
Commands:
useGitHubMode() = Setup GitHub

Benefits:
✅ Free unlimited storage
✅ Version control
✅ Easy file management
✅ Accessible anywhere

Setup Required (for admin only):
Personal access token

Max: 100MB per file
========================
`);