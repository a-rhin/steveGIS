// Global variables
let isAdminAuthenticated = false;

// Check session on page load
document.addEventListener('DOMContentLoaded', function() {
  // Check if admin was authenticated in this session
  const sessionAuth = sessionStorage.getItem('adminAuthenticated');
  if (sessionAuth === 'true') {
    isAdminAuthenticated = true;
    console.log('🔐 Admin session restored');
  }

  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', function(e) {
      logoClickCount++;
      
      if (logoClickTimer) clearTimeout(logoClickTimer);
      
      if (logoClickCount >= 5) {
        e.preventDefault();
        logoClickCount = 0;
        if (!isAdminAuthenticated) {
          showAdminLogin();
        } else {
          toggleAdminPanel();
        }
        return;
      }
      
      logoClickTimer = setTimeout(() => {
        logoClickCount = 0;
      }, 2000);
    });
  }

  // Method 3: Double-click the footer
  const footer = document.querySelector('footer');
  if (footer) {
    footer.addEventListener('dblclick', function() {
      if (!isAdminAuthenticated) {
        showAdminLogin();
      } else {
        toggleAdminPanel();
      }
    });
  }

  // Initialize file input handler
  initFileInputHandler();
  
  // Load works on page load
  loadWorks();
});

// ===== ADMIN ACCESS METHODS =====

// Method 1: F9 key for admin access
document.addEventListener('keydown', function(e) {
  if (e.key === 'F9') {
    e.preventDefault();
    console.log('🔑 F9 Admin key pressed');
    
    if (!isAdminAuthenticated) {
      console.log('🔐 Showing admin login');
      showAdminLogin();
    } else {
      console.log('🎛️ Toggling admin panel');
      toggleAdminPanel();
    }
    return;
  }
  
  // Ctrl+Shift+A (Windows) or Cmd+Shift+A (Mac)
  if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key === 'A') {
    e.preventDefault();
    if (!isAdminAuthenticated) {
      showAdminLogin();
    } else {
      toggleAdminPanel();
    }
  }
});

// Method 2: Click the logo 5 times quickly
let logoClickCount = 0;
let logoClickTimer = null;

// Method 4: Type "admin" anywhere on the page
let typedKeys = '';
document.addEventListener('keypress', function(e) {
  if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    typedKeys += e.key.toLowerCase();
    
    if (typedKeys.length > 10) {
      typedKeys = typedKeys.slice(-10);
    }
    
    if (typedKeys.includes('admin')) {
      typedKeys = '';
      if (!isAdminAuthenticated) {
        showAdminLogin();
      } else {
        toggleAdminPanel();
      }
    }
  }
});

// Method 5: Console command
window.openAdmin = function() {
  if (!isAdminAuthenticated) {
    showAdminLogin();
  } else {
    toggleAdminPanel();
  }
};

// ===== ADMIN FUNCTIONS =====

function showAdminLogin() {
  const password = prompt("Enter admin password:");
  console.log('Password prompt shown');
  
  if (password === "admin123") {
    isAdminAuthenticated = true;
    sessionStorage.setItem('adminAuthenticated', 'true'); // Store in session
    console.log('✅ Admin authenticated successfully');
    
    // Prompt for GitHub token after password
    const token = prompt("Enter GitHub Personal Access Token (for uploads/deletes):");
    if (token) {
      sessionStorage.setItem('githubToken', token);  // Store in sessionStorage for this session
      console.log('✅ GitHub token set for this session');
      // Update GITHUB_CONFIG.token if github_storage.js is loaded
      if (typeof GITHUB_CONFIG !== 'undefined') {
        GITHUB_CONFIG.token = token;
        isGitHubConfigured = true;
      }
      // Refresh works to show delete button
      if (typeof loadFromGitHub === 'function') {
        loadFromGitHub();
      }
    } else {
      alert("Token not entered. Uploads/deletes disabled for this session.");
    }
    
    toggleAdminPanel();
  } else if (password !== null) {
    alert("Incorrect password!");
    console.log('❌ Incorrect password entered');
  } else {
    console.log('🚫 Password prompt cancelled');
  }
}

// Logout function for security
function logoutAdmin() {
  isAdminAuthenticated = false;
  sessionStorage.removeItem('adminAuthenticated');
  sessionStorage.removeItem('githubToken');
  if (typeof GITHUB_CONFIG !== 'undefined') {
    GITHUB_CONFIG.token = '';
    isGitHubConfigured = false;
  }
  console.log('🔒 Admin logged out');
  
  // Reload works to hide delete buttons
  if (typeof loadFromGitHub === 'function') {
    loadFromGitHub();
  }
  
  // Close admin panel
  const panel = document.getElementById('adminPanel');
  if (panel && panel.classList.contains('open')) {
    toggleAdminPanel();
  }
  
  alert('✅ Logged out successfully!');
}

