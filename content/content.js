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

function getCleanVideoTitle() {
  const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                  document.querySelector('#title h1 yt-formatted-string') ||
                  document.querySelector('h1.title');
  if (titleEl && titleEl.textContent.trim()) {
    return titleEl.textContent.trim();
  }
  return document.title.replace(' - YouTube', '').trim() || 'Untitled Lecture';
}

function getChannelName() {
  const channelEl = document.querySelector('#channel-name #text a') ||
                    document.querySelector('ytd-channel-name yt-formatted-string a') ||
                    document.querySelector('#upload-info #channel-name a');
  return channelEl?.textContent?.trim() || 'YouTube Creator';
}

// --- Frame Capture Engine ---
let pendingScreenshot = null;

function captureVideoFrame() {
  const video = getActiveVideo();
  if (!video) {
    console.warn('[FocusTube] No active video element found.');
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    const originalWidth = video.videoWidth || 640;
    const originalHeight = video.videoHeight || 360;

    // Rescale to max 720px width for storage efficiency & clarity
    const maxWidth = 720;
    const scale = originalWidth > maxWidth ? (maxWidth / originalWidth) : 1;

    canvas.width = Math.round(originalWidth * scale);
    canvas.height = Math.round(originalHeight * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.75);
  } catch (err) {
    console.error('[FocusTube] Failed to capture video frame:', err);
    return null;
  }
}

