// ==========================================================================
// FocusTube - Study Dashboard & Problem Repository Controller
// Full-Page Library, Tag Filtering & Problem Linking
// ==========================================================================

let allLectures = []; // [{ id, title, channel, url, tags, problemLinks, updatedAt, createdAt, notes: [] }]
let activeTagFilter = 'all';
let searchQuery = '';
let currentSort = 'recent';

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadLibraryData();
});

function initEventListeners() {
  // Search
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    renderDashboard();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderDashboard();
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderDashboard();
  });

  // Refresh
  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadLibraryData();
    showToast('Library refreshed! 🔄');
  });

  // Export All
  document.getElementById('export-all-btn').addEventListener('click', exportAllMarkdown);

  // Problem Modal Handlers
  document.getElementById('close-problem-modal').addEventListener('click', closeProblemModal);
  document.getElementById('cancel-problem-btn').addEventListener('click', closeProblemModal);
  document.getElementById('save-problem-btn').addEventListener('click', saveProblemLink);

  // Lightbox Modal Handlers
  document.getElementById('close-image-modal').addEventListener('click', closeImageModal);
  document.getElementById('image-modal').addEventListener('click', (e) => {
    if (e.target.id === 'image-modal') closeImageModal();
  });
}

// --- 1. Load & Sync Library Data ---
function loadLibraryData() {
  chrome.storage.local.get(null, (allData) => {
    let registry = allData.ft_videos || {};
    const recoveredLectures = [];

    // Scan all storage keys to discover and backfill any historical notes
    Object.keys(allData).forEach((key) => {
      if (key === 'ft_videos' || key === 'shortsData') return;
      const value = allData[key];
      if (Array.isArray(value) && value.length > 0 && value[0].timestamp !== undefined) {
        if (!registry[key]) {
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
      }
    });

    if (recoveredLectures.length > 0) {
      chrome.storage.local.set({ ft_videos: registry });
    }

    // Gather lecture records with their associated notes
    const lectureList = [];
    Object.keys(registry).forEach((videoId) => {
      const meta = registry[videoId];
      const notes = (allData[videoId] || []).slice().sort((a, b) => a.timestamp - b.timestamp);

      // Consolidate unique tags and problem links
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
        notes: notes
      });
    });

    allLectures = lectureList;
    updateGlobalStats();
    renderTagChips();
    renderDashboard();
  });
}

// --- 2. Update Global Stats ---
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

// --- 3. Render Tag Chips Carousel ---
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

