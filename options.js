// dark mode logic
const darkModeKey = 'wallabag_dark_mode';
function applyDarkMode(enabled) {
	if (enabled) {
		document.body.classList.add('dark-mode');
	} else {
		document.body.classList.remove('dark-mode');
	}
}
chrome.storage.local.get([darkModeKey], (result) => {
	const enabled = !!result[darkModeKey];
	applyDarkMode(enabled);
});

// storage key
const SERVERS_KEY = 'wallabag_servers';

// load servers from storage
function loadServers() {
	chrome.storage.local.get([SERVERS_KEY], (result) => {
		const servers = result[SERVERS_KEY] || [];
		renderServers(servers);
	});
}

// render server list
function renderServers(servers) {
	const list = document.getElementById('servers-list');
	list.innerHTML = '';
	if (servers.length === 0) {
		list.innerHTML = '<p>No servers added yet.</p>';
		return;
	}
	servers.forEach((server, idx) => {
		const div = document.createElement('div');
		div.className = 'server-item';
		div.innerHTML = `
			<strong>${server.name ? server.name : server.url}</strong>
			<button data-idx="${idx}" class="view-server">View</button>
			<button data-idx="${idx}" class="delete-server">Delete</button>
		`;
		list.appendChild(div);
	});
	list.querySelectorAll('.view-server').forEach(btn => {
		btn.addEventListener('click', (e) => {
			const idx = btn.getAttribute('data-idx');
			window.location.href = `view_server.html?idx=${idx}`;
		});
	});
}

	// TOML encode/decode helpers (minimal)
	function serversToTOML(servers) {
		let toml = '';
			servers.forEach((s, i) => {
				toml += '[server_' + i + ']\n';
			Object.entries(s).forEach(([k, v]) => {
				if (typeof v === 'string') {
					toml += k + ' = "' + v.replace(/"/g, '\"') + '"\n';
				} else {
					toml += k + ' = ' + v + '\n';
				}
			});
			toml += '\n';
		});
		return toml;
	}
	function tomlToServers(toml) {
		const servers = [];
		const blocks = toml.split(/\[server_\d+\]/g).slice(1);
		blocks.forEach(block => {
			const server = {};
			block.split(/\n/).forEach(line => {
				const m = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.*)$/);
				if (m) {
					let val = m[2].trim();
					if (val.startsWith('"') && val.endsWith('"')) {
						val = val.slice(1, -1).replace(/\\"/g, '"');
					} else if (!isNaN(Number(val))) {
						val = Number(val);
					}
					server[m[1]] = val;
				}
			});
			if (Object.keys(server).length > 0) servers.push(server);
		});
		return servers;
	}

	// export servers
	document.getElementById('export-servers').onclick = function() {
			if (!confirm('Warning: The exported file contains secrets (client secrets, refresh tokens, etc.) in plain text. Anyone with this file can use your Wallabag accounts. Do you want to continue?')) return;
			chrome.storage.local.get([SERVERS_KEY], (result) => {
				const servers = result[SERVERS_KEY] || [];
				let toml, filename;
				if (servers.length === 0) {
					toml = '[server_0]\nname = ""\nurl = ""\nclientId = ""\nclientSecret = ""\naccessToken = ""\nrefreshToken = ""\nexpiresAt = 0\n';
					filename = 'template.toml';
				} else {
					toml = serversToTOML(servers);
					filename = 'wallabag_servers.toml';
				}
				const blob = new Blob([toml], { type: 'text/plain' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				setTimeout(() => {
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				}, 100);
			});
	};

	// import servers
	document.getElementById('import-servers').onclick = function() {
		document.getElementById('import-file').click();
	};

	document.getElementById('import-file').addEventListener('change', function(e) {
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = function(ev) {
			try {
				const servers = tomlToServers(ev.target.result);
				if (!Array.isArray(servers) || servers.length === 0) throw new Error('No servers found in file.');
				chrome.storage.local.set({ [SERVERS_KEY]: servers }, () => {
					alert('Servers imported!');
					loadServers();
				});
			} catch (err) {
				alert('Failed to import: ' + err);
			}
		};
		reader.readAsText(file);
	});


document.getElementById('add-server').onclick = function() {
	window.location.href = 'add_server.html';
};


function deleteServer(idx) {
	chrome.storage.local.get([SERVERS_KEY], (result) => {
		const servers = result[SERVERS_KEY] || [];
		servers.splice(idx, 1);
		chrome.storage.local.set({ [SERVERS_KEY]: servers }, loadServers);
	});
}


// refresh Wallabag access token if expired
async function refreshTokenIfNeeded(server, idx, callback) {
	if (!server.refreshToken || !server.clientId || !server.clientSecret) {
		callback(server);
		return;
	}
	const now = Date.now();
	if (server.expiresAt && now < server.expiresAt - 60000) { // 1 min buffer
		callback(server);
		return;
	}
	// refresh token
	try {
		const resp = await fetch(server.url.replace(/\/$/, '') + '/oauth/v2/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: server.clientId,
				client_secret: server.clientSecret,
				refresh_token: server.refreshToken
			})
		});
		if (!resp.ok) {
			alert('Failed to refresh token: ' + resp.status);
			callback(server);
			return;
		}
		const data = await resp.json();
		if (!data.access_token) {
			alert('Failed to refresh token: ' + JSON.stringify(data));
			callback(server);
			return;
		}
		// update server info in storage
		chrome.storage.local.get([SERVERS_KEY], (result) => {
			const servers = result[SERVERS_KEY] || [];
			servers[idx] = {
				...server,
				accessToken: data.access_token,
				refreshToken: data.refresh_token,
				expiresAt: Date.now() + (data.expires_in * 1000)
			};
			chrome.storage.local.set({ [SERVERS_KEY]: servers }, () => {
				callback(servers[idx]);
			});
		});
	} catch (e) {
		alert('Error refreshing token: ' + e);
		callback(server);
	}
}


function viewServer(idx) {
	chrome.storage.local.get([SERVERS_KEY], (result) => {
		const servers = result[SERVERS_KEY] || [];
		const server = servers[idx];
		if (server) {
			refreshTokenIfNeeded(server, idx, (updatedServer) => {
                alert(JSON.stringify(updatedServer, null, 2));});
		}
	});
}


document.getElementById('servers-list').addEventListener('click', (e) => {
	if (e.target.classList.contains('delete-server')) {
		deleteServer(Number(e.target.dataset.idx));
	} else if (e.target.classList.contains('view-server')) {
		viewServer(Number(e.target.dataset.idx));
	}
});

// init
loadServers();
