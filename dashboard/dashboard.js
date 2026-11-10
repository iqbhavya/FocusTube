const SVG = {
  eye: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  copy: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  download: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  link: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  play: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  external: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  fileText: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  image: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
};

let allLectures = [];
let activeTagFilter = 'all';
let searchQuery = '';
let currentSort = 'recent';

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadLibraryData();
});

function initEventListeners() {
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.style.display = searchQuery ? 'inline-flex' : 'none';
    renderDashboard();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderDashboard();
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderDashboard();
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadLibraryData();
    showToast('Library refreshed');
  });

  document.getElementById('export-all-btn').addEventListener('click', exportAllMarkdown);

  document.getElementById('close-problem-modal').addEventListener('click', closeProblemModal);
  document.getElementById('cancel-problem-btn').addEventListener('click', closeProblemModal);
  document.getElementById('save-problem-btn').addEventListener('click', saveProblemLink);

  document.getElementById('close-image-modal').addEventListener('click', closeImageModal);
  document.getElementById('image-modal').addEventListener('click', (e) => {
    if (e.target.id === 'image-modal') closeImageModal();
  });
}

function loadLibraryData() {
  chrome.storage.local.get(null, (allData) => {
    const registry = allData.ft_videos || {};
    const recoveredLectures = [];

    // Backfill metadata for notes saved before ft_videos index tracking existed
    Object.keys(allData).forEach((key) => {
      if (key === 'ft_videos' || key === 'shortsData') return;
      const value = allData[key];
      if (Array.isArray(value) && value.length > 0 && value[0].timestamp !== undefined && !registry[key]) {
        registry[key] = {
          id: key,
          title: `YouTube Lecture (${key})`,
          channel: 'YouTube Creator',
          url: `https://www.youtube.com/watch?v=${key}`,
          noteCount: value.length,
          tags: [],
          problemLinks: [],
          updatedAt: Date.now(),
          createdAt: Date.now()
        };
        recoveredLectures.push(key);
      }
    });

    if (recoveredLectures.length > 0) {
      chrome.storage.local.set({ ft_videos: registry });
    }

    const lectureList = [];
    Object.keys(registry).forEach((videoId) => {
      const meta = registry[videoId];
      const notes = (allData[videoId] || []).slice().sort((a, b) => a.timestamp - b.timestamp);

      const tagsSet = new Set(meta.tags || []);
      const problemsSet = new Set(meta.problemLinks || []);

      notes.forEach((n) => {
        (n.tags || []).forEach(t => tagsSet.add(t));
        if (n.problemUrl) problemsSet.add(n.problemUrl);
      });

      lectureList.push({
        id: videoId,
        title: meta.title || 'Untitled Lecture',
        channel: meta.channel || 'YouTube Creator',
        url: meta.url || `https://www.youtube.com/watch?v=${videoId}`,
        tags: Array.from(tagsSet),
        problemLinks: Array.from(problemsSet),
        updatedAt: meta.updatedAt || meta.createdAt || Date.now(),
        createdAt: meta.createdAt || Date.now(),
        notes
      });
    });

    allLectures = lectureList;
    updateGlobalStats();
    renderTagChips();
    renderDashboard();
  });
}

function updateGlobalStats() {
  let totalNotes = 0;
  let totalSlides = 0;
  const uniqueTags = new Set();

  allLectures.forEach((lec) => {
    totalNotes += lec.notes.length;
    totalSlides += lec.notes.filter(n => !!n.screenshot).length;
    (lec.tags || []).forEach(t => uniqueTags.add(t));
  });

  document.getElementById('stat-total-lectures').textContent = allLectures.length;
  document.getElementById('stat-total-notes').textContent = totalNotes;
  document.getElementById('stat-total-slides').textContent = totalSlides;
  document.getElementById('stat-total-tags').textContent = uniqueTags.size;
}