// --- 4. Filter, Sort & Render Dashboard ---
function renderDashboard() {
  const container = document.getElementById('lectures-list');
  const emptyState = document.getElementById('empty-state');

  // Filter
  let filtered = allLectures.filter((lec) => {
    // Topic tag filter
    if (activeTagFilter !== 'all') {
      if (!lec.tags || !lec.tags.includes(activeTagFilter)) {
        return false;
      }
    }

    // Search query match
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

  // Sort
  filtered.sort((a, b) => {
    if (currentSort === 'recent') {
      return b.updatedAt - a.updatedAt;
    } else if (currentSort === 'notes') {
      return b.notes.length - a.notes.length;
    } else if (currentSort === 'title') {
      return a.title.localeCompare(b.title);
    }
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

// --- 5. Create Lecture Card Element ---
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

  // Attached problem badges
  let problemBadgesHtml = '';
  if (lec.problemLinks && lec.problemLinks.length > 0) {
    problemBadgesHtml = lec.problemLinks.map(url => {
      const info = getProblemBadgeInfo(url);
      return `<a href="${url}" target="_blank" class="problem-pill ${info.brandClass}" title="${url}">🔗 ${info.label}</a>`;
    }).join('');
  }

  // Topic tags
  let tagsHtml = '';
  if (lec.tags && lec.tags.length > 0) {
    tagsHtml = lec.tags.map(t => `<span class="tag-badge">${t}</span>`).join('');
  }

  card.innerHTML = `
    <div class="lecture-card-header">
      <div class="lecture-title-col">
        <h2 class="lecture-title">
          <a href="${lec.url}" target="_blank" title="Open YouTube Lecture">
            ${escapeHtml(lec.title)} ↗
          </a>
        </h2>
        <div class="lecture-meta">
          <span class="channel-tag">📺 ${escapeHtml(lec.channel)}</span>
          <span class="lecture-stats-badge">📝 ${lec.notes.length} Notes</span>
          <span class="lecture-stats-badge">📸 ${slideCount} Slides</span>
          <span>Updated: ${formattedDate}</span>
        </div>
      </div>
      <div class="lecture-actions">
        <button class="btn btn-secondary btn-sm toggle-notes-btn">
          👁️ Show Notes (${lec.notes.length})
        </button>
        <button class="btn btn-secondary btn-sm copy-md-btn" title="Copy Obsidian/Notion Markdown">
          📋 Copy MD
        </button>
        <button class="btn btn-primary btn-sm dl-md-btn" title="Download .md File">
          ⬇️ Export
        </button>
        <button class="btn btn-danger-outline btn-sm delete-lec-btn" title="Delete Lecture">
          🗑️
        </button>
      </div>
    </div>

    <div class="problem-links-row">
      <span class="problem-label">Attached Links:</span>
      ${problemBadgesHtml}
      <button class="add-problem-pill" data-video-id="${lec.id}">+ Add Link</button>
    </div>

    ${tagsHtml ? `<div class="lecture-tags-row">${tagsHtml}</div>` : ''}

    <div class="lecture-notes-section" style="display:none;">
      <div class="notes-grid"></div>
    </div>
  `;

  // Bind Card Events
  const notesSection = card.querySelector('.lecture-notes-section');
  const toggleNotesBtn = card.querySelector('.toggle-notes-btn');
  const notesGrid = card.querySelector('.notes-grid');

  toggleNotesBtn.addEventListener('click', () => {
    const isHidden = notesSection.style.display === 'none';
    if (isHidden) {
      renderNotesGrid(lec, notesGrid);
      notesSection.style.display = 'flex';
      toggleNotesBtn.textContent = `🙈 Hide Notes (${lec.notes.length})`;
    } else {
      notesSection.style.display = 'none';
      toggleNotesBtn.textContent = `👁️ Show Notes (${lec.notes.length})`;
    }
  });

  // Copy Markdown
  card.querySelector('.copy-md-btn').addEventListener('click', () => {
    const md = generateLectureMarkdown(lec);
    navigator.clipboard.writeText(md).then(() => {
      showToast('Markdown copied to clipboard! Ready for Obsidian/Notion 📋');
    });
  });

  // Download Markdown
  card.querySelector('.dl-md-btn').addEventListener('click', () => {
    downloadMarkdownFile(lec);
  });

  // Delete Lecture
  card.querySelector('.delete-lec-btn').addEventListener('click', () => {
    if (confirm(`Are you sure you want to delete "${lec.title}" and all its notes?`)) {
      deleteLecture(lec.id);
    }
  });

  // Add Problem Link
  card.querySelector('.add-problem-pill').addEventListener('click', () => {
    openProblemModal(lec.id);
  });

  return card;
}

// --- 6. Render Notes Grid for a Lecture ---
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

    let screenshotHtml = '';
    if (note.screenshot) {
      screenshotHtml = `<img src="${note.screenshot}" class="note-screenshot-thumb" alt="Captured Slide" title="Click to enlarge" />`;
    }

    let problemHtml = '';
    if (note.problemUrl) {
      const info = getProblemBadgeInfo(note.problemUrl);
      problemHtml = `<a href="${note.problemUrl}" target="_blank" class="problem-pill ${info.brandClass}" style="font-size:10px; margin-top:4px;">🔗 ${info.label}</a>`;
    }

    item.innerHTML = `
      <div class="note-item-header">
        <a href="${seekUrl}" target="_blank" class="timestamp-link" title="Play at ${note.timestampFormatted || '00:00'}">
          ▶ ${note.timestampFormatted || '00:00'}
        </a>
        <button class="note-delete-btn" title="Delete this note">✕</button>
      </div>
      ${screenshotHtml}
      <div class="note-content-text">${formatNoteContent(note.content)}</div>
      ${problemHtml}
    `;

    // Zoom Image in Lightbox
    const thumb = item.querySelector('.note-screenshot-thumb');
    if (thumb) {
      thumb.addEventListener('click', () => {
        openImageModal(note.screenshot);
      });
    }

    // Delete single note
    item.querySelector('.note-delete-btn').addEventListener('click', () => {
      deleteSingleNote(lec.id, note.id);
    });

    container.appendChild(item);
  });
}

// --- 7. Problem Modal Controller ---
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
        showToast('Problem link attached! 🔗');
      });
    }
  });
}

// --- 8. Lightbox Image Modal ---
function openImageModal(src) {
  const modal = document.getElementById('image-modal');
  const img = document.getElementById('enlarged-img');
  img.src = src;
  modal.style.display = 'flex';
}

