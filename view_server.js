// dark mode logic
const darkModeKey = 'wallabag_dark_mode';
chrome.storage && chrome.storage.local.get([darkModeKey], (result) => {
  if (result && result[darkModeKey]) document.body.classList.add('dark-mode');
});

const urlParams = new URLSearchParams(window.location.search);
const idx = parseInt(urlParams.get('idx'), 10);
const SERVERS_KEY = 'wallabag_servers';

function setFormDisabled(disabled) {
  document.getElementById('server-name').disabled = disabled;
  document.getElementById('server-url').disabled = disabled;
  document.getElementById('client-id').disabled = disabled;
  document.getElementById('client-secret').disabled = disabled;
  document.getElementById('username').disabled = disabled && hasRefreshToken;
  document.getElementById('password').disabled = disabled && hasRefreshToken;
}

let hasRefreshToken = false;

chrome.storage.local.get([SERVERS_KEY], (result) => {
  const servers = result[SERVERS_KEY] || [];
  const server = servers[idx];
  if (!server) {
    document.getElementById('form-message').textContent = 'Server not found.';
    setFormDisabled(true);
    return;
  }
  document.getElementById('server-name').value = server.name || '';
  document.getElementById('server-url').value = server.url || '';
  document.getElementById('client-id').value = server.clientId || '';
  document.getElementById('client-secret').value = server.clientSecret || '';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  hasRefreshToken = !!server.refreshToken;
  if (hasRefreshToken) {
    document.getElementById('username').placeholder = '(not required)';
    document.getElementById('password').placeholder = '(not required)';
  } else {
    document.getElementById('username').placeholder = 'required';
    document.getElementById('password').placeholder = 'required';
  }
  setFormDisabled(true);
});

document.getElementById('edit-btn').onclick = function() {
  setFormDisabled(false);
  document.getElementById('edit-btn').style.display = 'none';
  document.getElementById('save-btn').style.display = '';
};

document.getElementById('cancel-btn').onclick = function() {
  window.location.href = 'options.html';
};

document.getElementById('server-form').onsubmit = async function(e) {
  e.preventDefault();
  document.getElementById('form-message').textContent = '';
  chrome.storage.local.get([SERVERS_KEY], async (result) => {
    const servers = result[SERVERS_KEY] || [];
    const server = servers[idx];
    if (!server) return;
    const name = document.getElementById('server-name').value.trim();
    const url = document.getElementById('server-url').value.trim();
    const clientId = document.getElementById('client-id').value.trim();
    const clientSecret = document.getElementById('client-secret').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!name || !url || !clientId || !clientSecret) {
      document.getElementById('form-message').textContent = 'All fields except username/password are required.';
      return;
    }
    // if no refresh token, username/password are required
    if (!server.refreshToken && (!username || !password)) {
      document.getElementById('form-message').textContent = 'Username and password are required to authenticate.';
      return;
    }
    // if username/password provided, try getting new tokens
    let newTokens = {};
    if (username && password) {
      try {
        const tokenResp = await fetch(url.replace(/\/$/, '') + '/oauth/v2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: clientId,
            client_secret: clientSecret,
            username,
            password
          })
        });
        if (!tokenResp.ok) {
          document.getElementById('form-message').textContent = 'Authentication failed: ' + tokenResp.status;
          return;
        }
        const tokenData = await tokenResp.json();
        if (!tokenData.access_token) {
          document.getElementById('form-message').textContent = 'Authentication failed: ' + JSON.stringify(tokenData);
          return;
        }
        newTokens = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: Date.now() + (tokenData.expires_in * 1000)
        };
      } catch (e) {
        document.getElementById('form-message').textContent = 'Error authenticating: ' + e;
        return;
      }
    }
    // update server info
    servers[idx] = {
      ...server,
      name,
      url,
      clientId,
      clientSecret,
      ...newTokens
    };
    chrome.storage.local.set({ [SERVERS_KEY]: servers }, () => {
      document.getElementById('form-message').textContent = 'Saved!';
      setFormDisabled(true);
      document.getElementById('edit-btn').style.display = '';
      document.getElementById('save-btn').style.display = 'none';
    });
  });
};
