// dark mode logic
const darkModeKey = 'wallabag_dark_mode';
chrome.storage && chrome.storage.local.get([darkModeKey], (result) => {
  if (result && result[darkModeKey]) document.body.classList.add('dark-mode');
});

// password viewing toggle
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');
let passwordVisible = false;
togglePassword.addEventListener('click', () => {
  passwordVisible = !passwordVisible;
  passwordInput.type = passwordVisible ? 'text' : 'password';
  document.getElementById('eye-icon').innerHTML = passwordVisible
    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.042-3.292m3.087-2.727A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.973 9.973 0 01-4.293 5.411M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18"/>'
    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
});

const SERVERS_KEY = 'wallabag_servers';

document.getElementById('add-server-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('server-name').value.trim();
  const url = document.getElementById('server-url').value.trim();
  const clientId = document.getElementById('client-id').value.trim();
  const clientSecret = document.getElementById('client-secret').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = '';

  if (!url || !clientId || !clientSecret || !username || !password) {
    messageDiv.textContent = 'All fields are required.';
    return;
  }
  let finalName = name;
  if (!finalName) {
    try {
      const u = new URL(url);
      finalName = u.hostname;
    } catch {
      finalName = url;
    }
  }

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
      messageDiv.textContent = 'Authentication failed: ' + tokenResp.status;
      return;
    }
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) {
      messageDiv.textContent = 'Authentication failed: ' + JSON.stringify(tokenData);
      return;
    }
    // save server info and token
    chrome.storage.local.get([SERVERS_KEY], async (result) => {
      const servers = result[SERVERS_KEY] || [];
      const newServer = {
        name: finalName,
        url,
        clientId,
        clientSecret,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000)
      };
      servers.push(newServer);
      chrome.storage.local.set({ [SERVERS_KEY]: servers }, async () => {
        // fetch /api/info and show in message
        try {
          const infoResp = await fetch(url.replace(/\/$/, '') + '/api/info', {
            headers: {
              'Authorization': 'Bearer ' + tokenData.access_token
            }
          });
          if (infoResp.ok) {
            const info = await infoResp.json();
            messageDiv.textContent = 'Successfully added! ' + JSON.stringify(info);
          } else {
            messageDiv.textContent = 'Server added and authenticated! (But failed to fetch /api/info)';
          }
        } catch (e) {
          messageDiv.textContent = 'Server added and authenticated! (But error fetching /api/info: ' + e + ')';
        }
        setTimeout(() => {
          window.location.href = 'options.html';
        }, 2000);
      });
    });
  } catch (e) {
    messageDiv.textContent = 'Error authenticating: ' + e;
  }
});

document.getElementById('cancel').onclick = () => {
  window.location.href = 'options.html';
};
