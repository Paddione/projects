const socket = io({ withCredentials: true });

document.getElementById('logout-btn').addEventListener('click', async () => {
    const res = await fetch('/api/logout', {
        credentials: 'include'
    });
    if (res.ok) window.location.href = '/login.html';
});

const servicesGrid = document.getElementById('services-grid');
const vramUsedEl = document.getElementById('vram-used');
const vramTotalEl = document.getElementById('vram-total');
const vramBar = document.getElementById('vram-bar');
const vramPercentEl = document.getElementById('vram-percent');

const cpuUsageEl = document.getElementById('cpu-usage');
const cpuBar = document.getElementById('cpu-bar');
const ramUsedEl = document.getElementById('ram-used');
const ramTotalEl = document.getElementById('ram-total');
const ramBar = document.getElementById('ram-bar');
const diskUsedEl = document.getElementById('disk-used');
const diskTotalEl = document.getElementById('disk-total');
const diskBar = document.getElementById('disk-bar');
const stackRunningEl = document.getElementById('stack-running');
const stackTotalEl = document.getElementById('stack-total');
const stackUpdatedEl = document.getElementById('stack-updated');

const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
const logModal = document.getElementById('log-modal');
const logOutput = document.getElementById('log-output');
const logTitle = document.getElementById('log-title');
const logSubtitle = document.getElementById('log-subtitle');
const logClose = document.getElementById('log-close');
const logRefresh = document.getElementById('log-refresh');

const userAdminToggle = document.getElementById('user-admin-toggle');
const userAdminPanel = document.getElementById('user-admin-panel');
const userAdminBackdrop = document.getElementById('user-admin-backdrop');
const userAdminClose = document.getElementById('user-admin-close');
const userSearch = document.getElementById('user-search');
const userRoleFilter = document.getElementById('user-role-filter');
const userRefresh = document.getElementById('user-refresh');
const userAdminMessage = document.getElementById('user-admin-message');
const userAdminList = document.getElementById('user-admin-list');
const userCountAdmin = document.getElementById('user-count-admin');
const userCountUser = document.getElementById('user-count-user');
const userCountPending = document.getElementById('user-count-pending');
const newUserName = document.getElementById('new-user-name');
const newUserEmail = document.getElementById('new-user-email');
const newUserRole = document.getElementById('new-user-role');
const userCreate = document.getElementById('user-create');

const browserHubToggle = document.getElementById('browser-hub-toggle');
const browserHubPanel = document.getElementById('browser-hub-panel');
const browserHubBackdrop = document.getElementById('browser-hub-backdrop');
const browserHubClose = document.getElementById('browser-hub-close');
const browserGroupsList = document.getElementById('browser-groups-list');
const browserTaskDetail = document.getElementById('browser-task-detail');
const currentTaskListName = document.getElementById('current-task-group-name');
const currentTaskList = document.getElementById('current-task-list');

const groupLabels = {
    core: 'Core AI',
    business: 'Business Apps',
    data: 'Data Layer',
    pipeline: 'Pipeline',
    creative: 'Creative',
    portal: 'Portal'
};

let servicesData = [];
const serviceState = {};
let activeFilter = 'all';
let activeLogServiceId = null;
let usersData = [];
let availableModels = {}; // Store available models per service
let environmentsData = {}; // Store docker environment data
let containersData = []; // Store discovered Docker containers
let npmServersData = []; // Store npm server status
let activeContainerFilter = 'all';
let activeEnvFilter = 'all'; // Environment filter for containers
let currentEnvironment = 'production'; // Current dashboard environment
let isHotReloadActive = false; // Hot reload status