function toggleAdminPanel() {
  const panel = document.getElementById('adminPanel');
  
  if (!panel) {
    console.error('❌ Cannot find admin panel element!');
    alert('Admin panel not found in HTML!');
    return;
  }
  
  console.log('🎛️ Toggling admin panel');
  
  if (panel.classList.contains('open')) {
    console.log('🔒 Hiding admin panel');
    panel.classList.remove('open');
    panel.style.right = '-100%';
    setTimeout(() => {
      panel.style.display = 'none';
    }, 400);
  } else {
    console.log('🔓 Showing admin panel');
    panel.style.display = 'block';
    setTimeout(() => {
      panel.style.right = '0px';
      panel.classList.add('open');
    }, 10);
    updateDashboard();
  }
}

function initFileInputHandler() {
  const fileInput = document.getElementById('workFile');
  const fileLabel = document.getElementById('fileLabel');
  
  if (fileInput && fileLabel) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        fileLabel.textContent = file.name;
        console.log('🔎 File selected:', file.name);
      } else {
        fileLabel.textContent = 'Choose File (PNG, JPG, PDF, DOC)';
      }
    });
  }
}

// Default upload function
async function uploadWork(event) {
  event.preventDefault();
  alert('Please select a storage option first:\n\n• GitHub (Recommended)\n• Browser Storage (Local)');
}

function updateDashboard() {
  const visitCount = localStorage.getItem('siteVisits') || '0';
  const visitCountElement = document.getElementById('visitCount');
  if (visitCountElement) {
    visitCountElement.textContent = visitCount;
  }
  
  localStorage.setItem('siteVisits', parseInt(visitCount) + 1);
}

// Updated load works function to attempt GitHub first
function loadWorks() {
  // Attempt GitHub first
  if (typeof loadFromGitHub === 'function') {
    loadFromGitHub();
  } else {
    const worksGrid = document.getElementById('worksGrid');
    if (worksGrid) {
      worksGrid.innerHTML = `
        <div class="empty-state">
          <i class='bx bx-folder-open'></i>
          <h3>No works uploaded yet</h3>
          <p>Choose a storage option to start uploading!</p>
          <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button onclick="useGitHubMode()" style="padding: 10px 20px; background: #333; border: none; color: #fff; border-radius: 5px; cursor: pointer; font-family: 'Poppins', sans-serif;">
              <i class='bx bxl-github'></i> GitHub
            </button>
            <button onclick="useAlternativeStorage()" style="padding: 10px 20px; background: #56a7f2; border: none; color: #fff; border-radius: 5px; cursor: pointer; font-family: 'Poppins', sans-serif;">
              <i class='bx bx-hdd'></i> Browser Storage
            </button>
          </div>
        </div>
      `;
    }
  }
}

// ===== BROWSER STORAGE ALTERNATIVE =====