function closeImageModal() {
  document.getElementById('image-modal').style.display = 'none';
}

// --- 9. Deletions ---
function deleteLecture(videoId) {
  chrome.storage.local.remove([videoId], () => {
    chrome.storage.local.get(['ft_videos'], (res) => {
      const registry = res.ft_videos || {};
      delete registry[videoId];
      chrome.storage.local.set({ ft_videos: registry }, () => {
        loadLibraryData();
        showToast('Lecture deleted. 🗑️');
      });
    });
  });
}

function deleteSingleNote(videoId, noteId) {
  chrome.storage.local.get([videoId, 'ft_videos'], (res) => {
    const notes = res[videoId] || [];
    const updated = notes.filter(n => n.id !== noteId);

    const updates = { [videoId]: updated };
    if (res.ft_videos && res.ft_videos[videoId]) {
      res.ft_videos[videoId].noteCount = updated.length;
      res.ft_videos[videoId].updatedAt = Date.now();
      updates.ft_videos = res.ft_videos;
    }

    chrome.storage.local.set(updates, () => {
      loadLibraryData();
      showToast('Note deleted.');
    });
  });
}

// --- 10. Markdown Export Engine (Obsidian / Notion Ready) ---
function generateLectureMarkdown(lec) {
  const dateStr = new Date(lec.updatedAt).toISOString().slice(0, 10);
  const cleanTags = (lec.tags || []).map(t => t.replace('#', '')).filter(Boolean);

  let md = '';

  // 1. Obsidian / Notion YAML Frontmatter
  md += `---\n`;
  md += `title: "${lec.title.replace(/"/g, '\\"')}"\n`;
  md += `source: "${lec.url}"\n`;
  md += `channel: "${lec.channel.replace(/"/g, '\\"')}"\n`;
  md += `date: ${dateStr}\n`;
  if (cleanTags.length > 0) {
    md += `tags:\n`;
    cleanTags.forEach(t => {
      md += `  - ${t}\n`;
    });
  }
  md += `---\n\n`;

  // 2. Header & Metadata
  md += `# ${lec.title}\n\n`;
  md += `- **Channel:** ${lec.channel}\n`;
  md += `- **Lecture URL:** [Watch on YouTube](${lec.url})\n`;
  md += `- **Date Studied:** ${dateStr}\n`;

  if (lec.tags && lec.tags.length > 0) {
    md += `- **Topics:** ${lec.tags.join(' ')}\n`;
  }
  md += `\n`;

  // 3. Problem & Reference Repository Links
  if (lec.problemLinks && lec.problemLinks.length > 0) {
    md += `### 📌 Associated Problems & Code References\n\n`;
    lec.problemLinks.forEach(p => {
      const label = getDomainLabel(p);
      md += `- [${label}](${p})\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;
  md += `## 📝 Lecture Notes & Timestamps\n\n`;

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
        md += `> 🔗 **Problem Link:** [${getDomainLabel(note.problemUrl)}](${note.problemUrl})\n\n`;
      }

      if (note.screenshot) {
        md += `![Slide Capture at ${formattedTime}](${note.screenshot})\n\n`;
      }

      md += `\n`;
    });
  }

  md += `---\n`;
  md += `*Exported from FocusTube Distraction-Free Study Workspace*\n`;

  return md;
}

function downloadMarkdownFile(lec) {
  const md = generateLectureMarkdown(lec);
  const safeTitle = lec.title.replace(/[^a-z0-9_-]/gi, '_').substring(0, 40);
  const filename = `FocusTube_${safeTitle}.md`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Downloaded ${filename}! 📄`);
}

function exportAllMarkdown() {
  if (allLectures.length === 0) {
    showToast('No lectures to export.');
    return;
  }

  let bundleMd = `# FocusTube - Study Library Export\n\n`;
  bundleMd += `Generated on: ${new Date().toLocaleString()}\n`;
  bundleMd += `Total Lectures: ${allLectures.length}\n\n`;
  bundleMd += `---\n\n`;

  allLectures.forEach((lec) => {
    bundleMd += generateLectureMarkdown(lec);
    bundleMd += `\n\n\\pagebreak\n\n`;
  });

  const blob = new Blob([bundleMd], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FocusTube_Complete_Library_${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('All lectures exported to Markdown! 📦');
}

// --- 11. Helpers ---
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
  const escaped = escapeHtml(text);
  return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
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
