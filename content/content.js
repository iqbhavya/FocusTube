const ICONS = {
  brand: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3ea6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
  external: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  camera: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  link: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  close: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  minus: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`
};

let lastShortUrl = '';
let pendingScreenshot = null;
let activeTimestamp = 0;
let lastWatchVideoId = null;

function checkShortsQuota() {
  const currentUrl = window.location.href;
  if (!window.location.pathname.startsWith('/shorts/')) return;

  if (currentUrl === lastShortUrl) return;
  lastShortUrl = currentUrl;

  const today = new Date().toISOString().slice(0, 10);
  const defaultLimit = 5;

  chrome.storage.local.get(['shortsData'], (result) => {
    let data = result.shortsData || { date: today, count: 0, limit: defaultLimit };

    if (data.date !== today) {
      data = { date: today, count: 0, limit: data.limit || defaultLimit };
    }

    if (data.count >= data.limit) {
      alert(`Daily limit of ${data.limit} Shorts reached. Back to study mode.`);
      window.location.href = 'https://www.youtube.com';
      return;
    }

    // Wait 3s before counting so accidental clicks or instant back-nav don't consume quota
    setTimeout(() => {
      if (!window.location.pathname.startsWith('/shorts/')) return;
      chrome.storage.local.get(['shortsData'], (latest) => {
        let current = latest.shortsData || data;
        if (current.date !== today) {
          current = { date: today, count: 0, limit: current.limit || defaultLimit };
        }
        current.count += 1;
        chrome.storage.local.set({ shortsData: current });
      });
    }, 3000);
  });
}

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
  return new URLSearchParams(window.location.search).get('v');
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

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function captureVideoFrame() {
  const video = getActiveVideo();
  if (!video) return null;

  try {
    const canvas = document.createElement('canvas');
    const originalWidth = video.videoWidth || 640;
    const originalHeight = video.videoHeight || 360;

    // Downscale high-res streams so Base64 screenshots stay small in local storage
    const maxWidth = 720;
    const scale = originalWidth > maxWidth ? (maxWidth / originalWidth) : 1;

    canvas.width = Math.round(originalWidth * scale);
    canvas.height = Math.round(originalHeight * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.75);
  } catch (err) {
    console.error('[FocusTube] Frame capture failed:', err);
    return null;
  }
}

function injectLightbox() {
  if (document.getElementById('ft-lightbox-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'ft-lightbox-modal';
  modal.innerHTML = `<img id="ft-lightbox-img" src="" alt="Slide capture" />`;
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

function injectDrawerBubble() {
  if (document.getElementById('ft-drawer-bubble')) return;

  const bubble = document.createElement('div');
  bubble.id = 'ft-drawer-bubble';
  bubble.innerHTML = `${ICONS.brand}<span>FocusTube</span><span id="ft-bubble-count">0</span>`;
  bubble.addEventListener('click', () => {
    const drawer = document.getElementById('focustube-drawer');
    if (drawer) {
      drawer.classList.remove('ft-minimized');
      bubble.classList.remove('ft-active');
    }
  });
  document.body.appendChild(bubble);
}

function enableDrawerDragging(drawer) {
  const header = drawer.querySelector('.ft-header');
  if (!header) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = drawer.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // Release right/bottom CSS anchors with !important so 2D left/top positioning works freely
    drawer.style.setProperty('right', 'auto', 'important');
    drawer.style.setProperty('bottom', 'auto', 'important');
    drawer.style.setProperty('left', `${initialLeft}px`, 'important');
    drawer.style.setProperty('top', `${initialTop}px`, 'important');

    document.body.style.userSelect = 'none';

    function onMouseMove(moveEvent) {
      if (!isDragging) return;
      const newLeft = Math.max(10, Math.min(window.innerWidth - drawer.offsetWidth - 10, initialLeft + (moveEvent.clientX - startX)));
      const newTop = Math.max(10, Math.min(window.innerHeight - drawer.offsetHeight - 10, initialTop + (moveEvent.clientY - startY)));

      drawer.style.setProperty('left', `${newLeft}px`, 'important');
      drawer.style.setProperty('top', `${newTop}px`, 'important');
    }

    function onMouseUp() {
      isDragging = false;
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

function injectStudyDrawer() {
  const isWatchPage = window.location.pathname.includes('/watch');
  const existingDrawer = document.getElementById('focustube-drawer');
  const existingBubble = document.getElementById('ft-drawer-bubble');

  if (!isWatchPage) {
    if (existingDrawer) existingDrawer.remove();
    if (existingBubble) existingBubble.remove();
    lastWatchVideoId = null;
    return;
  }

  injectLightbox();
  injectDrawerBubble();

  const currentVideoId = getVideoId();
  if (existingDrawer) {
    if (currentVideoId && currentVideoId !== lastWatchVideoId) {
      lastWatchVideoId = currentVideoId;
      activeTimestamp = 0;
      const timeEl = document.getElementById('ft-current-time');
      if (timeEl) timeEl.textContent = '00:00';
      renderNotesList();
    }
    return;
  }

  lastWatchVideoId = currentVideoId;

  const drawer = document.createElement('div');
  drawer.id = 'focustube-drawer';
  const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');

  drawer.innerHTML = `
    <div class="ft-header" title="Drag to move">
      <div class="ft-header-left">
        ${ICONS.brand}
        <h3>FocusTube</h3>
        <span class="ft-badge">Study Mode</span>
      </div>
      <div class="ft-header-actions">
        <a href="${dashboardUrl}" target="_blank" class="ft-icon-btn" title="Open Study Library">Library ${ICONS.external}</a>
        <button id="ft-minimize-btn" class="ft-icon-btn" title="Minimize">${ICONS.minus}</button>
      </div>
    </div>
    <div class="ft-input-section">
      <div class="ft-time-row">
        <span id="ft-current-time" class="ft-timestamp-pill">00:00</span>
        <span class="ft-hotkey-hint">Alt+N (time) · Alt+S (snap)</span>
      </div>
      <textarea id="ft-note-input" placeholder="Write a note (pauses video while typing)..."></textarea>
      <div class="ft-inputs-grid">
        <input type="text" id="ft-tags-input" class="ft-sub-input" placeholder="Tags: #dsa #math" />
        <input type="text" id="ft-problem-input" class="ft-sub-input" placeholder="Problem URL..." />
      </div>
      <div id="ft-screenshot-preview-container">
        <img id="ft-screenshot-preview-img" src="" alt="Slide preview" />
        <button type="button" id="ft-remove-preview-btn" class="ft-remove-preview-btn" title="Remove screenshot">${ICONS.close}</button>
      </div>
      <div class="ft-btn-row">
        <button type="button" id="ft-snap-btn" class="ft-snap-btn" title="Capture current video frame (Alt+S)">
          ${ICONS.camera} Snap Slide
        </button>
        <button id="ft-save-btn" class="ft-save-btn">Save Note</button>
      </div>
    </div>
    <div id="ft-notes-list"></div>
  `;

  document.body.appendChild(drawer);
  enableDrawerDragging(drawer);
  bindDrawerEvents();
  renderNotesList();
}

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
      problemLinks,
      updatedAt: Date.now(),
      createdAt: registry[videoId]?.createdAt || Date.now()
    };

    chrome.storage.local.set({ ft_videos: registry });
  });
}

function deleteNote(videoId, noteId) {
  chrome.storage.local.get([videoId], (res) => {
    const updated = (res[videoId] || []).filter(n => n.id !== noteId);
    chrome.storage.local.set({ [videoId]: updated }, () => {
      syncVideoMetadata(videoId, updated);
      renderNotesList();
    });
  });
}

function bindDrawerEvents() {
  const drawer = document.getElementById('focustube-drawer');
  const textarea = document.getElementById('ft-note-input');
  const timeDisplay = document.getElementById('ft-current-time');
  const saveBtn = document.getElementById('ft-save-btn');
  const tagsInput = document.getElementById('ft-tags-input');
  const problemInput = document.getElementById('ft-problem-input');
  const snapBtn = document.getElementById('ft-snap-btn');
  const previewContainer = document.getElementById('ft-screenshot-preview-container');
  const previewImg = document.getElementById('ft-screenshot-preview-img');
  const removePreviewBtn = document.getElementById('ft-remove-preview-btn');
  const minimizeBtn = document.getElementById('ft-minimize-btn');
  const bubble = document.getElementById('ft-drawer-bubble');

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (drawer) drawer.classList.add('ft-minimized');
      if (bubble) bubble.classList.add('ft-active');
    });
  }

  function triggerFrameCapture() {
    const video = getActiveVideo();
    if (!video) return;

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

  // Track whether playback was running so manually paused videos stay paused on blur
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
      content: content || '(Slide capture)',
      tags,
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

    const bubbleCount = document.getElementById('ft-bubble-count');
    if (bubbleCount) {
      bubbleCount.textContent = notes.length;
    }

    notes.forEach((note) => {
      const item = document.createElement('div');
      item.className = 'ft-note-card';

      const screenshotHtml = note.screenshot
        ? `<img src="${note.screenshot}" class="ft-note-thumb" title="Click to enlarge" alt="Slide snapshot" />`
        : '';

      const tagsHtml = note.tags && note.tags.length > 0
        ? note.tags.map(t => `<span class="ft-tag-pill">${escapeHtml(t)}</span>`).join('')
        : '';

      let problemHtml = '';
      if (note.problemUrl) {
        let label = 'Link';
        try {
          const host = new URL(note.problemUrl).hostname.replace('www.', '');
          if (host.includes('leetcode')) label = 'LeetCode';
          else if (host.includes('github')) label = 'GitHub';
          else if (host.includes('hackerrank')) label = 'HackerRank';
          else label = host;
        } catch (_) {}
        problemHtml = `<a href="${escapeHtml(note.problemUrl)}" target="_blank" class="ft-problem-pill" title="${escapeHtml(note.problemUrl)}">${ICONS.link} ${escapeHtml(label)}</a>`;
      }

      item.innerHTML = `
        <div class="ft-note-card-top">
          <span class="ft-seek-btn" data-time="${note.timestamp}">${escapeHtml(note.timestampFormatted)}</span>
          <div class="ft-note-actions">
            ${problemHtml}
            <button type="button" class="ft-delete-btn" title="Delete note">${ICONS.close}</button>
          </div>
        </div>
        ${screenshotHtml}
        <div class="ft-note-text">${escapeHtml(note.content)}</div>
        ${tagsHtml ? `<div class="ft-note-tags">${tagsHtml}</div>` : ''}
      `;

      item.querySelector('.ft-seek-btn').addEventListener('click', () => {
        const video = getActiveVideo();
        if (video) {
          video.currentTime = note.timestamp;
          video.play();
        }
      });

      const thumb = item.querySelector('.ft-note-thumb');
      if (thumb) {
        thumb.addEventListener('click', () => openLightbox(note.screenshot));
      }

      item.querySelector('.ft-delete-btn').addEventListener('click', () => {
        deleteNote(videoId, note.id);
      });

      list.appendChild(item);
    });
  });
}

function removeHomeFocusHero() {
  const existingHero = document.getElementById('ft-home-hero');
  if (existingHero) existingHero.remove();
}

window.addEventListener('yt-navigate-finish', () => {
  checkShortsQuota();
  injectStudyDrawer();
  removeHomeFocusHero();
});

// Fallback check for YouTube SPA transitions that skip yt-navigate-finish
setInterval(() => {
  if (window.location.pathname.includes('/watch') && !document.getElementById('focustube-drawer')) {
    injectStudyDrawer();
  }
  removeHomeFocusHero();
}, 1000);

checkShortsQuota();
injectStudyDrawer();
removeHomeFocusHero();
