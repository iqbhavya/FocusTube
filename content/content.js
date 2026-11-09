console.log("[FocusTube] Content script initialized!");

let lastShortUrl = '';

function checkShortsQuota() {
  const currentUrl = window.location.href;
  const isShorts = window.location.pathname.startsWith('/shorts/');

  console.log(`[FocusTube] Path checked: ${window.location.pathname} | isShorts: ${isShorts}`);

  if (!isShorts) {
    return;
  }

  // Prevent duplicate triggers on the same Short
  if (currentUrl === lastShortUrl) {
    return;
  }
  lastShortUrl = currentUrl;

  const today = new Date().toISOString().slice(0, 10);
  const defaultLimit = 5;

  chrome.storage.local.get(['shortsData'], (result) => {
    let data = result.shortsData || { date: today, count: 0, limit: defaultLimit };

    if (data.date !== today) {
      data = { date: today, count: 0, limit: data.limit || defaultLimit };
    }

    if (data.count >= data.limit) {
      alert(`Daily limit of ${data.limit} Shorts reached. Back to study mode!`);
      window.location.href = 'https://www.youtube.com';
      return;
    }

    console.log(`[FocusTube] Watching Short. Quota timer started (3s)...`);

    setTimeout(() => {
      if (window.location.pathname.startsWith('/shorts/')) {
        chrome.storage.local.get(['shortsData'], (latest) => {
          let current = latest.shortsData || data;
          if (current.date !== today) {
            current = { date: today, count: 0, limit: current.limit || defaultLimit };
          }
          current.count += 1;
          chrome.storage.local.set({ shortsData: current }, () => {
            console.log(`[FocusTube] Shorts watched today: ${current.count} / ${current.limit}`);
          });
        });
      }
    }, 3000);
  });
}
// --- Helper Functions ---
function getActiveVideo() {
  return document.querySelector('video.html5-main-video') || document.querySelector('video');
}

function formatTime(seconds) {
  const totalSeconds = Math.floor(seconds || 0);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getVideoId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('v');
}

// --- 2. Study Drawer Injection & Interactions ---
let activeTimestamp = 0;

