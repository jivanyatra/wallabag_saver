const SERVERS_KEY = 'wallabag_servers';

function applyDarkMode(enabled) {
  if (enabled) {
    document.documentElement.classList.add('dark-mode');
    document.body.classList.add('dark-mode');
  } else {
    document.documentElement.classList.remove('dark-mode');
    document.body.classList.remove('dark-mode');
  }
}

function setupTheme() {
  chrome.storage.local.get(['wallabag_dark_mode'], (result) => {
    const enabled = !!result['wallabag_dark_mode'];
    applyDarkMode(enabled);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  const bulkUrlsTextarea = document.getElementById('bulk-urls');
  const bulkSaveBtn = document.getElementById('bulk-save-btn');
  const bulkServerSelect = document.getElementById('bulk-server-select');
  const bulkMessage = document.getElementById('bulk-message');

  // Populate server dropdown
  chrome.storage.local.get([SERVERS_KEY], (result) => {
    const servers = result[SERVERS_KEY] || [];
    bulkServerSelect.innerHTML = '';
    servers.forEach((server, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = server.name ? server.name : server.url;
      bulkServerSelect.appendChild(opt);
    });
  });

  bulkSaveBtn.onclick = async () => {
    const urls = bulkUrlsTextarea.value.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      bulkMessage.textContent = 'Enter at least one URL.';
      bulkMessage.style.color = '#c62828';
      return;
    }
    chrome.storage.local.get([SERVERS_KEY], async (result) => {
      const servers = result[SERVERS_KEY] || [];
      const selectedIdx = bulkServerSelect.selectedIndex;
      const selectedServer = servers[selectedIdx];
      if (!selectedServer) {
        bulkMessage.textContent = 'Select a server.';
        bulkMessage.style.color = '#c62828';
        return;
      }
      let successCount = 0;
      for (const url of urls) {
        const ok = await saveUrlToServer(selectedServer, url);
        if (ok) successCount++;
  await new Promise(res => setTimeout(res, 150));
      }
      bulkMessage.textContent = `Saved ${successCount} of ${urls.length} URLs.`;
      bulkMessage.style.color = successCount === urls.length ? '#2e7d32' : '#c62828';
    });
  };
});

// Helper: refresh token if needed
function refreshTokenIfNeeded(server, idx) {
  return new Promise((resolve) => {
    if (!server.refreshToken || !server.clientId || !server.clientSecret) {
      resolve(server);
      return;
    }
    const now = Date.now();
    if (server.expiresAt && now < server.expiresAt - 60000) {
      resolve(server);
      return;
    }
    fetch(server.url.replace(/\/$/, '') + '/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: server.clientId,
        client_secret: server.clientSecret,
        refresh_token: server.refreshToken
      })
    })
      .then(resp => resp.json())
      .then(data => {
        if (data.access_token) {
          chrome.storage.local.get([SERVERS_KEY], (result) => {
            const servers = result[SERVERS_KEY] || [];
            servers[idx] = {
              ...server,
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: Date.now() + (data.expires_in * 1000)
            };
            chrome.storage.local.set({ [SERVERS_KEY]: servers }, () => {
              resolve(servers[idx]);
            });
          });
        } else {
          resolve(server);
        }
      })
      .catch(() => resolve(server));
  });
}

// Save a single URL
async function saveUrlToServer(server, url) {
  const idx = await getServerIndex(server);
  const freshServer = await refreshTokenIfNeeded(server, idx);
  const resp = await fetch(freshServer.url.replace(/\/$/, '') + '/api/entries', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + freshServer.accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });
  return resp.ok;
}

// Get server index from storage
function getServerIndex(server) {
  return new Promise((resolve) => {
    chrome.storage.local.get([SERVERS_KEY], (result) => {
      const servers = result[SERVERS_KEY] || [];
      const idx = servers.findIndex(s => s.url === server.url && s.username === server.username);
      resolve(idx);
    });
  });
}
