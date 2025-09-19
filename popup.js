// dark mode logic
const darkModeKey = 'wallabag_dark_mode';
function applyDarkMode(enabled) {
	if (enabled) {
		document.documentElement.classList.add('dark-mode');
		if (document.body) document.body.classList.add('dark-mode');
	} else {
		document.documentElement.classList.remove('dark-mode');
		if (document.body) document.body.classList.remove('dark-mode');
	}
}

function setupDarkModeToggle() {
	const darkModeToggle = document.getElementById('dark-mode-toggle');
	if (!darkModeToggle) return;
	// set initial state
	chrome.storage.local.get([darkModeKey], (result) => {
		const enabled = !!result[darkModeKey];
		darkModeToggle.checked = enabled;
		applyDarkMode(enabled);
	});
	// toggle listener
	darkModeToggle.addEventListener('change', (e) => {
		const enabled = e.target.checked;
		chrome.storage.local.set({ [darkModeKey]: enabled }, () => {
			applyDarkMode(enabled);
		});
	});
}

document.addEventListener('DOMContentLoaded', () => {
	chrome.storage.local.get([darkModeKey], (result) => {
		const enabled = !!result[darkModeKey];
		applyDarkMode(enabled);
	});
	setupDarkModeToggle();
});

const SERVERS_KEY = 'wallabag_servers';

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

function showMessage(text, type = "", closeAfter = false) {
  const msgDiv = document.getElementById("popup-message");
  if (!msgDiv) return;
  msgDiv.textContent = text;
  msgDiv.className = "show" + (type ? " " + type : "");
  setTimeout(() => {
    msgDiv.className = msgDiv.className.replace("show", "");
    if (closeAfter) window.close();
  }, 1800);
}

// Save a single URL
async function saveUrlToServer(server, url, closeAfter = false) {
  // is token fresh?
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
  if (!resp.ok) {
    showMessage('Failed to save URL: ' + resp.status, 'error');
    return false;
  }
  showMessage('Saved!', 'success', closeAfter);
  return true;
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

// handle Save Tab
async function handleSaveTab() {
  chrome.storage.local.get([SERVERS_KEY], async (result) => {
    const servers = result[SERVERS_KEY] || [];
    if (servers.length === 0) {
      showMessage('No Wallabag servers configured. Please add one in Options.', 'error');
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      showMessage('No active tab found.', 'error');
      return;
    }
    if (servers.length === 1) {
      await saveUrlToServer(servers[0], tab.url, true);
    } else {
      showServerSelect(servers, async (server) => {
        if (server) {
          await saveUrlToServer(server, tab.url, true);
          // Return to main menu so toast is visible
          document.getElementById('server-select').style.display = 'none';
          document.getElementById('menu').style.display = 'block';
        }
      });
    }
  });
}

// handle Save All Tabs
async function handleSaveAllTabs() {
  chrome.storage.local.get([SERVERS_KEY], async (result) => {
    const servers = result[SERVERS_KEY] || [];
    if (servers.length === 0) {
      showMessage('No Wallabag servers configured. Please add one in Options.', 'error');
      return;
    }
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const urls = tabs.map(t => t.url).filter(Boolean);
    if (servers.length === 1) {
      for (const url of urls) await saveUrlToServer(servers[0], url);
      showMessage('Saved all tabs!', 'success', true);
    } else {
      showServerSelect(servers, async (server) => {
        if (server) {
          for (const url of urls) await saveUrlToServer(server, url);
          showMessage('Saved all tabs!', 'success', true);
          document.getElementById('server-select').style.display = 'none';
          document.getElementById('menu').style.display = 'block';
        }
      });
    }
  });
}

// options
function showServerSelect(servers, callback) {
	const menu = document.getElementById('menu');
	const selectDiv = document.getElementById('server-select');
	menu.style.display = 'none';
	selectDiv.style.display = 'block';
	selectDiv.innerHTML = '<p>Select a server:</p>';
		servers.forEach((server, idx) => {
			const btn = document.createElement('button');
			btn.textContent = server.name ? server.name : server.url;
			btn.onclick = () => callback(server);
			selectDiv.appendChild(btn);
		});
	const cancelBtn = document.createElement('button');
	cancelBtn.textContent = 'Cancel';
	cancelBtn.onclick = () => {
		selectDiv.style.display = 'none';
		menu.style.display = 'block';
		callback(null);
	};
	selectDiv.appendChild(cancelBtn);
}

// button handler
document.getElementById('options').onclick = () => {
	chrome.runtime.openOptionsPage();
};

document.getElementById('save-tab').onclick = handleSaveTab;
document.getElementById('save-all-tabs').onclick = handleSaveAllTabs;