function injectStudyDrawer() {
  const isWatchPage = window.location.pathname.includes('/watch');
  const existingDrawer = document.getElementById('focustube-drawer');

  if (!isWatchPage) {
    if (existingDrawer) existingDrawer.remove();
    return;
  }

  if (existingDrawer) return;

  const drawer = document.createElement('div');
  drawer.id = 'focustube-drawer';
  
  // Explicit inline styles to ensure it cannot be hidden or collapsed
  drawer.style.cssText = `
    position: fixed !important;
    top: 70px !important;
    right: 20px !important;
    width: 320px !important;
    height: 480px !important;
    background-color: #181818 !important;
    color: #ffffff !important;
    border: 2px solid #3ea6ff !important;
    border-radius: 8px !important;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
    padding: 16px !important;
    box-sizing: border-box !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.8) !important;
  `;

  drawer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #333; padding-bottom:8px;">
      <h3 style="margin:0; color:#3ea6ff; font-size:16px;">FocusTube Notes</h3>
      <span style="background:#333; color:#aaa; font-size:11px; padding:2px 6px; border-radius:4px;">Study Mode</span>
    </div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span id="ft-current-time" style="background:#222; color:#3ea6ff; padding:2px 6px; border-radius:4px; font-family:monospace; font-weight:bold;">00:00</span>
        <span style="color:#777; font-size:11px;">Alt+N</span>
      </div>
      <textarea id="ft-note-input" placeholder="Take a note (Alt + N)..." style="width:100%; height:70px; background:#222; border:1px solid #444; border-radius:4px; color:#fff; padding:6px; resize:none; box-sizing:border-box; outline:none;"></textarea>
      <input type="text" id="ft-tags-input" placeholder="Tags: #dsa" style="width:100%; background:#222; border:1px solid #444; border-radius:4px; color:#fff; padding:6px; box-sizing:border-box; outline:none;" />
      <button id="ft-save-btn" style="background:#3ea6ff; color:#000; border:none; border-radius:4px; padding:6px; font-weight:bold; cursor:pointer;">Save Note</button>
    </div>
    <div id="ft-notes-list" style="flex:1; overflow-y:auto; margin-top:10px;"></div>
  `;

  // Attach directly to body
  document.body.appendChild(drawer);
  console.log('[FocusTube] Drawer appended with force styles!');

  bindDrawerEvents();
  renderNotesList();

}

function bindDrawerEvents() {
  const textarea = document.getElementById('ft-note-input');
  const timeDisplay = document.getElementById('ft-current-time');
  const saveBtn = document.getElementById('ft-save-btn');
  const tagsInput = document.getElementById('ft-tags-input');

  // 1. Auto-pause on focus, auto-resume on blur
  textarea.addEventListener('focus', () => {
    const video = getActiveVideo();
    if (video && !video.paused) {
      video.pause();
      textarea.dataset.wasPlaying = 'true';
    }
  });

  textarea.addEventListener('blur', () => {
    const video = getActiveVideo();
    if (video && textarea.dataset.wasPlaying === 'true') {
      video.play();
      textarea.dataset.wasPlaying = 'false';
    }
  });

  // 2. Hotkeys: Alt + N (Current) and Alt + Shift + N (-5s rewind)
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyN') {
      const video = getActiveVideo();
      if (!video) return;

      e.preventDefault();
      activeTimestamp = e.shiftKey ? Math.max(0, Math.floor(video.currentTime - 5)) : Math.floor(video.currentTime);
      timeDisplay.textContent = formatTime(activeTimestamp);
      textarea.focus();
    }
  });

  // 3. Save Note Handler
  saveBtn.addEventListener('click', () => {
    const content = textarea.value.trim();
    if (!content) return;

    const videoId = getVideoId();
    if (!videoId) return;

    const tags = tagsInput.value
      .split(' ')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const newNote = {
      id: Date.now().toString(),
      timestamp: activeTimestamp,
      timestampFormatted: formatTime(activeTimestamp),
      content: content,
      tags: tags,
      createdAt: Date.now()
    };

    chrome.storage.local.get([videoId], (res) => {
      const existing = res[videoId] || [];
      const updated = [...existing, newNote];
      chrome.storage.local.set({ [videoId]: updated }, () => {
        textarea.value = '';
        tagsInput.value = '';
        renderNotesList();
      });
    });
  });
}

function renderNotesList() {
  const list = document.getElementById('ft-notes-list');
  const videoId = getVideoId();
  if (!list || !videoId) return;

  chrome.storage.local.get([videoId], (res) => {
    const notes = res[videoId] || [];
    list.innerHTML = '';

    notes.sort((a, b) => a.timestamp - b.timestamp);

    notes.forEach((note) => {
      const item = document.createElement('div');
      item.style.cssText = `
        background: #222;
        padding: 8px;
        border-radius: 4px;
        border-left: 3px solid #3ea6ff;
        font-size: 12px;
      `;
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span class="ft-seek-btn" data-time="${note.timestamp}" style="color:#3ea6ff; cursor:pointer; font-weight:bold; font-family:monospace;">
            ${note.timestampFormatted}
          </span>
          <span style="color:#888;">${note.tags.join(' ')}</span>
        </div>
        <div style="color:#ddd; word-break:break-word;">${note.content}</div>
      `;

      // Click timestamp to seek video
      item.querySelector('.ft-seek-btn').addEventListener('click', () => {
        const video = getActiveVideo();
        if (video) {
          video.currentTime = note.timestamp;
          video.play();
        }
      });

      list.appendChild(item);
    });
  });
}

// 3. Navigation Events & Observers
window.addEventListener('yt-navigate-finish', () => {
  checkShortsQuota();
  injectStudyDrawer();
});

// Periodic fallback check for SPA state swaps
setInterval(() => {
  if (window.location.pathname.includes('/watch') && !document.getElementById('focustube-drawer')) {
    injectStudyDrawer();
  }
}, 1000);

// Run immediately
checkShortsQuota();
injectStudyDrawer();