async function fetchServices() {
    try {
        const res = await fetch('/api/services', {
            credentials: 'include'
        });
        if (res.redirected) {
            window.location.href = res.url;
            return;
        }
        if (res.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        if (!res.ok) {
            throw new Error('Failed to load services');
        }
        servicesData = await res.json();

        // Fetch available models for each service
        for (const service of servicesData) {
            try {
                const modelsRes = await fetch(`/api/models/${service.id}`, {
                    credentials: 'include'
                });
                if (modelsRes.ok) {
                    const data = await modelsRes.json();
                    if (data.models && data.models.length > 0) {
                        availableModels[service.id] = data.models;
                    }
                }
            } catch (err) {
                console.error(`Failed to fetch models for ${service.id}`, err);
            }
        }

        renderServices();
    } catch (err) {
        console.error('Unable to fetch services', err);
        servicesGrid.innerHTML = '<div class="card">Unable to load services. Please log in again.</div>';
    }
}

async function fetchEnvironments() {
    try {
        const res = await fetch('/api/environments', {
            credentials: 'include'
        });

        // Handle authentication redirect
        if (res.redirected) {
            window.location.href = res.url;
            return;
        }

        if (res.status === 401) {
            window.location.href = '/login.html';
            return;
        }

        if (!res.ok) {
            throw new Error('Failed to load environments');
        }

        const data = await res.json();

        // Check if we got proper data
        if (!data || !data.environments) {
            throw new Error('Invalid response format');
        }

        environmentsData = data.environments;
        renderEnvironments();
    } catch (err) {
        console.error('Unable to fetch environments', err);
        const grid = document.getElementById('environments-grid');
        if (grid) {
            grid.innerHTML = '<div class="env-card"><div class="env-header"><h3>Unable to load Docker environments</h3></div><div class="env-info">Please check logs or refresh the page.</div></div>';
        }
    }
}

async function fetchContainers() {
    try {
        const res = await fetch('/api/containers', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to load containers');
        const data = await res.json();
        containersData = data.containers || [];
        renderContainers();
    } catch (err) {
        console.error('Unable to fetch containers', err);
        const grid = document.getElementById('containers-grid');
        if (grid) {
            grid.innerHTML = '<div class="card">Unable to load containers.</div>';
        }
    }
}

async function fetchNpmServers() {
    try {
        const res = await fetch('/api/npm-servers', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to load npm servers');
        const data = await res.json();
        npmServersData = data.servers || [];
        renderNpmServers();
    } catch (err) {
        console.error('Unable to fetch npm servers', err);
        const grid = document.getElementById('npm-servers-grid');
        if (grid) {
            grid.innerHTML = '<div class="card">Unable to load npm servers.</div>';
        }
    }
}

function renderEnvironments() {
    const grid = document.getElementById('environments-grid');
    if (!grid) return;

    grid.innerHTML = Object.entries(environmentsData).map(([id, env]) => {
        const isRunning = env.running || false;
        const runningCount = env.runningCount || 0;
        const total = env.total || 0;
        const statusClass = isRunning ? 'running' : 'stopped';
        const statusText = isRunning ? `Running (${runningCount}/${total})` : 'Stopped';

        return `
        <div class="env-card">
            <div class="env-header">
                <h3>${env.name}</h3>
                <div class="status-badge ${statusClass}">${statusText}</div>
            </div>
            <div class="env-info">
                <div class="env-path">${env.path}</div>
                <div class="env-compose-files">${env.composeFiles.join(', ')}</div>
            </div>
            ${env.services && env.services.length > 0 ? `
                <div class="env-services">
                    ${env.services.map(svc => `
                        <div class="env-service" data-state="${svc.state}">
                            <span class="env-service-name">${svc.name}</span>
                            <span class="env-service-status">${svc.state}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="env-controls">
                <button class="ctrl-btn start" onclick="controlEnvironment('${id}', 'start')" ${isRunning ? 'disabled' : ''}>▶ Start</button>
                <button class="ctrl-btn restart" onclick="controlEnvironment('${id}', 'restart')">⟳ Restart</button>
                <button class="ctrl-btn stop" onclick="controlEnvironment('${id}', 'stop')" ${!isRunning ? 'disabled' : ''}>⬛ Stop</button>
                <button class="ctrl-btn down" onclick="controlEnvironment('${id}', 'down')">🗑 Down</button>
            </div>
        </div>
        `;
    }).join('');
}

async function controlEnvironment(envId, action) {
    if (action === 'down' && !confirm(`Are you sure you want to remove all containers in ${environmentsData[envId]?.name}?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/environments/${envId}/${action}`, {
            method: 'POST',
            credentials: 'include'
        });

        const result = await res.json();

        if (!result.success) {
            alert(`Failed to ${action} environment: ${result.error}`);
        } else {
            // Refresh environments after a short delay
            setTimeout(fetchEnvironments, 2000);
        }
    } catch (err) {
        console.error(`Failed to ${action} environment:`, err);
        alert(`Failed to ${action} environment. Check console for details.`);
    }
}

function renderContainers() {
    const grid = document.getElementById('containers-grid');
    if (!grid) return;

    if (!containersData || containersData.length === 0) {
        grid.innerHTML = '<div class="card">No running containers found.</div>';
        return;
    }

    const filtered = containersData.filter(container => {
        // Filter by project
        if (activeContainerFilter !== 'all' && container.project !== activeContainerFilter) {
            return false;
        }
        // Filter by environment
        if (activeEnvFilter !== 'all' && container.env !== activeEnvFilter) {
            return false;
        }
        return true;
    });

    grid.innerHTML = filtered.map(container => {
        const statusClass = container.state === 'running' ? 'running' : 'stopped';
        return `
        <div class="card container-card" data-project="${container.project}" data-env="${container.env}">
            <div class="card-header">
                <div class="card-title-group">
                    <h4>${container.name}</h4>
                    <div class="card-tags">
                        <span class="tag">${container.project}</span>
                        <span class="tag subtle">${container.env}</span>
                    </div>
                </div>
                <div class="status-badge ${statusClass}">${container.state}</div>
            </div>
            <div class="container-details">
                <div class="metric-item">
                    <span class="metric-label">Image</span>
                    <span class="metric-value">${container.image}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Ports</span>
                    <span class="metric-value">${container.ports || 'None'}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">ID</span>
                    <span class="metric-value">${container.id}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');

    // Setup container filter buttons (project)
    const containerFilterBtns = document.querySelectorAll('[data-container-filter]');
    containerFilterBtns.forEach(btn => {
        btn.onclick = () => {
            containerFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeContainerFilter = btn.dataset.containerFilter || 'all';
            renderContainers();
        };
    });

    // Setup environment filter buttons
    const envFilterBtns = document.querySelectorAll('[data-env-filter]');
    envFilterBtns.forEach(btn => {
        btn.onclick = () => {
            envFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeEnvFilter = btn.dataset.envFilter || 'all';
            renderContainers();
        };
    });
}

function renderNpmServers() {
    const grid = document.getElementById('npm-servers-grid');
    if (!grid) return;

    if (!npmServersData || npmServersData.length === 0) {
        grid.innerHTML = '<div class="card">No npm servers configured.</div>';
        return;
    }

    grid.innerHTML = npmServersData.map(server => {
        const statusClass = server.running ? 'running' : 'stopped';
        const statusText = server.running ? 'Running' : 'Stopped';

        return `
        <div class="card npm-server-card">
            <div class="card-header">
                <div class="card-title-group">
                    <h4>${server.name}</h4>
                    <div class="card-tags">
                        <span class="tag">${server.project}</span>
                        <span class="tag subtle">Port: ${server.port || 'N/A'}</span>
                    </div>
                </div>
                <div class="status-badge ${statusClass}">${statusText}</div>
            </div>
            <p class="card-desc">${server.description}</p>
            <div class="card-metrics">
                <div class="metric-item">
                    <span class="metric-label">Path</span>
                    <span class="metric-value">${server.path}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Script</span>
                    <span class="metric-value">${server.script}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Port Status</span>
                    <span class="metric-value">${server.portInUse ? 'In Use' : 'Available'}</span>
                </div>
            </div>
            <div class="card-footer">
                <div class="control-group">
                    <button class="ctrl-btn start" onclick="controlNpmServer('${server.id}', 'start')" ${server.running ? 'disabled' : ''}>▶ Start</button>
                    <button class="ctrl-btn stop" onclick="controlNpmServer('${server.id}', 'stop')" ${!server.running ? 'disabled' : ''}>⬛ Stop</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

async function controlNpmServer(serverId, action) {
    try {
        const res = await fetch(`/api/npm-servers/${serverId}/${action}`, {
            method: 'POST',
            credentials: 'include'
        });

        const result = await res.json();

        if (!result.success) {
            alert(`Failed to ${action} npm server: ${result.error || result.message}`);
        } else {
            // Refresh npm servers after a short delay
            setTimeout(fetchNpmServers, 1000);
        }
    } catch (err) {
        console.error(`Failed to ${action} npm server:`, err);
        alert(`Failed to ${action} npm server. Check console for details.`);
    }
}

function getEndpointLabel(url) {
    if (!url) return 'Local';
    try {
        return new URL(url).host;
    } catch (e) {
        return url;
    }
}

function renderServices() {
    servicesGrid.innerHTML = servicesData.map(service => {
        const group = service.group || 'other';
        const groupLabel = groupLabels[group] || group;
        const endpointLabel = getEndpointLabel(service.url);
        const endpointMarkup = service.url
            ? `<a href="${service.url}" target="_blank" class="metric-link">${endpointLabel}</a>`
            : '<span class="metric-muted">Local</span>';
        const actionButtons = [
            `<button class="action-btn" onclick="openLogs('${service.id}')">LOGS</button>`,
            service.url ? `<button class="action-btn" onclick="openService('${service.url}')">OPEN</button>` : '',
            service.url ? `<button class="action-btn" onclick="copyServiceUrl('${service.url}')">COPY URL</button>` : ''
        ].filter(Boolean).join('');

        // Model selector dropdown if available
        const hasModelSelection = availableModels[service.id] && availableModels[service.id].length > 0;
        const modelSelectorMarkup = hasModelSelection ? `
            <div class="model-selector">
                <label class="model-selector-label">
                    <span>Model:</span>
                    <select id="model-select-${service.id}" class="model-select" onchange="handleModelChange('${service.id}', this.value)">
                        ${availableModels[service.id].map(model => `
                            <option value="${model.id}" ${model.id === service.model ? 'selected' : ''}>
                                ${model.name} (${model.vram}, Context: ${model.contextSize})
                            </option>
                        `).join('')}
                    </select>
                </label>
            </div>
        ` : '';

        return `
        <div class="card" id="card-${service.id}" data-group="${group}">
            <div class="card-header">
                <div class="card-title-group">
                    <h3>
                        ${service.url ? `<a href="${service.url}" target="_blank" class="service-link">${service.name} <span>↗</span></a>` : service.name}
                    </h3>
                    <div class="card-model">${service.model}</div>
                    <div class="card-tags">
                        <span class="tag">${groupLabel}</span>
                        <span class="tag subtle">${service.type}</span>
                    </div>
                </div>
                <div class="status-badge stopped" id="status-${service.id}">Stopped</div>
            </div>
            <p class="card-desc">${service.description}</p>

            ${modelSelectorMarkup}

            <div class="card-metrics">
                <div class="metric-item">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value" id="uptime-${service.id}">--</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Endpoint</span>
                    ${endpointMarkup}
                </div>
                <div class="metric-item">
                    <span class="metric-label">Est. VRAM</span>
                    <span class="metric-value">${service.vramEstimate}</span>
                </div>
            </div>

            <div class="error-zone" id="error-${service.id}" style="display: none;">
                <div class="error-header">
                    <span>ERROR</span>
                    <button onclick="clearError('${service.id}')">✕</button>
                </div>
                <div class="error-msg"></div>
            </div>

            <div class="card-footer">
                <div class="control-group">
                    <button class="ctrl-btn start" title="Start" id="start-${service.id}" onclick="controlService('${service.id}', 'start')">▶</button>
                    <button class="ctrl-btn restart" title="Restart" id="restart-${service.id}" onclick="controlService('${service.id}', 'restart')">⟳</button>
                    <button class="ctrl-btn stop" title="Stop" id="stop-${service.id}" onclick="controlService('${service.id}', 'stop')">⬛</button>
                </div>
                <div class="action-group">
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
    }).join('');

    applyFilter();
}

function applyFilter() {
    const cards = Array.from(document.querySelectorAll('.card'));
    cards.forEach(card => {
        const group = card.dataset.group || 'other';
        const show = activeFilter === 'all' || group === activeFilter;
        card.style.display = show ? '' : 'none';
    });
}

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        activeFilter = button.dataset.filter || 'all';
        applyFilter();
    });
});

function massAction(action) {
    if (!confirm(`Are you sure you want to ${action} ALL services?`)) return;
    servicesData.forEach(service => {
        controlService(service.id, action);
    });
}

function controlService(id, action) {
    const startBtn = document.getElementById(`start-${id}`);
    const stopBtn = document.getElementById(`stop-${id}`);
    const restartBtn = document.getElementById(`restart-${id}`);

    [startBtn, stopBtn, restartBtn].forEach(b => b && (b.disabled = true));

    socket.emit('control_service', { serviceId: id, action });
}

function clearError(id) {
    socket.emit('clear_error', id);
}

async function handleModelChange(serviceId, modelId) {
    try {
        const res = await fetch(`/api/models/${serviceId}/select`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelId })
        });

        if (!res.ok) {
            throw new Error('Failed to update model');
        }

        const data = await res.json();

        // Update local service data
        const service = servicesData.find(s => s.id === serviceId);
        if (service) {
            service.model = modelId;

            // Update the model display in the card
            const modelDisplay = document.querySelector(`#card-${serviceId} .card-model`);
            if (modelDisplay) {
                modelDisplay.textContent = modelId;
            }

            // Update VRAM estimate
            const modelInfo = availableModels[serviceId]?.find(m => m.id === modelId);
            if (modelInfo) {
                service.vramEstimate = modelInfo.vram;
                const vramDisplay = document.querySelector(`#card-${serviceId} .card-metrics .metric-item:last-child .metric-value`);
                if (vramDisplay) {
                    vramDisplay.textContent = modelInfo.vram;
                }
            }
        }

        console.log(`Model for ${serviceId} updated to ${modelId}`);
    } catch (err) {
        console.error('Failed to update model:', err);
        alert('Failed to update model. Please try again.');
        // Revert the dropdown selection
        const select = document.getElementById(`model-select-${serviceId}`);
        if (select) {
            const service = servicesData.find(s => s.id === serviceId);
            if (service) {
                select.value = service.model;
            }
        }
    }
}

function formatDuration(ms) {
    if (!ms || ms < 0) return '--';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function formatTimeStamp(date) {
    if (!date) return '--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function openService(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener');
}

async function copyServiceUrl(url) {
    if (!url) return;
    try {
        await navigator.clipboard.writeText(url);
    } catch (err) {
        const tempInput = document.createElement('input');
        tempInput.value = url;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
    }
}

async function openLogs(serviceId) {
    activeLogServiceId = serviceId;
    const service = servicesData.find(item => item.id === serviceId);
    logTitle.textContent = service ? `${service.name} Logs` : 'Service Logs';
    logSubtitle.textContent = service ? service.model : '';
    logOutput.textContent = 'Loading...';
    logModal.classList.remove('hidden');
    await refreshLogs();
}

async function refreshLogs() {
    if (!activeLogServiceId) return;
    try {
        const res = await fetch(`/api/services/${activeLogServiceId}/logs`, {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Unable to load logs');
        const data = await res.json();
        logOutput.textContent = data.logs || 'No logs available.';
    } catch (err) {
        logOutput.textContent = 'Unable to load logs.';
    }
}

function closeLogs() {
    logModal.classList.add('hidden');
    activeLogServiceId = null;
}

logClose.addEventListener('click', closeLogs);
logRefresh.addEventListener('click', refreshLogs);

logModal.addEventListener('click', (event) => {
    if (event.target === logModal) closeLogs();
});

function openUserAdmin() {
    userAdminPanel.classList.add('open');
    userAdminBackdrop.classList.add('visible');
    fetchUsers();
}

function closeUserAdmin() {
    userAdminPanel.classList.remove('open');
    userAdminBackdrop.classList.remove('visible');
}

let userMessageTimeout;

function showUserMessage(message, autoHide = true) {
    userAdminMessage.textContent = message;
    userAdminMessage.classList.add('visible');
    if (userMessageTimeout) clearTimeout(userMessageTimeout);
    if (autoHide) {
        userMessageTimeout = setTimeout(() => {
            userAdminMessage.classList.remove('visible');
        }, 2000);
    }
}

userAdminToggle.addEventListener('click', openUserAdmin);
userAdminClose.addEventListener('click', closeUserAdmin);
userAdminBackdrop.addEventListener('click', closeUserAdmin);

userSearch.addEventListener('input', renderUsers);
userRoleFilter.addEventListener('change', renderUsers);
userRefresh.addEventListener('click', fetchUsers);
userCreate.addEventListener('click', createUser);

userAdminList.addEventListener('change', async (event) => {
    if (!event.target.classList.contains('role-select')) return;
    const userId = event.target.dataset.userId;
    const role = event.target.value;
    await updateUserRole(userId, role);
});

userAdminList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const userId = button.dataset.userId;
    const action = button.dataset.action;
    if (action === 'toggle') {
        const role = button.dataset.role;
        await updateUserRole(userId, role);
        return;
    }
    if (action === 'reset') {
        if (!confirm('Reset this user password?')) return;
        await resetUserPassword(userId);
        return;
    }
    if (action === 'delete') {
        if (!confirm('Delete this user permanently?')) return;
        await deleteUser(userId);
    }
});

function openBrowserHub() {
    browserHubPanel.classList.add('open');
    browserHubBackdrop.classList.add('visible');
    fetchBrowserGroups();
}

function closeBrowserHub() {
    browserHubPanel.classList.remove('open');
    browserHubBackdrop.classList.remove('visible');
}

browserHubToggle.addEventListener('click', openBrowserHub);
browserHubClose.addEventListener('click', closeBrowserHub);
browserHubBackdrop.addEventListener('click', closeBrowserHub);

async function fetchBrowserGroups() {
    browserGroupsList.innerHTML = '<div class="loading-dots">...</div>';
    try {
        const res = await fetch('/api/browser/groups', {
            credentials: 'include'
        });
        const groups = await res.json();
        renderBrowserGroups(groups);
    } catch (err) {
        browserGroupsList.innerHTML = '<div class="error-msg">Failed to load groups.</div>';
    }
}

function renderBrowserGroups(groups) {
    browserGroupsList.innerHTML = Object.entries(groups).map(([id, group]) => `
        <div class="browser-group-card" id="browser-group-${id}">
            <div class="group-info">
                <h4>${group.name}</h4>
                <p>${group.description}</p>
            </div>
            <button class="ghost-btn" onclick="runBrowserGroup('${id}')">RUN</button>
        </div>
    `).join('');
}

async function runBrowserGroup(groupId) {
    try {
        const res = await fetch(`/api/browser/run/${groupId}`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            browserTaskDetail.classList.remove('hidden');
            currentTaskListName.textContent = `Running: ${groupId}`;
            currentTaskList.innerHTML = '';
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Failed to start task group');
    }
}

async function fetchUsers() {
    showUserMessage('Loading users...', false);

    try {
        const res = await fetch('/api/users', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Unable to load users');
        const data = await res.json();
        usersData = Array.isArray(data.users) ? data.users : [];
        renderUsers();
        if (data.warning) {
            showUserMessage(data.warning, true);
        } else {
            userAdminMessage.classList.remove('visible');
        }
    } catch (err) {
        showUserMessage('Unable to load users.', true);
    }
}

function renderUsers() {
    const searchTerm = userSearch.value.trim().toLowerCase();
    const roleFilter = userRoleFilter.value;

    const filtered = usersData.filter(user => {
        const matchSearch = !searchTerm || [user.name, user.email].filter(Boolean).some(field => field.toLowerCase().includes(searchTerm));
        const matchRole = roleFilter === 'all' || user.role === roleFilter;
        return matchSearch && matchRole;
    });

    const counts = { admin: 0, user: 0, pending: 0 };
    usersData.forEach(user => {
        if (counts[user.role] !== undefined) counts[user.role] += 1;
    });
    userCountAdmin.textContent = counts.admin;
    userCountUser.textContent = counts.user;
    userCountPending.textContent = counts.pending;

    if (!filtered.length) {
        userAdminList.innerHTML = '<div class="empty-state">No users match the current filters.</div>';
        return;
    }

    userAdminList.innerHTML = filtered.map(user => {
        const lastActive = user.last_active_at ? new Date(user.last_active_at).toLocaleString() : 'Never';
        const role = user.role || 'user';
        const actionLabel = role === 'pending' ? 'Activate' : 'Suspend';
        const actionRole = role === 'pending' ? 'user' : 'pending';

        return `
            <div class="user-card">
                <div class="user-info">
                    <div class="user-name">${user.name || 'Unnamed User'}</div>
                    <div class="user-email">${user.email || 'No email'}</div>
                    <div class="user-meta">Last active ${lastActive}</div>
                </div>
                <div class="user-actions">
                    <select class="role-select" data-user-id="${user.id}">
                        <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="user" ${role === 'user' ? 'selected' : ''}>User</option>
                        <option value="pending" ${role === 'pending' ? 'selected' : ''}>Pending</option>
                    </select>
                    <button class="ghost-btn" data-action="toggle" data-user-id="${user.id}" data-role="${actionRole}">${actionLabel}</button>
                    <button class="ghost-btn" data-action="reset" data-user-id="${user.id}">Reset PW</button>
                    <button class="ghost-btn danger" data-action="delete" data-user-id="${user.id}">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

async function updateUserRole(userId, role) {
    showUserMessage('Updating user role...', false);

    try {
        const res = await fetch(`/api/users/${userId}/role`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });
        if (!res.ok) throw new Error('Unable to update role');
        const data = await res.json();
        usersData = usersData.map(user => (String(user.id) === String(userId) ? data.user : user));
        renderUsers();
        showUserMessage('User role updated.', true);
    } catch (err) {
        showUserMessage('Unable to update user.', true);
    }
}

function isValidEmail(email) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}

async function createUser() {
    const name = newUserName.value.trim();
    const email = newUserEmail.value.trim();
    const role = newUserRole.value;

    if (!email || !isValidEmail(email)) {
        showUserMessage('Enter a valid email address.', true);
        return;
    }

    showUserMessage('Creating user...', false);

    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, role })
        });
        const data = await res.json();
        if (!res.ok || !data.user) {
            throw new Error(data.message || 'Unable to create user');
        }
        usersData.unshift(data.user);
        renderUsers();
        newUserName.value = '';
        newUserEmail.value = '';
        newUserRole.value = 'user';
        showUserMessage('User created.', true);
    } catch (err) {
        showUserMessage('Unable to create user. Check Open WebUI settings.', true);
    }
}

async function resetUserPassword(userId) {
    showUserMessage('Resetting password...', false);

    try {
        const res = await fetch(`/api/users/${userId}/reset-password`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Unable to reset password');
        }
        showUserMessage(data.message || 'Password reset queued.', true);
    } catch (err) {
        showUserMessage('Unable to reset password.', true);
    }
}

async function deleteUser(userId) {
    showUserMessage('Deleting user...', false);

    try {
        const res = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Unable to delete user');
        }
        usersData = usersData.filter(user => String(user.id) !== String(userId));
        renderUsers();
        showUserMessage('User deleted.', true);
    } catch (err) {
        showUserMessage('Unable to delete user.', true);
    }
}

socket.on('status_update', (data) => {
    const { vram, statuses, errors, system, summary, environments, containers, npmServers } = data;

    vramUsedEl.textContent = vram.used;
    vramTotalEl.textContent = vram.total;
    const vramPercent = vram.total ? Math.round((vram.used / vram.total) * 100) : 0;
    vramBar.style.width = `${vramPercent}%`;
    vramPercentEl.textContent = `${vramPercent}%`;

    if (system) {
        cpuUsageEl.textContent = system.cpu;
        cpuBar.style.width = `${system.cpu}%`;

        ramUsedEl.textContent = system.memory.usedGB;
        ramTotalEl.textContent = system.memory.totalGB;
        ramBar.style.width = `${system.memory.percent}%`;

        diskUsedEl.textContent = system.disk.usedGB;
        diskTotalEl.textContent = system.disk.totalGB;
        diskBar.style.width = `${system.disk.percent}%`;
    }

    if (summary) {
        stackRunningEl.textContent = summary.running;
        stackTotalEl.textContent = summary.total;
        stackUpdatedEl.textContent = formatTimeStamp(new Date());
    }

    // Update environment status in real-time
    if (environments) {
        Object.entries(environments).forEach(([envId, envStatus]) => {
            if (environmentsData[envId]) {
                environmentsData[envId].running = envStatus.running;
                environmentsData[envId].runningCount = envStatus.runningCount;
                environmentsData[envId].total = envStatus.total;
                environmentsData[envId].services = envStatus.services;
            }
        });
        // Re-render environments if they've changed
        if (Object.keys(environments).length > 0) {
            renderEnvironments();
        }
    }

    // Update containers data
    if (containers && containers.length > 0) {
        containersData = containers;
        renderContainers();
    }

    // Update npm servers data
    if (npmServers && npmServers.length > 0) {
        npmServersData = npmServers;
        renderNpmServers();
    }

    const now = Date.now();

    Object.entries(statuses).forEach(([id, isRunning]) => {
        const badge = document.getElementById(`status-${id}`);
        const startBtn = document.getElementById(`start-${id}`);
        const stopBtn = document.getElementById(`stop-${id}`);
        const restartBtn = document.getElementById(`restart-${id}`);
        const errorZone = document.getElementById(`error-${id}`);
        const uptimeEl = document.getElementById(`uptime-${id}`);

        if (!badge || !startBtn) return;

        const prevState = serviceState[id];
        if (!prevState || prevState.running !== isRunning) {
            serviceState[id] = { running: isRunning, since: now };
        }

        badge.className = `status-badge ${isRunning ? 'running' : 'stopped'}`;
        badge.textContent = isRunning ? 'Running' : 'Stopped';

        startBtn.disabled = isRunning;
        stopBtn.disabled = !isRunning;
        restartBtn.disabled = false;

        if (uptimeEl) {
            uptimeEl.textContent = isRunning ? formatDuration(now - serviceState[id].since) : 'Stopped';
        }

        if (errors && errors[id]) {
            errorZone.style.display = 'block';
            errorZone.querySelector('.error-msg').textContent = errors[id];
        } else if (errorZone) {
            errorZone.style.display = 'none';
        }
    });
});

socket.on('connect', () => {
    document.getElementById('connection-status').className = 'status-badge running';
    document.getElementById('connection-status').textContent = 'Live';
});

socket.on('disconnect', () => {
    document.getElementById('connection-status').className = 'status-badge stopped';
    document.getElementById('connection-status').textContent = 'Disconnected';
});

socket.on('open', (data) => {
    document.getElementById('connection-status').textContent = 'Connected';
    document.getElementById('connection-status').classList.remove('stopped');
    document.getElementById('connection-status').classList.add('running');
});

fetchServices();
fetchEnvironments();
fetchContainers();
fetchNpmServers();
fetchEnvironmentInfo();

socket.on('browser_task_start', (data) => {
    browserTaskDetail.classList.remove('hidden');
    currentTaskListName.textContent = `Running: ${data.groupId}`;
    currentTaskList.innerHTML = '';
});

socket.on('browser_task_update', (data) => {
    const { taskName, status } = data;
    const taskEl = document.createElement('div');
    taskEl.className = 'task-item';
    taskEl.innerHTML = `
        <div class="task-status-dot ${status}"></div>
        <span>${taskName}</span>
    `;
    currentTaskList.appendChild(taskEl);
});

socket.on('browser_task_complete', (data) => {
    const { groupId, result } = data;
    currentTaskListName.textContent = `Completed: ${groupId} (${result.status})`;
});

// Fetch environment configuration
async function fetchEnvironmentInfo() {
    try {
        const res = await fetch('/api/environment-info', {
            credentials: 'include'
        });
        if (!res.ok) {
            console.warn('Failed to fetch environment info');
            return;
        }
        const data = await res.json();

        currentEnvironment = data.environment || 'production';
        isHotReloadActive = data.hotReload || false;

        // Update environment badge
        const envBadge = document.getElementById('env-badge');
        if (envBadge) {
            envBadge.textContent = currentEnvironment.toUpperCase();
            envBadge.className = `env-badge ${currentEnvironment}`;
        }

        // Update hot reload badge
        const hotReloadBadge = document.getElementById('hot-reload-badge');
        if (hotReloadBadge && isHotReloadActive) {
            hotReloadBadge.style.display = 'inline-block';
        } else if (hotReloadBadge) {
            hotReloadBadge.style.display = 'none';
        }
    } catch (err) {
        console.error('Unable to fetch environment info:', err);
    }
}

fetchServices();
fetchEnvironments();
