// ==========================================================================
// FocusTube - Toolbar Popup Controller
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initDashboardLauncher();
  loadShortsQuota();
  loadQuickStats();
});

// --- 1. Dashboard Launcher ---
function initDashboardLauncher() {
  document.getElementById('open-dashboard-btn').addEventListener('click', () => {
    const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
    chrome.tabs.create({ url: dashboardUrl });
  });
}

// --- 2. Shorts Quota Management ---
function loadShortsQuota() {
  const today = new Date().toISOString().slice(0, 10);
  const defaultLimit = 5;

  const countText = document.getElementById('shorts-count-text');
  const progressBar = document.getElementById('shorts-progress-bar');
  const limitInput = document.getElementById('shorts-limit-input');
  const decBtn = document.getElementById('limit-dec-btn');
  const incBtn = document.getElementById('limit-inc-btn');

  chrome.storage.local.get(['shortsData'], (res) => {
    let data = res.shortsData || { date: today, count: 0, limit: defaultLimit };

    // Auto reset if new day
    if (data.date !== today) {
      data = { date: today, count: 0, limit: data.limit || defaultLimit };
      chrome.storage.local.set({ shortsData: data });
    }

    updateQuotaUI(data);

    // Stepper listeners
    decBtn.addEventListener('click', () => {
      let currentVal = parseInt(limitInput.value, 10) || defaultLimit;
      if (currentVal > 0) {
        currentVal -= 1;
        limitInput.value = currentVal;
        saveNewLimit(currentVal);
      }
    });

    incBtn.addEventListener('click', () => {
      let currentVal = parseInt(limitInput.value, 10) || defaultLimit;
      if (currentVal < 50) {
        currentVal += 1;
        limitInput.value = currentVal;
        saveNewLimit(currentVal);
      }
    });

    limitInput.addEventListener('change', () => {
      let val = parseInt(limitInput.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      if (val > 50) val = 50;
      limitInput.value = val;
      saveNewLimit(val);
    });
  });

  function saveNewLimit(newLimit) {
    chrome.storage.local.get(['shortsData'], (res) => {
      let d = res.shortsData || { date: today, count: 0, limit: defaultLimit };
      d.limit = newLimit;
      chrome.storage.local.set({ shortsData: d }, () => {
        updateQuotaUI(d);
      });
    });
  }

  function updateQuotaUI(data) {
    const count = data.count || 0;
    const limit = data.limit !== undefined ? data.limit : defaultLimit;

    countText.textContent = `${count} / ${limit}`;
    limitInput.value = limit;

    const percentage = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 100;
    progressBar.style.width = `${percentage}%`;

    // Dynamic color coding based on threshold
    if (percentage >= 100) {
      progressBar.style.backgroundColor = 'var(--accent-red)';
    } else if (percentage >= 70) {
      progressBar.style.backgroundColor = 'var(--accent-amber)';
    } else {
      progressBar.style.backgroundColor = 'var(--accent-green)';
    }
  }
}

// --- 3. Quick Stats ---
function loadQuickStats() {
  chrome.storage.local.get(null, (allData) => {
    const registry = allData.ft_videos || {};
    const lectureCount = Object.keys(registry).length;

    let noteCount = 0;
    let slideCount = 0;

    Object.keys(allData).forEach((key) => {
      if (key === 'ft_videos' || key === 'shortsData') return;
      const notes = allData[key];
      if (Array.isArray(notes)) {
        noteCount += notes.length;
        slideCount += notes.filter(n => !!n.screenshot).length;
      }
    });

    document.getElementById('popup-stat-lectures').textContent = lectureCount;
    document.getElementById('popup-stat-notes').textContent = noteCount;
    document.getElementById('popup-stat-slides').textContent = slideCount;
  });
}