window.useAlternativeStorage = function() {
  console.log('💾 Switching to browser storage');
  
  const storageMode = document.getElementById('storageMode');
  if (storageMode) storageMode.textContent = 'Browser Storage';
  
  window.uploadWork = async function(event) {
    event.preventDefault();
    
    const title = document.getElementById('workTitle').value.trim();
    const description = document.getElementById('workDescription').value.trim();
    const type = document.getElementById('workType').value;
    const file = document.getElementById('workFile').files[0];

    if (!file) {
      alert('Please select a file to upload.');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max 5MB for browser storage.`);
      return;
    }

    const uploadBtn = event.target.querySelector('.upload-btn');
    const originalText = uploadBtn.innerHTML;
    
    try {
      uploadBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Processing...';
      uploadBtn.disabled = true;

      const base64 = await fileToBase64(file);
      
      const workData = {
        id: Date.now(),
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

      const existingWorks = JSON.parse(localStorage.getItem('portfolioWorks') || '[]');
      existingWorks.unshift(workData);
      
      if (existingWorks.length > 20) {
        existingWorks.splice(20);
      }
      
      localStorage.setItem('portfolioWorks', JSON.stringify(existingWorks));

      document.querySelector('.admin-form').reset();
      document.getElementById('fileLabel').textContent = 'Choose File (PNG, JPG, PDF, DOC)';
      toggleAdminPanel();

      alert('✅ Work uploaded successfully!');
      loadAlternativeWorks();

    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      uploadBtn.innerHTML = originalText;
      uploadBtn.disabled = false;
    }
  };

  window.loadWorks = loadAlternativeWorks;
  loadAlternativeWorks();
  
  alert('✅ Browser storage enabled!\n\nFiles stored locally in browser.');
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function loadAlternativeWorks() {
  const worksGrid = document.getElementById('worksGrid');
  const works = JSON.parse(localStorage.getItem('portfolioWorks') || '[]');

  if (works.length === 0) {
    worksGrid.innerHTML = `
      <div class="empty-state">
        <i class='bx bx-folder-open'></i>
        <h3>No works uploaded yet</h3>
        <p>Upload your first project!</p>
      </div>
    `;
    return;
  }

  let worksHTML = '';
  works.forEach(work => {
    const previewSrc = work.isImage ? work.base64Data : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEzIDJMMTMuMDkgMi4yNkwyMC4yMiA5LjY3TDIwLjc4IDEwLjIzTDIxIDExVjIwQTIgMiAwIDAgMSAxOSAyMkg1QTIgMiAwIDAgMSAzIDIwVjRDMiAyIDAgMCAxIDUgMkgxM1pNMTkgMTFIMTVBMiAyIDAgMCAxIDEzIDlWNUg1VjIwSDE5VjExWk0xNSA5SDE4LjVMMTUgNS41Vjlask0iIGZpbGw9IiM2Y2M0ZjciLz4KPHN2Zz4K';
    
    worksHTML += `
      <div class="work-item" data-type="${work.type}">
        <img src="${previewSrc}" alt="${work.title}" style="width: 100%; height: 250px; object-fit: ${work.isImage ? 'cover' : 'contain'}; background: ${work.isImage ? 'transparent' : 'rgba(108, 196, 247, 0.1)'};">
        <div class="work-item-content">
          <h3>${work.title}</h3>
          <p>${work.description}</p>
          <span class="work-item-type">${work.type}</span>
          <div style="margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.6);">
            📄 ${work.fileName} (${(work.fileSize / 1024 / 1024).toFixed(2)}MB)
            <br>💾 Stored in Browser
          </div>
          <div class="work-actions">
            <button onclick="viewAlternativeWork('${work.id}')">
              <i class='bx bx-show'></i> View
            </button>
            <button onclick="downloadAlternativeWork('${work.id}')">
              <i class='bx bx-download'></i> Download
            </button>
          </div>
        </div>
      </div>
    `;
  });

  worksGrid.innerHTML = worksHTML;
}

function viewAlternativeWork(workId) {
  const works = JSON.parse(localStorage.getItem('portfolioWorks') || '[]');
  const work = works.find(w => w.id == workId);
  
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
      <h3 style="color: #6cc4f7; margin-top: 20px;">${work.fileName}</h3>
    `;
  } else {
    modalBody.innerHTML = `
      <button class="modal-close" onclick="closeModal()">&times;</button>
      <div style="text-align: center; padding: 40px;">
        <i class='bx bx-file' style="font-size: 64px; color: #6cc4f7; margin-bottom: 20px;"></i>
        <h3 style="color: #6cc4f7; margin-bottom: 20px;">${work.fileName}</h3>
        <p style="color: rgba(255,255,255,0.8); margin-bottom: 30px;">
          File stored in browser. Click download to save it.
        </p>
        <button onclick="downloadAlternativeWork('${work.id}')" 
                style="padding: 12px 30px; background: #56a7f2; border: none; color: #fff; border-radius: 8px; cursor: pointer;">
          <i class='bx bx-download'></i> Download File
        </button>
      </div>
    `;
  }
  
  modal.classList.add('open');
}

function downloadAlternativeWork(workId) {
  const works = JSON.parse(localStorage.getItem('portfolioWorks') || '[]');
  const work = works.find(w => w.id == workId);
  
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

// ===== SHARED FUNCTIONS =====

// Mobile menu toggle
function toggleMenu() {
  const navbar = document.querySelector('.navbar');
  const menuToggle = document.querySelector('.menu-toggle');
  navbar.classList.toggle('active');
  menuToggle.classList.toggle('active');
}

function closeMenu() {
  const navbar = document.querySelector('.navbar');
  const menuToggle = document.querySelector('.menu-toggle');
  navbar.classList.remove('active');
  menuToggle.classList.remove('active');
}

function filterWorks(type) {
  const workItems = document.querySelectorAll('.work-item');
  const filterBtns = document.querySelectorAll('.filter-btn');
  
  filterBtns.forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  workItems.forEach(item => {
    if (type === 'all' || item.dataset.type === type) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

function closeModal() {
  document.getElementById('fileModal').classList.remove('open');
}

// ===== GLOBAL FUNCTION DECLARATIONS =====

window.uploadWork = uploadWork;
window.toggleAdminPanel = toggleAdminPanel;
window.showAdminLogin = showAdminLogin;
window.filterWorks = filterWorks;
window.closeModal = closeModal;
window.viewAlternativeWork = viewAlternativeWork;
window.downloadAlternativeWork = downloadAlternativeWork;
window.logoutAdmin = logoutAdmin;

console.log(`
🔧 PORTFOLIO LOADED
===================
Admin Access:
F9 = Open admin
Ctrl+Shift+A = Open admin
Click logo 5x = Open admin
Type "admin" = Open admin
Double-click footer = Open admin

Password: admin123

Storage Options:
📦 Browser Storage
☁️ GitHub Storage
===================
`);