function injectLightbox() {
  if (document.getElementById('ft-lightbox-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'ft-lightbox-modal';
  modal.innerHTML = `<img id="ft-lightbox-img" src="" alt="Enlarged Slide Capture" />`;
  modal.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  document.body.appendChild(modal);
}

function openLightbox(src) {
  const modal = document.getElementById('ft-lightbox-modal');
  const img = document.getElementById('ft-lightbox-img');
  if (modal && img) {
    img.src = src;
    modal.classList.add('active');
  }
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

  injectLightbox();

  if (existingDrawer) return;

  const drawer = document.createElement('div');
  drawer.id = 'focustube-drawer';
  
  // Explicit inline styles to ensure it cannot be hidden or collapsed
  drawer.style.cssText = `
    position: fixed !important;
    top: 70px !important;
    right: 20px !important;
    width: 320px !important;
    height: 520px !important;
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
        <span style="color:#777; font-size:11px;">Alt+N (time) | Alt+S (snap)</span>
      </div>
      <textarea id="ft-note-input" placeholder="Take a note (Alt + N)..." style="width:100%; height:70px; background:#222; border:1px solid #444; border-radius:4px; color:#fff; padding:6px; resize:none; box-sizing:border-box; outline:none;"></textarea>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
        <input type="text" id="ft-tags-input" placeholder="Tags: #dsa #math" style="width:100%; background:#222; border:1px solid #444; border-radius:4px; color:#fff; padding:6px; box-sizing:border-box; outline:none; font-size:11px;" />
        <input type="text" id="ft-problem-input" placeholder="Problem: leetcode.com/..." style="width:100%; background:#222; border:1px solid #444; border-radius:4px; color:#fff; padding:6px; box-sizing:border-box; outline:none; font-size:11px;" />
      </div>
      
      <div id="ft-screenshot-preview-container">
        <img id="ft-screenshot-preview-img" src="" alt="Slide Preview" />
        <button type="button" id="ft-remove-preview-btn" class="ft-remove-preview-btn" title="Remove frame capture">✕</button>
      </div>

      <div class="ft-btn-row">
        <button type="button" id="ft-snap-btn" class="ft-snap-btn" title="Capture active video slide frame (Alt+S)">
          📸 Snap Slide
        </button>
        <button id="ft-save-btn" style="flex:1.2; background:#3ea6ff; color:#000; border:none; border-radius:4px; padding:6px; font-weight:bold; cursor:pointer;">Save Note</button>
      </div>
    </div>
    <div id="ft-notes-list" style="flex:1; overflow-y:auto; margin-top:10px;"></div>
  `;

  // Attach directly to body
  document.body.appendChild(drawer);
  console.log('[FocusTube] Drawer appended with force styles!');

  bindDrawerEvents();
  renderNotesList();
}

// --- 3. Sync Video Lecture Index (for Dashboard & Problem Hub) ---
function syncVideoMetadata(videoId, notes) {
  if (!videoId) return;

  chrome.storage.local.get(['ft_videos'], (res) => {
    const registry = res.ft_videos || {};
    const title = getCleanVideoTitle();
    const channel = getChannelName();

    const allTags = new Set();
    const problemLinks = [];

    notes.forEach((note) => {
      (note.tags || []).forEach(t => allTags.add(t));
      if (note.problemUrl && !problemLinks.includes(note.problemUrl)) {
        problemLinks.push(note.problemUrl);
      }
    });

    registry[videoId] = {
      id: videoId,
      title: title || registry[videoId]?.title || 'YouTube Lecture',
      channel: channel || registry[videoId]?.channel || 'YouTube Creator',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      noteCount: notes.length,
      screenshotCount: notes.filter(n => !!n.screenshot).length,
      tags: Array.from(allTags),
      problemLinks: problemLinks,
      updatedAt: Date.now(),
      createdAt: registry[videoId]?.createdAt || Date.now()
    };

    chrome.storage.local.set({ ft_videos: registry }, () => {
      console.log(`[FocusTube] Synced lecture metadata for ${videoId} (${notes.length} notes).`);
    });
  });
}

function deleteNote(videoId, noteId) {
  chrome.storage.local.get([videoId], (res) => {
    const notes = res[videoId] || [];
    const updated = notes.filter(n => n.id !== noteId);

    chrome.storage.local.set({ [videoId]: updated }, () => {
      syncVideoMetadata(videoId, updated);
      renderNotesList();
    });
  });
}

function bindDrawerEvents() {
  const textarea = document.getElementById('ft-note-input');
  const timeDisplay = document.getElementById('ft-current-time');
  const saveBtn = document.getElementById('ft-save-btn');
  const tagsInput = document.getElementById('ft-tags-input');
  const problemInput = document.getElementById('ft-problem-input');
  const snapBtn = document.getElementById('ft-snap-btn');
  const previewContainer = document.getElementById('ft-screenshot-preview-container');
  const previewImg = document.getElementById('ft-screenshot-preview-img');
  const removePreviewBtn = document.getElementById('ft-remove-preview-btn');

  // 1. Frame capture logic (Offscreen canvas -> base64)
  function triggerFrameCapture() {
    const video = getActiveVideo();
    if (!video) return;

    // Sync timestamp with frame capture
    activeTimestamp = Math.floor(video.currentTime);
    timeDisplay.textContent = formatTime(activeTimestamp);

    const dataUrl = captureVideoFrame();
    if (dataUrl) {
      pendingScreenshot = dataUrl;
      previewImg.src = dataUrl;
      previewContainer.classList.add('active');
    }
  }

  snapBtn.addEventListener('click', triggerFrameCapture);

  removePreviewBtn.addEventListener('click', () => {
    pendingScreenshot = null;
    previewImg.src = '';
    previewContainer.classList.remove('active');
  });

  // 2. Auto-pause on focus, auto-resume on blur
  textarea.addEventListener('focus', () => {
    const video = getActiveVideo();
    if (video && !video.paused) {
      video.pause();
      textarea.dataset.wasPlaying = 'true';
    }
    if (activeTimestamp === 0 && video) {
      activeTimestamp = Math.floor(video.currentTime);
      timeDisplay.textContent = formatTime(activeTimestamp);
    }
  });

  textarea.addEventListener('blur', () => {
    const video = getActiveVideo();
    if (video && textarea.dataset.wasPlaying === 'true') {
      video.play();
      textarea.dataset.wasPlaying = 'false';
    }
  });

  // 3. Hotkeys: Alt + N (Current time), Alt + Shift + N (-5s rewind), Alt + S (Snap slide)
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyN') {
      const video = getActiveVideo();
      if (!video) return;

      e.preventDefault();
      activeTimestamp = e.shiftKey ? Math.max(0, Math.floor(video.currentTime - 5)) : Math.floor(video.currentTime);
      timeDisplay.textContent = formatTime(activeTimestamp);
      textarea.focus();
    }

    if (e.altKey && e.code === 'KeyS') {
      e.preventDefault();
      triggerFrameCapture();
    }
  });

  // 4. Save Note Handler
  saveBtn.addEventListener('click', () => {
    const content = textarea.value.trim();
    if (!content && !pendingScreenshot) return;

    const videoId = getVideoId();
    if (!videoId) return;

    const rawTags = tagsInput.value.trim();
    const tags = rawTags
      ? rawTags.split(/[\s,]+/).map(t => t.startsWith('#') ? t : `#${t}`).filter(t => t.length > 1)
      : [];

    let problemUrl = problemInput.value.trim();
    if (problemUrl && !/^https?:\/\//i.test(problemUrl)) {
      problemUrl = 'https://' + problemUrl;
    }

    const newNote = {
      id: Date.now().toString(),
      timestamp: activeTimestamp,
      timestampFormatted: formatTime(activeTimestamp),
      content: content || '(Slide capture only)',
      tags: tags,
      problemUrl: problemUrl || null,
      screenshot: pendingScreenshot || null,
      createdAt: Date.now()
    };

    chrome.storage.local.get([videoId], (res) => {
      const existing = res[videoId] || [];
      const updated = [...existing, newNote];
      chrome.storage.local.set({ [videoId]: updated }, () => {
        textarea.value = '';
        tagsInput.value = '';
        problemInput.value = '';
        pendingScreenshot = null;
        previewImg.src = '';
        previewContainer.classList.remove('active');
        syncVideoMetadata(videoId, updated);
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

      let screenshotHtml = '';
      if (note.screenshot) {
        screenshotHtml = `<img src="${note.screenshot}" class="ft-note-thumb" title="Click to enlarge slide" alt="Slide snapshot" />`;
      }

      let tagsHtml = '';
      if (note.tags && note.tags.length > 0) {
        tagsHtml = note.tags.map(t => `<span class="ft-tag-pill">${t}</span>`).join(' ');
      }

      let problemHtml = '';
      if (note.problemUrl) {
        let label = 'Problem';
        try {
          const u = new URL(note.problemUrl);
          label = u.hostname.replace('www.', '');
          if (label.includes('leetcode')) label = 'LeetCode';
          else if (label.includes('github')) label = 'GitHub';
          else if (label.includes('hackerrank')) label = 'HackerRank';
        } catch (_) {}
        problemHtml = `<a href="${note.problemUrl}" target="_blank" class="ft-problem-pill" title="${note.problemUrl}">🔗 ${label}</a>`;
      }

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span class="ft-seek-btn" data-time="${note.timestamp}" style="color:#3ea6ff; cursor:pointer; font-weight:bold; font-family:monospace;">
            ${note.timestampFormatted}
          </span>
          <div class="ft-note-actions">
            ${problemHtml}
            <button type="button" class="ft-delete-btn" title="Delete note">✕</button>
          </div>
        </div>
        ${screenshotHtml}
        <div style="color:#ddd; word-break:break-word; line-height:1.4;">${note.content}</div>
        ${tagsHtml ? `<div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px;">${tagsHtml}</div>` : ''}
      `;

      // Click timestamp to seek video
      item.querySelector('.ft-seek-btn').addEventListener('click', () => {
        const video = getActiveVideo();
        if (video) {
          video.currentTime = note.timestamp;
          video.play();
        }
      });

      // Click screenshot to view in lightbox modal
      const thumb = item.querySelector('.ft-note-thumb');
      if (thumb) {
        thumb.addEventListener('click', () => {
          openLightbox(note.screenshot);
        });
      }

      // Delete note
      item.querySelector('.ft-delete-btn').addEventListener('click', () => {
        deleteNote(videoId, note.id);
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