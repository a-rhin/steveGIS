// GitHub Storage Integration for Portfolio

const GITHUB_CONFIG = {
  username: 'a-rhin',  // Hard-coded: Your GitHub username
  repo: 'portfolio-uploads',  // Hard-coded: Your repo name
  token: '',
  branch: 'main'
};

let isGitHubConfigured = false;
let githubWorks = []; // Store works data

// Load saved config from sessionStorage or localStorage (for admin token only)
function loadGitHubConfig() {
  let token = sessionStorage.getItem('githubToken');  // Check session first (from login)
  if (!token) {
    const savedConfig = localStorage.getItem('githubConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      token = config.token;
    }
  }
  if (token) {
    GITHUB_CONFIG.token = token;
    isGitHubConfigured = true;
    console.log('✅ Loaded GitHub token (for admin)');
    return true;
  }
  return false;
}

// No separate setup—handled in login

// Test GitHub connection (called if needed)
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
    alert('GitHub token not set. Please log in as admin again.');
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
let isLoadingWorks = false; // Prevent duplicate loads

async function loadFromGitHub() {
  // Prevent multiple simultaneous loads
  if (isLoadingWorks) {
    console.log('⏳ Already loading works, skipping duplicate call');
    return;
  }
  
  isLoadingWorks = true;
  const worksGrid = document.getElementById('worksGrid');

  try {
    worksGrid.innerHTML = `
      <div class="empty-state">
        <i class='bx bx-loader-alt bx-spin'></i>
        <h3>Loading works...</h3>
      </div>
    `;

    // Check if admin is authenticated (from script.js)
    const isAdmin = typeof isAdminAuthenticated !== 'undefined' && isAdminAuthenticated;

    // Fetch without token for public access, with cache-buster
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    // Only add token if admin is authenticated AND token exists
    if (isAdmin && GITHUB_CONFIG.token) {
      headers['Authorization'] = `token ${GITHUB_CONFIG.token}`;
    }

    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/works${cacheBuster}`,
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
    const seenTitles = new Set(); // Track titles to prevent duplicates

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        try {
          const fileResponse = await fetch(`${file.download_url}?t=${Date.now()}`);
          const workData = await fileResponse.json();
          
          // Create unique identifier from title and upload date
          const uniqueKey = `${workData.title.toLowerCase().trim()}_${workData.uploadDate}`;
          
          // Skip if we've already loaded this exact work
          if (seenTitles.has(uniqueKey)) {
            console.log(`⚠️ Skipping duplicate: ${workData.title}`);
            continue;
          }
          
          seenTitles.add(uniqueKey);
          workData.sha = file.sha;      // For delete
          workData.filePath = file.path; // For delete
          githubWorks.push(workData);
        } catch (error) {
          console.error('Error loading work file:', error);
        }
      }
    }

    // Remove exact duplicates based on title and description
    githubWorks = githubWorks.filter((work, index, self) =>
      index === self.findIndex((w) => 
        w.title.toLowerCase().trim() === work.title.toLowerCase().trim() &&
        w.description.toLowerCase().trim() === work.description.toLowerCase().trim()
      )
    );

    githubWorks.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    console.log(`📊 Loaded ${githubWorks.length} unique works from ${files.length} files`);

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
    const renderTime = Date.now(); // Unique identifier for this render
    
    githubWorks.forEach((work, index) => {
      // Better preview for different file types
      let previewSrc;
      let previewStyle;
      
      if (work.isImage) {
        previewSrc = work.base64Data;
        previewStyle = 'object-fit: cover;';
      } else if (work.fileType === 'application/pdf') {
        // PDF icon with better styling
        previewSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJwZGZHcmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZmY0ZDRkO3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ZmNmU2ZTtzdG9wLW9wYWNpdHk6MSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNwZGZHcmFkKSIvPjx0ZXh0IHg9IjUwJSIgeT0iNDAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNjAiIGZpbGw9IiNmZmYiIGZvbnQtd2VpZ2h0PSJib2xkIj5QREY8L3RleHQ+PHRleHQgeD0iNTAlIiB5PSI2NSUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjgpIj5DbGljayB0byBWaWV3PC90ZXh0Pjwvc3ZnPg==';
        previewStyle = 'object-fit: contain; background: linear-gradient(135deg, #ff4d4d 0%, #ff6e6e 100%);';
      } else if (work.fileType.includes('word') || work.fileType.includes('document')) {
        // Word document icon
        previewSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJkb2NHcmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMjk3MmJjO3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzQwOGZkZjtzdG9wLW9wYWNpdHk6MSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNkb2NHcmFkKSIvPjx0ZXh0IHg9IjUwJSIgeT0iNDAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNTAiIGZpbGw9IiNmZmYiIGZvbnQtd2VpZ2h0PSJib2xkIj5ET0M8L3RleHQ+PHRleHQgeD0iNTAlIiB5PSI2NSUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjgpIj5DbGljayB0byBWaWV3PC90ZXh0Pjwvc3ZnPg==';
        previewStyle = 'object-fit: contain; background: linear-gradient(135deg, #2972bc 0%, #408fdf 100%);';
      } else {
        // Generic file icon
        previewSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJmaWxlR3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzZjYzRmNztzdG9wLW9wYWNpdHk6MSIgLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM1NmE3ZjI7c3RvcC1vcGFjaXR5OjEiIC8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9InVybCgjZmlsZUdyYWQpIi8+PHRleHQgeD0iNTAlIiB5PSI0MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI1MCIgZmlsbD0iI2ZmZiIgZm9udC13ZWlnaHQ9ImJvbGQiPkZJTEU8L3RleHQ+PHRleHQgeD0iNTAlIiB5PSI2NSUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjgpIj5DbGljayB0byBEb3dubG9hZDwvdGV4dD48L3N2Zz4=';
        previewStyle = 'object-fit: contain; background: linear-gradient(135deg, #6cc4f7 0%, #56a7f2 100%);';
      }

      // Check if admin is currently authenticated for delete button
      const showDelete = typeof isAdminAuthenticated !== 'undefined' && isAdminAuthenticated && GITHUB_CONFIG.token;

      // Truncate long descriptions
      const maxDescLength = 120;
      const truncatedDesc = work.description.length > maxDescLength 
        ? work.description.substring(0, maxDescLength) + '...' 
        : work.description;
      const needsReadMore = work.description.length > maxDescLength;
      
      // Create unique IDs with timestamp
      const uniqueId = `${renderTime}-${index}`;

      worksHTML += `
        <div class="work-item work-item-${index}" data-type="${work.type}">
          <img src="${previewSrc}" alt="${work.title}" onclick="viewGitHubWork(${index})" style="width: 100%; height: 250px; ${previewStyle} cursor: pointer;">
          <div class="work-item-content">
            <h3 onclick="viewGitHubWork(${index})" style="cursor: pointer;">${work.title}</h3>
            <div class="work-description">
              <span id="short-${uniqueId}">${truncatedDesc}</span>
              ${needsReadMore ? `
                <span id="full-${uniqueId}" style="display: none;">${work.description}</span>
                <br>
                <a href="javascript:void(0)" id="btn-${uniqueId}" onclick="toggleDescription('${uniqueId}')" style="color: #6cc4f7; text-decoration: none; cursor: pointer; font-size: 13px; font-weight: 600; padding: 5px 0; margin-top: 5px; display: inline-block;">
                  Read more →
                </a>
              ` : ''}
            </div>
            <span class="work-item-type">${work.type}</span>
            <div class="work-actions">
              <button onclick="viewGitHubWork(${index})">
                <i class='bx bx-show'></i> View
              </button>
              <button onclick="downloadGitHubWork(${index})">
                <i class='bx bx-download'></i> Download
              </button>
              ${showDelete ? `
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
    console.log('Works array:', githubWorks.map(w => w.title)); // Debug: show all titles

  } catch (error) {
    console.error('Failed to load works from GitHub:', error);
    worksGrid.innerHTML = `
      <div class="empty-state">
        <i class='bx bx-error'></i>
        <h3>Error loading works</h3>
        <p>Please check GitHub configuration</p>
      </div>
    `;
  } finally {
    isLoadingWorks = false; // Reset loading flag
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
  
  // Check if mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (work.isImage) {
    modalBody.innerHTML = `
      <button class="modal-close" onclick="closeModal()">&times;</button>
      <img src="${work.base64Data}" alt="${work.fileName}" style="max-width: 100%; height: auto;">
      <h3 style="color: #6cc4f7; margin-top: 20px;">${work.title}</h3>
      <p style="color: rgba(255,255,255,0.7); margin-top: 10px;">${work.fileName}</p>
    `;
  } else if (work.fileType === 'application/pdf') {
    // Convert base64 to blob URL for PDF viewing
    try {
      // Extract base64 data (remove data:application/pdf;base64, prefix)
      const base64Data = work.base64Data.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      
      // Same experience for all devices - cleaner and more consistent
      modalBody.innerHTML = `
        <button class="modal-close" onclick="closeModal(); URL.revokeObjectURL('${blobUrl}')">&times;</button>
        <div style="text-align: center; padding: 30px;">
          <div style="background: linear-gradient(135deg, #ff4d4d 0%, #ff6e6e 100%); border-radius: 15px; padding: 60px 30px; margin: 20px 0; box-shadow: 0 10px 30px rgba(255, 77, 77, 0.3);">
            <i class='bx bx-file-pdf' style="font-size: 80px; color: #fff; margin-bottom: 15px; display: block;"></i>
            <p style="color: #fff; font-size: 20px; font-weight: 600;">PDF Document</p>
          </div>
          <h3 style="color: #6cc4f7; margin: 25px 0 15px; font-size: 24px;">${work.title}</h3>
          <p style="color: rgba(255,255,255,0.8); margin: 15px auto; font-size: 15px; line-height: 1.6; max-width: 600px;">${work.description}</p>
          <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 20px 0;">
            📄 ${work.fileName}<br>
            💾 ${(work.fileSize / 1024 / 1024).toFixed(2)}MB • ${isMobile ? 'Mobile' : 'Desktop'} View
          </p>
          <div style="margin-top: 30px; display: flex; ${isMobile ? 'flex-direction: column;' : ''} gap: 15px; justify-content: center; max-width: 500px; margin-left: auto; margin-right: auto;">
            <a href="${blobUrl}" target="_blank" 
               style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 15px 35px; background: #56a7f2; color: #fff; border-radius: 10px; text-decoration: none; font-family: 'Poppins', sans-serif; font-weight: 600; transition: all 0.3s ease; flex: 1; box-shadow: 0 4px 15px rgba(86, 167, 242, 0.3);">
              <i class='bx bx-show' style="font-size: 20px;"></i> Open PDF in New Tab
            </a>
            <button onclick="downloadGitHubWork(${index})" 
                    style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 15px 35px; background: rgba(255,255,255,0.1); border: 2px solid #56a7f2; color: #fff; border-radius: 10px; cursor: pointer; font-family: 'Poppins', sans-serif; font-weight: 600; transition: all 0.3s ease; flex: 1;">
              <i class='bx bx-download' style="font-size: 20px;"></i> Download PDF
            </button>
          </div>
          <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin-top: 25px; font-style: italic;">
            💡 Opens in new tab with full PDF viewer controls
          </p>
        </div>
      `;
    } catch (error) {
      console.error('Error displaying PDF:', error);
      modalBody.innerHTML = `
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <div style="text-align: center; padding: 40px;">
          <i class='bx bx-file-blank' style="font-size: 64px; color: #ff4d4d; margin-bottom: 20px;"></i>
          <h3 style="color: #6cc4f7; margin-bottom: 20px;">${work.title}</h3>
          <p style="color: rgba(255,255,255,0.8); margin-bottom: 10px;">Cannot preview this PDF in browser</p>
          <p style="color: rgba(255,255,255,0.6); margin-bottom: 30px; font-size: 14px;">
            ${work.description}
          </p>
          <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 20px;">
            📄 ${work.fileName} • ${(work.fileSize / 1024 / 1024).toFixed(2)}MB
          </p>
          <button onclick="downloadGitHubWork(${index})" 
                  style="padding: 12px 30px; background: #56a7f2; border: none; color: #fff; border-radius: 8px; cursor: pointer; font-family: 'Poppins', sans-serif; font-weight: 600;">
            <i class='bx bx-download'></i> Download PDF to View
          </button>
        </div>
      `;
    }
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
window.uploadToGitHub = uploadToGitHub;
window.loadFromGitHub = loadFromGitHub;
window.viewGitHubWork = viewGitHubWork;
window.downloadGitHubWork = downloadGitHubWork;
window.deleteGitHubWork = deleteGitHubWork;

// Toggle description read more/less
window.toggleDescription = function(uniqueId) {
  console.log('Toggle called for uniqueId:', uniqueId);
  
  const descShort = document.getElementById(`short-${uniqueId}`);
  const descFull = document.getElementById(`full-${uniqueId}`);
  const btn = document.getElementById(`btn-${uniqueId}`);
  
  console.log('Elements found:', {descShort, descFull, btn});
  
  if (!descShort || !descFull || !btn) {
    console.error(`Cannot find elements for uniqueId ${uniqueId}`);
    return;
  }
  
  if (descFull.style.display === 'none' || descFull.style.display === '') {
    console.log('Expanding description for:', uniqueId);
    descShort.style.display = 'none';
    descFull.style.display = 'inline';
    btn.innerHTML = 'Read less ↑';
  } else {
    console.log('Collapsing description for:', uniqueId);
    descShort.style.display = 'inline';
    descFull.style.display = 'none';
    btn.innerHTML = 'Read more →';
  }
};

// Enable GitHub mode (if needed)
window.useGitHubMode = function() {
  console.log('☁️ Switching to GitHub storage mode');
  const storageMode = document.getElementById('storageMode');
  if (storageMode) storageMode.textContent = 'GitHub';
  window.uploadWork = uploadToGitHub;
  window.loadWorks = loadFromGitHub;
  loadFromGitHub();
};

// Console log
console.log(`
☁️ GITHUB STORAGE READY
========================
Commands:
useGitHubMode() = Setup GitHub
cleanDuplicates() = Remove duplicate works

Benefits:
✅ Free unlimited storage
✅ Version control
✅ Easy file management
✅ Accessible anywhere

Setup Required (for admin only):
Personal access token during login

Max: 100MB per file
========================
`);

// Admin function to clean duplicates
window.cleanDuplicates = async function() {
  if (!isAdminAuthenticated || !GITHUB_CONFIG.token) {
    alert('Please login as admin first (Press F9)');
    return;
  }
  
  if (!confirm('This will scan for and remove duplicate works. Continue?')) {
    return;
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/works`,
      {
        headers: {
          'Authorization': `token ${GITHUB_CONFIG.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch works');
    }
    
    const files = await response.json();
    const seenWorks = new Map(); // title+description -> file info
    const duplicates = [];
    
    // Load all works and identify duplicates
    for (const file of files) {
      if (file.name.endsWith('.json')) {
        const fileResponse = await fetch(file.download_url);
        const workData = await fileResponse.json();
        const key = `${workData.title}_${workData.description}`;
        
        if (seenWorks.has(key)) {
          // This is a duplicate - keep the newer one
          const existing = seenWorks.get(key);
          const existingDate = new Date(existing.workData.uploadDate);
          const currentDate = new Date(workData.uploadDate);
          
          if (currentDate > existingDate) {
            // Current is newer, mark old one for deletion
            duplicates.push(existing.file);
            seenWorks.set(key, { workData, file });
          } else {
            // Existing is newer, mark current for deletion
            duplicates.push(file);
          }
        } else {
          seenWorks.set(key, { workData, file });
        }
      }
    }
    
    if (duplicates.length === 0) {
      alert('✅ No duplicates found!');
      return;
    }
    
    console.log(`Found ${duplicates.length} duplicate(s)`);
    
    // Delete duplicates
    let deleted = 0;
    for (const file of duplicates) {
      try {
        const deleteResponse = await fetch(
          `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/${file.path}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `token ${GITHUB_CONFIG.token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: 'Remove duplicate work',
              sha: file.sha,
              branch: GITHUB_CONFIG.branch
            })
          }
        );
        
        if (deleteResponse.ok) {
          deleted++;
          console.log(`Deleted duplicate: ${file.name}`);
        }
      } catch (error) {
        console.error(`Failed to delete ${file.name}:`, error);
      }
    }
    
    alert(`✅ Cleaned up ${deleted} duplicate(s)!`);
    loadFromGitHub(); // Reload works
    
  } catch (error) {
    console.error('Cleanup failed:', error);
    alert('Cleanup failed: ' + error.message);
  }
};