function renderTagChips() {
  const container = document.getElementById('tags-container');
  const tagCounts = {};

  allLectures.forEach((lec) => {
    (lec.tags || []).forEach((t) => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

  container.innerHTML = `
    <button class="tag-chip ${activeTagFilter === 'all' ? 'active' : ''}" data-tag="all">
      All Topics (${allLectures.length})
    </button>
  `;

  sortedTags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.className = `tag-chip ${activeTagFilter === tag ? 'active' : ''}`;
    btn.dataset.tag = tag;
    btn.textContent = `${tag} (${tagCounts[tag]})`;
    btn.addEventListener('click', () => {
      activeTagFilter = activeTagFilter === tag ? 'all' : tag;
      renderTagChips();
      renderDashboard();
    });
    container.appendChild(btn);
  });

  container.querySelector('[data-tag="all"]').addEventListener('click', () => {
    activeTagFilter = 'all';
    renderTagChips();
    renderDashboard();
  });
}

function renderDashboard() {
  const container = document.getElementById('lectures-list');
  const emptyState = document.getElementById('empty-state');

  const filtered = allLectures.filter((lec) => {
    if (activeTagFilter !== 'all' && (!lec.tags || !lec.tags.includes(activeTagFilter))) {
      return false;
    }

    if (searchQuery) {
      const matchTitle = lec.title.toLowerCase().includes(searchQuery);
      const matchChannel = lec.channel.toLowerCase().includes(searchQuery);
      const matchTags = lec.tags.some(t => t.toLowerCase().includes(searchQuery));
      const matchProblems = lec.problemLinks.some(p => p.toLowerCase().includes(searchQuery));
      const matchNotes = lec.notes.some(n => n.content.toLowerCase().includes(searchQuery));
      return matchTitle || matchChannel || matchTags || matchProblems || matchNotes;
    }

    return true;
  });

  filtered.sort((a, b) => {
    if (currentSort === 'recent') return b.updatedAt - a.updatedAt;
    if (currentSort === 'notes') return b.notes.length - a.notes.length;
    if (currentSort === 'title') return a.title.localeCompare(b.title);
    return 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = '';

  filtered.forEach((lec) => {
    container.appendChild(createLectureCard(lec));
  });
}

function createLectureCard(lec) {
  const card = document.createElement('article');
  card.className = 'lecture-card';
  card.id = `lecture-card-${lec.id}`;

  const slideCount = lec.notes.filter(n => !!n.screenshot).length;
  const formattedDate = new Date(lec.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const problemBadgesHtml = (lec.problemLinks || []).map((url) => {
    const info = getProblemBadgeInfo(url);
    return `<a href="${escapeHtml(url)}" target="_blank" class="problem-pill ${info.brandClass}" title="${escapeHtml(url)}">${SVG.link} ${escapeHtml(info.label)}</a>`;
  }).join('');

  const tagsHtml = (lec.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('');

  card.innerHTML = `
    <div class="lecture-card-header">
      <div class="lecture-title-col">
        <h2 class="lecture-title">
          <a href="${escapeHtml(lec.url)}" target="_blank" title="Open on YouTube">
            ${escapeHtml(lec.title)} ${SVG.external}
          </a>
        </h2>
        <div class="lecture-meta">
          <span class="channel-tag">${escapeHtml(lec.channel)}</span>
          <span class="lecture-stats-badge">${SVG.fileText} ${lec.notes.length} Notes</span>
          <span class="lecture-stats-badge">${SVG.image} ${slideCount} Slides</span>
          <span>Updated ${formattedDate}</span>
        </div>
      </div>
      <div class="lecture-actions">
        <button class="btn btn-secondary btn-sm toggle-notes-btn">
          ${SVG.eye} Show Notes (${lec.notes.length})
        </button>
        <button class="btn btn-secondary btn-sm copy-md-btn" title="Copy Markdown">
          ${SVG.copy} Copy MD
        </button>
        <button class="btn btn-primary btn-sm dl-md-btn" title="Download .md file">
          ${SVG.download} Export
        </button>
        <button class="btn btn-danger-outline btn-sm delete-lec-btn" title="Delete lecture">
          ${SVG.trash}
        </button>
      </div>
    </div>

    <div class="problem-links-row">
      <span class="problem-label">Links:</span>
      ${problemBadgesHtml}
      <button class="add-problem-pill" data-video-id="${escapeHtml(lec.id)}">+ Add Link</button>
    </div>

    ${tagsHtml ? `<div class="lecture-tags-row">${tagsHtml}</div>` : ''}

    <div class="lecture-notes-section" style="display:none;">
      <div class="notes-grid"></div>
    </div>
  `;

  const notesSection = card.querySelector('.lecture-notes-section');
  const toggleNotesBtn = card.querySelector('.toggle-notes-btn');
  const notesGrid = card.querySelector('.notes-grid');

  toggleNotesBtn.addEventListener('click', () => {
    const isHidden = notesSection.style.display === 'none';
    if (isHidden) {
      renderNotesGrid(lec, notesGrid);
      notesSection.style.display = 'flex';
      toggleNotesBtn.innerHTML = `${SVG.eyeOff} Hide Notes (${lec.notes.length})`;
    } else {
      notesSection.style.display = 'none';
      toggleNotesBtn.innerHTML = `${SVG.eye} Show Notes (${lec.notes.length})`;
    }
  });

  card.querySelector('.copy-md-btn').addEventListener('click', () => {
    const md = generateLectureMarkdown(lec);
    navigator.clipboard.writeText(md).then(() => {
      showToast('Markdown copied to clipboard');
    });
  });

  card.querySelector('.dl-md-btn').addEventListener('click', () => {
    downloadMarkdownFile(lec);
  });

  card.querySelector('.delete-lec-btn').addEventListener('click', () => {
    if (confirm(`Delete "${lec.title}" and all its notes?`)) {
      deleteLecture(lec.id);
    }
  });

  card.querySelector('.add-problem-pill').addEventListener('click', () => {
    openProblemModal(lec.id);
  });

  return card;
}

function renderNotesGrid(lec, container) {
  container.innerHTML = '';

  if (lec.notes.length === 0) {
    container.innerHTML = `<div style="color:var(--text-dim); font-size:12px;">No notes recorded for this lecture yet.</div>`;
    return;
  }

  lec.notes.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'note-item';

    const timestampSec = note.timestamp || 0;
    const seekUrl = `https://www.youtube.com/watch?v=${lec.id}&t=${timestampSec}s`;

    const screenshotHtml = note.screenshot
      ? `<img src="${note.screenshot}" class="note-screenshot-thumb" alt="Captured slide" title="Click to enlarge" />`
      : '';

    let problemHtml = '';
    if (note.problemUrl) {
      const info = getProblemBadgeInfo(note.problemUrl);
      problemHtml = `<a href="${escapeHtml(note.problemUrl)}" target="_blank" class="problem-pill ${info.brandClass}" style="font-size:10px; margin-top:4px;">${SVG.link} ${escapeHtml(info.label)}</a>`;
    }

    item.innerHTML = `
      <div class="note-item-header">
        <a href="${seekUrl}" target="_blank" class="timestamp-link" title="Play at ${escapeHtml(note.timestampFormatted || '00:00')}">
          ${SVG.play} ${escapeHtml(note.timestampFormatted || '00:00')}
        </a>
        <button class="note-delete-btn" title="Delete note">${SVG.close}</button>
      </div>
      ${screenshotHtml}
      <div class="note-content-text">${formatNoteContent(note.content)}</div>
      ${problemHtml}
    `;

    const thumb = item.querySelector('.note-screenshot-thumb');
    if (thumb) {
      thumb.addEventListener('click', () => openImageModal(note.screenshot));
    }

    item.querySelector('.note-delete-btn').addEventListener('click', () => {
      deleteSingleNote(lec.id, note.id);
    });

    container.appendChild(item);
  });
}

function openProblemModal(videoId) {
  document.getElementById('modal-video-id').value = videoId;
  document.getElementById('modal-problem-url').value = '';
  document.getElementById('problem-modal').style.display = 'flex';
  document.getElementById('modal-problem-url').focus();
}

function closeProblemModal() {
  document.getElementById('problem-modal').style.display = 'none';
}

function saveProblemLink() {
  const videoId = document.getElementById('modal-video-id').value;
  let url = document.getElementById('modal-problem-url').value.trim();

  if (!url) {
    closeProblemModal();
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  chrome.storage.local.get(['ft_videos'], (res) => {
    const registry = res.ft_videos || {};
    if (registry[videoId]) {
      const existing = registry[videoId].problemLinks || [];
      if (!existing.includes(url)) {
        existing.push(url);
      }
      registry[videoId].problemLinks = existing;
      registry[videoId].updatedAt = Date.now();

      chrome.storage.local.set({ ft_videos: registry }, () => {
        closeProblemModal();
        loadLibraryData();
        showToast('Problem link attached');
      });
    }
  });
}

function openImageModal(src) {
  const modal = document.getElementById('image-modal');
  document.getElementById('enlarged-img').src = src;
  modal.style.display = 'flex';
}

function closeImageModal() {
  document.getElementById('image-modal').style.display = 'none';
}

function deleteLecture(videoId) {
  chrome.storage.local.remove([videoId], () => {
    chrome.storage.local.get(['ft_videos'], (res) => {
      const registry = res.ft_videos || {};
      delete registry[videoId];
      chrome.storage.local.set({ ft_videos: registry }, () => {
        loadLibraryData();
        showToast('Lecture deleted');
      });
    });
  });
}

function deleteSingleNote(videoId, noteId) {
  chrome.storage.local.get([videoId, 'ft_videos'], (res) => {
    const updated = (res[videoId] || []).filter(n => n.id !== noteId);
    const updates = { [videoId]: updated };

    if (res.ft_videos && res.ft_videos[videoId]) {
      res.ft_videos[videoId].noteCount = updated.length;
      res.ft_videos[videoId].updatedAt = Date.now();
      updates.ft_videos = res.ft_videos;
    }

    chrome.storage.local.set(updates, () => {
      loadLibraryData();
      showToast('Note deleted');
    });
  });
}

function generateLectureMarkdown(lec) {
  const dateStr = new Date(lec.updatedAt).toISOString().slice(0, 10);
  const cleanTags = (lec.tags || []).map(t => t.replace('#', '')).filter(Boolean);

  // YAML frontmatter for Obsidian / Notion imports
  let md = `---\n`;
  md += `title: "${lec.title.replace(/"/g, '\\"')}"\n`;
  md += `source: "${lec.url}"\n`;
  md += `channel: "${lec.channel.replace(/"/g, '\\"')}"\n`;
  md += `date: ${dateStr}\n`;
  if (cleanTags.length > 0) {
    md += `tags:\n`;
    cleanTags.forEach((t) => {
      md += `  - ${t}\n`;
    });
  }
  md += `---\n\n`;

  md += `# ${lec.title}\n\n`;
  md += `- **Channel:** ${lec.channel}\n`;
  md += `- **Lecture URL:** [Watch on YouTube](${lec.url})\n`;
  md += `- **Date Studied:** ${dateStr}\n`;

  if (lec.tags && lec.tags.length > 0) {
    md += `- **Topics:** ${lec.tags.join(' ')}\n`;
  }
  md += `\n`;

  if (lec.problemLinks && lec.problemLinks.length > 0) {
    md += `### Associated Links\n\n`;
    lec.problemLinks.forEach((p) => {
      md += `- [${getDomainLabel(p)}](${p})\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;
  md += `## Lecture Notes\n\n`;

  if (!lec.notes || lec.notes.length === 0) {
    md += `*No timestamped notes recorded.*\n\n`;
  } else {
    lec.notes.forEach((note) => {
      const timestampSec = note.timestamp || 0;
      const formattedTime = note.timestampFormatted || '00:00';
      const seekUrl = `https://www.youtube.com/watch?v=${lec.id}&t=${timestampSec}s`;

      md += `### [${formattedTime}](${seekUrl})\n\n`;
      md += `${note.content}\n\n`;

      if (note.problemUrl) {
        md += `> **Problem:** [${getDomainLabel(note.problemUrl)}](${note.problemUrl})\n\n`;
      }

      if (note.screenshot) {
        md += `![Slide Capture at ${formattedTime}](${note.screenshot})\n\n`;
      }

      md += `\n`;
    });
  }

  md += `---\n`;
  md += `*Exported via FocusTube*\n`;

  return md;
}

function downloadMarkdownFile(lec) {
  const md = generateLectureMarkdown(lec);
  const safeTitle = lec.title.replace(/[^a-z0-9_-]/gi, '_').substring(0, 40);
  const filename = `FocusTube_${safeTitle}.md`;

  triggerFileDownload(md, filename);
  showToast(`Downloaded ${filename}`);
}

function exportAllMarkdown() {
  if (allLectures.length === 0) {
    showToast('No lectures to export');
    return;
  }

  let bundleMd = `# FocusTube — Study Library Export\n\n`;
  bundleMd += `Generated: ${new Date().toLocaleString()}\n`;
  bundleMd += `Total Lectures: ${allLectures.length}\n\n`;
  bundleMd += `---\n\n`;

  allLectures.forEach((lec) => {
    bundleMd += generateLectureMarkdown(lec);
    bundleMd += `\n\n\\pagebreak\n\n`;
  });

  const filename = `FocusTube_Complete_Library_${new Date().toISOString().slice(0, 10)}.md`;
  triggerFileDownload(bundleMd, filename);
  showToast('Exported all lectures to Markdown');
}

function triggerFileDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getProblemBadgeInfo(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase().replace('www.', '');
    if (host.includes('leetcode')) {
      const slug = parsed.pathname.split('/')[2] || 'Problem';
      const cleanSlug = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return { label: `LeetCode (${cleanSlug})`, brandClass: 'problem-pill-leetcode' };
    }
    if (host.includes('github')) {
      const parts = parsed.pathname.replace(/^\//, '').split('/');
      const repo = parts[1] || parts[0] || 'Repo';
      return { label: `GitHub (${repo})`, brandClass: 'problem-pill-github' };
    }
    if (host.includes('hackerrank')) {
      const challenge = parsed.pathname.split('/')[2] || 'Challenge';
      return { label: `HackerRank (${challenge})`, brandClass: 'problem-pill-hackerrank' };
    }
    return { label: host, brandClass: 'problem-pill-generic' };
  } catch (_) {
    return { label: 'External Link', brandClass: 'problem-pill-generic' };
  }
}

function formatNoteContent(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function getDomainLabel(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.replace('www.', '');
    if (host.includes('leetcode')) return `LeetCode (${parsed.pathname.split('/')[2] || 'Problem'})`;
    if (host.includes('github')) return `GitHub (${parsed.pathname.replace(/^\//, '') || 'Repo'})`;
    if (host.includes('hackerrank')) return `HackerRank (${parsed.pathname.split('/')[2] || 'Challenge'})`;
    if (host.includes('codeforces')) return 'Codeforces';
    return host;
  } catch (_) {
    return 'External Link';
  }
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

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}
