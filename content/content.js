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

// 1. Listen for YouTube's internal navigation event
window.addEventListener('yt-navigate-finish', checkShortsQuota);

// 2. Fallback observer to catch URL changes that bypass yt-navigate-finish
let previousPath = window.location.pathname;
const observer = new MutationObserver(() => {
  if (window.location.pathname !== previousPath) {
    previousPath = window.location.pathname;
    checkShortsQuota();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// 3. Initial check when page loads
checkShortsQuota();