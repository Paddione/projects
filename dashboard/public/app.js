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
let controlMode = 'docker'; // 'docker' or 'kubernetes'
let clusterInfo = null; // Kubernetes cluster info
let deploymentsData = {}; // Kubernetes deployments
let podsData = []; // Kubernetes pods

// New k8s data from kubectl proxy
let healthData = null; // Cluster health status
let nodeMetricsData = []; // Node CPU/memory metrics
let traefikRoutesData = []; // Traefik IngressRoutes
let traefikMiddlewaresData = []; // Traefik Middlewares
let helmReleasesData = []; // Helm chart releases
let k8sVersion = null; // Kubernetes version
let proxyAvailable = false; // kubectl proxy availability

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

// Render Kubernetes cluster info
function renderClusterInfo() {
    const grid = document.getElementById('cluster-info-grid');
    if (!grid || !clusterInfo) return;

    // Clear grid
    grid.textContent = '';

    // Create cluster summary
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'cluster-summary';

    const nodesStat = document.createElement('div');
    nodesStat.className = 'cluster-stat';
    const nodesValue = document.createElement('span');
    nodesValue.className = 'stat-value';
    nodesValue.textContent = clusterInfo.nodes || 0;
    const nodesLabel = document.createElement('span');
    nodesLabel.className = 'stat-label';
    nodesLabel.textContent = 'Nodes';
    nodesStat.appendChild(nodesValue);
    nodesStat.appendChild(nodesLabel);

    const nsStat = document.createElement('div');
    nsStat.className = 'cluster-stat';
    const nsValue = document.createElement('span');
    nsValue.className = 'stat-value';
    nsValue.textContent = clusterInfo.namespaces ? clusterInfo.namespaces.length : 0;
    const nsLabel = document.createElement('span');
    nsLabel.className = 'stat-label';
    nsLabel.textContent = 'Namespaces';
    nsStat.appendChild(nsValue);
    nsStat.appendChild(nsLabel);

    summaryDiv.appendChild(nodesStat);
    summaryDiv.appendChild(nsStat);
    grid.appendChild(summaryDiv);

    // Create node cards
    if (clusterInfo.nodeInfo) {
        const nodesDiv = document.createElement('div');
        nodesDiv.className = 'cluster-nodes';

        clusterInfo.nodeInfo.forEach(node => {
            const card = document.createElement('div');
            card.className = 'cluster-node-card';

            const header = document.createElement('div');
            header.className = 'node-header';
            const title = document.createElement('h4');
            title.textContent = node.name;
            const badge = document.createElement('div');
            badge.className = `status-badge ${node.status === 'Ready' ? 'running' : 'stopped'}`;
            badge.textContent = node.status;
            header.appendChild(title);
            header.appendChild(badge);

            const details = document.createElement('div');
            details.className = 'node-details';

            const kubelet = document.createElement('div');
            kubelet.className = 'metric-item';
            const kubeletLabel = document.createElement('span');
            kubeletLabel.className = 'metric-label';
            kubeletLabel.textContent = 'Kubelet';
            const kubeletValue = document.createElement('span');
            kubeletValue.className = 'metric-value';
            kubeletValue.textContent = node.kubeletVersion;
            kubelet.appendChild(kubeletLabel);
            kubelet.appendChild(kubeletValue);

            const runtime = document.createElement('div');
            runtime.className = 'metric-item';
            const runtimeLabel = document.createElement('span');
            runtimeLabel.className = 'metric-label';
            runtimeLabel.textContent = 'Runtime';
            const runtimeValue = document.createElement('span');
            runtimeValue.className = 'metric-value';
            runtimeValue.textContent = node.containerRuntime;
            runtime.appendChild(runtimeLabel);
            runtime.appendChild(runtimeValue);

            details.appendChild(kubelet);
            details.appendChild(runtime);

            card.appendChild(header);
            card.appendChild(details);
            nodesDiv.appendChild(card);
        });

        grid.appendChild(nodesDiv);
    }
}

// Render Kubernetes deployments
function renderDeployments() {
    const grid = document.getElementById('environments-grid');
    if (!grid) return;

    if (controlMode !== 'kubernetes') {
        renderEnvironments();
        return;
    }

    grid.textContent = '';
    const deploymentEntries = Object.entries(deploymentsData);

    if (!deploymentEntries.length) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'env-card';
        emptyCard.textContent = 'No deployments found';
        grid.appendChild(emptyCard);
        return;
    }

    deploymentEntries.forEach(([key, deployment]) => {
        const card = document.createElement('div');
        card.className = 'env-card';

        const header = document.createElement('div');
        header.className = 'env-header';
        const title = document.createElement('h3');
        title.textContent = deployment.name;
        const badge = document.createElement('div');
        badge.className = `status-badge ${deployment.running ? 'running' : 'stopped'}`;
        badge.textContent = deployment.running ? `Running (${deployment.readyReplicas}/${deployment.replicas})` : 'Stopped';
        header.appendChild(title);
        header.appendChild(badge);

        const info = document.createElement('div');
        info.className = 'env-info';
        const ns = document.createElement('div');
        ns.className = 'env-path';
        ns.textContent = deployment.namespace;
        const img = document.createElement('div');
        img.className = 'env-compose-files';
        img.textContent = deployment.image;
        info.appendChild(ns);
        info.appendChild(img);

        const controls = document.createElement('div');
        controls.className = 'env-controls';

        const startBtn = document.createElement('button');
        startBtn.className = 'ctrl-btn start';
        startBtn.textContent = 'Scale Up';
        startBtn.disabled = deployment.running;
        startBtn.onclick = () => controlK8sDeployment(deployment.id, 'start');

        const restartBtn = document.createElement('button');
        restartBtn.className = 'ctrl-btn restart';
        restartBtn.textContent = 'Restart';
        restartBtn.onclick = () => controlK8sDeployment(deployment.id, 'restart');

        const stopBtn = document.createElement('button');
        stopBtn.className = 'ctrl-btn stop';
        stopBtn.textContent = 'Scale Down';
        stopBtn.disabled = !deployment.running;
        stopBtn.onclick = () => controlK8sDeployment(deployment.id, 'stop');

        controls.appendChild(startBtn);
        controls.appendChild(restartBtn);
        controls.appendChild(stopBtn);

        card.appendChild(header);
        card.appendChild(info);
        card.appendChild(controls);
        grid.appendChild(card);
    });
}

// Render Kubernetes pods
function renderPods() {
    const grid = document.getElementById('containers-grid');
    if (!grid) return;

    if (controlMode !== 'kubernetes') {
        renderContainers();
        return;
    }

    grid.textContent = '';

    if (!podsData || podsData.length === 0) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'card';
        emptyCard.textContent = 'No pods found.';
        grid.appendChild(emptyCard);
        return;
    }

    const filtered = podsData.filter(pod => {
        if (activeContainerFilter !== 'all' && pod.project !== activeContainerFilter) return false;
        if (activeEnvFilter !== 'all' && pod.env !== activeEnvFilter) return false;
        return true;
    });

    filtered.forEach(pod => {
        const card = document.createElement('div');
        card.className = 'card container-card';
        card.dataset.project = pod.project;
        card.dataset.env = pod.env;

        const header = document.createElement('div');
        header.className = 'card-header';

        const titleGroup = document.createElement('div');
        titleGroup.className = 'card-title-group';
        const title = document.createElement('h4');
        title.textContent = pod.name;
        const tags = document.createElement('div');
        tags.className = 'card-tags';
        const projectTag = document.createElement('span');
        projectTag.className = 'tag';
        projectTag.textContent = pod.project;
        const nsTag = document.createElement('span');
        nsTag.className = 'tag subtle';
        nsTag.textContent = pod.namespace;
        tags.appendChild(projectTag);
        tags.appendChild(nsTag);
        titleGroup.appendChild(title);
        titleGroup.appendChild(tags);

        const statusClass = pod.state === 'running' ? 'running' : (pod.state === 'pending' ? 'pending' : 'stopped');
        const badge = document.createElement('div');
        badge.className = `status-badge ${statusClass}`;
        badge.textContent = pod.status;

        header.appendChild(titleGroup);
        header.appendChild(badge);

        const details = document.createElement('div');
        details.className = 'container-details';

        const metrics = [
            { label: 'Image', value: pod.image },
            { label: 'Phase', value: pod.phase },
            { label: 'Restarts', value: pod.restarts },
            { label: 'Node', value: pod.nodeName || 'N/A' }
        ];

        metrics.forEach(m => {
            const item = document.createElement('div');
            item.className = 'metric-item';
            const label = document.createElement('span');
            label.className = 'metric-label';
            label.textContent = m.label;
            const value = document.createElement('span');
            value.className = 'metric-value';
            value.textContent = m.value;
            item.appendChild(label);
            item.appendChild(value);
            details.appendChild(item);
        });

        card.appendChild(header);
        card.appendChild(details);
        grid.appendChild(card);
    });
}

// =============================================================================
// NEW K8S RENDERING FUNCTIONS (kubectl proxy data)
// =============================================================================

// Render Health Dashboard
function renderHealthDashboard() {
    const section = document.getElementById('health-dashboard-section');
    if (!section) return;

    // Update proxy status badge
    const proxyBadge = document.getElementById('proxy-status-badge');
    if (proxyBadge) {
        const dot = proxyBadge.querySelector('.proxy-dot');
        const text = proxyBadge.querySelector('.proxy-text');
        if (proxyAvailable) {
            dot.className = 'proxy-dot connected';
            text.textContent = 'Proxy Connected';
        } else {
            dot.className = 'proxy-dot disconnected';
            text.textContent = 'Proxy Unavailable';
        }
    }

    if (!healthData) return;

    // Update health cards
    const updateHealthCard = (id, status, message) => {
        const card = document.getElementById(id);
        if (!card) return;
        const statusEl = card.querySelector('.health-status');
        if (statusEl) {
            statusEl.className = `health-status ${status === 'healthy' ? 'healthy' : status === 'unhealthy' ? 'unhealthy' : 'unknown'}`;
            statusEl.textContent = message || status;
        }
    };

    updateHealthCard('health-overall', healthData.overall, healthData.overall === 'healthy' ? 'Healthy' : 'Degraded');
    updateHealthCard('health-livez', healthData.livez?.status, healthData.livez?.status === 'healthy' ? 'Healthy' : 'Unhealthy');
    updateHealthCard('health-readyz', healthData.readyz?.status, healthData.readyz?.status === 'healthy' ? 'Ready' : 'Not Ready');

    // Update version card
    const versionCard = document.getElementById('health-version');
    if (versionCard && k8sVersion) {
        const statusEl = versionCard.querySelector('.health-status');
        if (statusEl) {
            statusEl.className = 'health-status version';
            statusEl.textContent = k8sVersion.gitVersion || k8sVersion || '--';
        }
    }
}

// Parse CPU usage string (e.g., "250m") to millicores
function parseCpuUsage(cpuString) {
    if (!cpuString) return 0;
    if (cpuString.endsWith('m')) {
        return parseInt(cpuString, 10);
    }
    if (cpuString.endsWith('n')) {
        return parseInt(cpuString, 10) / 1000000;
    }
    return parseFloat(cpuString) * 1000;
}

// Parse memory usage string (e.g., "1Gi") to bytes
function parseMemoryUsage(memString) {
    if (!memString) return 0;
    const units = {
        'Ki': 1024,
        'Mi': 1024 * 1024,
        'Gi': 1024 * 1024 * 1024,
        'Ti': 1024 * 1024 * 1024 * 1024
    };
    for (const [unit, multiplier] of Object.entries(units)) {
        if (memString.endsWith(unit)) {
            return parseInt(memString, 10) * multiplier;
        }
    }
    return parseInt(memString, 10) || 0;
}

// Format bytes to human readable
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Render Node Metrics
function renderNodeMetrics() {
    const grid = document.getElementById('resource-metrics-grid');
    if (!grid) return;

    if (!nodeMetricsData || nodeMetricsData.length === 0) {
        grid.textContent = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = 'No node metrics available. Ensure metrics-server is running.';
        grid.appendChild(emptyDiv);
        return;
    }

    grid.textContent = '';

    nodeMetricsData.forEach(node => {
        const cpuMillicores = node.cpuCores || parseCpuUsage(node.cpu);
        const memoryBytes = node.memoryBytes || parseMemoryUsage(node.memory);
        const cpuPercent = Math.min((cpuMillicores / 4000) * 100, 100);
        const memoryPercent = Math.min((memoryBytes / (16 * 1024 * 1024 * 1024)) * 100, 100);

        const card = document.createElement('div');
        card.className = 'node-metric-card';

        const header = document.createElement('div');
        header.className = 'node-metric-header';
        const title = document.createElement('h4');
        title.textContent = node.name;
        header.appendChild(title);

        const bars = document.createElement('div');
        bars.className = 'node-metric-bars';

        // CPU bar
        const cpuGroup = document.createElement('div');
        cpuGroup.className = 'metric-bar-group';
        const cpuLabel = document.createElement('div');
        cpuLabel.className = 'metric-bar-label';
        const cpuLabelText = document.createElement('span');
        cpuLabelText.textContent = 'CPU';
        const cpuValue = document.createElement('span');
        cpuValue.className = 'metric-bar-value';
        cpuValue.textContent = node.cpu || cpuMillicores + 'm';
        cpuLabel.appendChild(cpuLabelText);
        cpuLabel.appendChild(cpuValue);
        const cpuBarContainer = document.createElement('div');
        cpuBarContainer.className = 'metric-bar-container';
        const cpuBarFill = document.createElement('div');
        cpuBarFill.className = 'metric-bar-fill cpu';
        cpuBarFill.style.width = `${cpuPercent}%`;
        cpuBarContainer.appendChild(cpuBarFill);
        cpuGroup.appendChild(cpuLabel);
        cpuGroup.appendChild(cpuBarContainer);

        // Memory bar
        const memGroup = document.createElement('div');
        memGroup.className = 'metric-bar-group';
        const memLabel = document.createElement('div');
        memLabel.className = 'metric-bar-label';
        const memLabelText = document.createElement('span');
        memLabelText.textContent = 'Memory';
        const memValue = document.createElement('span');
        memValue.className = 'metric-bar-value';
        memValue.textContent = formatBytes(memoryBytes);
        memLabel.appendChild(memLabelText);
        memLabel.appendChild(memValue);
        const memBarContainer = document.createElement('div');
        memBarContainer.className = 'metric-bar-container';
        const memBarFill = document.createElement('div');
        memBarFill.className = 'metric-bar-fill memory';
        memBarFill.style.width = `${memoryPercent}%`;
        memBarContainer.appendChild(memBarFill);
        memGroup.appendChild(memLabel);
        memGroup.appendChild(memBarContainer);

        bars.appendChild(cpuGroup);
        bars.appendChild(memGroup);

        card.appendChild(header);
        card.appendChild(bars);
        grid.appendChild(card);
    });
}

// Render Traefik Routes
function renderTraefikRoutes() {
    const grid = document.getElementById('traefik-routes-grid');
    if (!grid) return;

    // Update counts
    const routeCount = document.getElementById('traefik-route-count');
    const middlewareCount = document.getElementById('traefik-middleware-count');
    if (routeCount) routeCount.textContent = traefikRoutesData.length;
    if (middlewareCount) middlewareCount.textContent = traefikMiddlewaresData.length;

    if (!traefikRoutesData || traefikRoutesData.length === 0) {
        grid.textContent = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = 'No IngressRoutes found.';
        grid.appendChild(emptyDiv);
        return;
    }

    grid.textContent = '';

    traefikRoutesData.forEach(route => {
        const hosts = route.routes.map(r => {
            const match = r.match || '';
            const hostMatch = match.match(/Host\(`([^`]+)`\)/);
            return hostMatch ? hostMatch[1] : match;
        }).filter(Boolean);

        const services = route.routes.flatMap(r => r.services || []).map(s => s.name);
        const middlewares = route.routes.flatMap(r => r.middlewares || []);
        const entryPoints = route.entryPoints || [];

        const card = document.createElement('div');
        card.className = 'traefik-route-card';

        const header = document.createElement('div');
        header.className = 'traefik-route-header';
        const title = document.createElement('h4');
        title.textContent = route.name;
        const ns = document.createElement('span');
        ns.className = 'traefik-route-namespace';
        ns.textContent = route.namespace;
        header.appendChild(title);
        header.appendChild(ns);

        const details = document.createElement('div');
        details.className = 'traefik-route-details';

        const addRow = (label, value) => {
            const row = document.createElement('div');
            row.className = 'traefik-route-row';
            const labelEl = document.createElement('span');
            labelEl.className = 'traefik-route-label';
            labelEl.textContent = label;
            const valueEl = document.createElement('span');
            valueEl.className = 'traefik-route-value';
            valueEl.textContent = value || '-';
            row.appendChild(labelEl);
            row.appendChild(valueEl);
            details.appendChild(row);
        };

        addRow('Hosts', hosts.length > 0 ? hosts.join(', ') : '-');
        addRow('Services', services.length > 0 ? services.join(', ') : '-');
        addRow('Entry Points', entryPoints.length > 0 ? entryPoints.join(', ') : '-');
        if (middlewares.length > 0) {
            addRow('Middlewares', middlewares.join(', '));
        }

        card.appendChild(header);
        card.appendChild(details);

        if (route.tls) {
            const tlsBadge = document.createElement('div');
            tlsBadge.className = 'traefik-route-tls';
            tlsBadge.textContent = 'TLS Enabled';
            card.appendChild(tlsBadge);
        }

        grid.appendChild(card);
    });
}

// Render Helm Releases
function renderHelmReleases() {
    const grid = document.getElementById('helm-releases-grid');
    if (!grid) return;

    // Update count
    const releaseCount = document.getElementById('helm-release-count');
    if (releaseCount) {
        releaseCount.textContent = '';
        const strong = document.createElement('strong');
        strong.textContent = helmReleasesData.length;
        releaseCount.appendChild(strong);
        releaseCount.appendChild(document.createTextNode(' Charts'));
    }

    if (!helmReleasesData || helmReleasesData.length === 0) {
        grid.textContent = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = 'No Helm releases found.';
        grid.appendChild(emptyDiv);
        return;
    }

    grid.textContent = '';

    helmReleasesData.forEach(release => {
        const statusClass = release.status === 'deployed' ? 'deployed' :
                          release.status === 'pending' ? 'pending' : 'failed';

        const card = document.createElement('div');
        card.className = `helm-release-card ${statusClass}`;

        const header = document.createElement('div');
        header.className = 'helm-release-header';
        const title = document.createElement('h4');
        title.textContent = release.name;
        const status = document.createElement('span');
        status.className = `helm-release-status ${statusClass}`;
        status.textContent = release.status || 'unknown';
        header.appendChild(title);
        header.appendChild(status);

        const details = document.createElement('div');
        details.className = 'helm-release-details';

        const addRow = (label, value) => {
            if (!value) return;
            const row = document.createElement('div');
            row.className = 'helm-release-row';
            const labelEl = document.createElement('span');
            labelEl.className = 'helm-release-label';
            labelEl.textContent = label;
            const valueEl = document.createElement('span');
            valueEl.className = 'helm-release-value';
            valueEl.textContent = value;
            row.appendChild(labelEl);
            row.appendChild(valueEl);
            details.appendChild(row);
        };

        addRow('Chart', release.chart || '-');
        if (release.version) addRow('Version', release.version);
        addRow('Namespace', release.namespace);
        if (release.targetNamespace && release.targetNamespace !== release.namespace) {
            addRow('Target NS', release.targetNamespace);
        }

        card.appendChild(header);
        card.appendChild(details);
        grid.appendChild(card);
    });
}

// Update UI sections visibility for Kubernetes mode (extended)
function updateK8sSectionsVisibility() {
    const healthSection = document.getElementById('health-dashboard-section');
    const metricsSection = document.getElementById('resource-metrics-section');
    const traefikSection = document.getElementById('traefik-routes-section');
    const helmSection = document.getElementById('helm-releases-section');

    const isK8s = controlMode === 'kubernetes';

    if (healthSection) healthSection.style.display = isK8s ? 'block' : 'none';
    if (metricsSection) metricsSection.style.display = isK8s ? 'block' : 'none';
    if (traefikSection) traefikSection.style.display = isK8s ? 'block' : 'none';
    if (helmSection) helmSection.style.display = isK8s ? 'block' : 'none';
}

// Control Kubernetes deployment
async function controlK8sDeployment(deploymentId, action) {
    try {
        const res = await fetch(`/api/k8s/deployments/${deploymentId}/${action}`, {
            method: 'POST',
            credentials: 'include'
        });

        const result = await res.json();

        if (!result.success) {
            alert(`Failed to ${action} deployment: ${result.error}`);
        }
    } catch (err) {
        console.error(`Failed to ${action} deployment:`, err);
        alert(`Failed to ${action} deployment. Check console for details.`);
    }
}

socket.on('status_update', (data) => {
    const { vram, statuses, errors, system, summary, config } = data;

    // Update control mode from config
    if (config && config.controlMode) {
        const prevMode = controlMode;
        controlMode = config.controlMode;
        if (prevMode !== controlMode) {
            updateUIForControlMode();
        }
    }

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

    // Handle Kubernetes mode data
    if (controlMode === 'kubernetes') {
        // Update cluster info
        if (data.clusterInfo) {
            clusterInfo = data.clusterInfo;
            renderClusterInfo();
        }

        // Update deployments
        if (data.deployments) {
            deploymentsData = data.deployments;
            renderDeployments();
        }

        // Update pods
        if (data.pods) {
            podsData = data.pods;
            renderPods();
        }

        // Update new k8s data from kubectl proxy
        if (data.proxyAvailable !== undefined) {
            proxyAvailable = data.proxyAvailable;
        }

        if (data.health) {
            healthData = data.health;
            renderHealthDashboard();
        }

        if (data.version) {
            k8sVersion = data.version;
            renderHealthDashboard(); // Re-render to update version
        }

        if (data.nodeMetrics) {
            nodeMetricsData = data.nodeMetrics;
            renderNodeMetrics();
        }

        if (data.traefikRoutes) {
            traefikRoutesData = data.traefikRoutes;
        }
        if (data.traefikMiddlewares) {
            traefikMiddlewaresData = data.traefikMiddlewares;
        }
        if (data.traefikRoutes || data.traefikMiddlewares) {
            renderTraefikRoutes();
        }

        if (data.helmReleases) {
            helmReleasesData = data.helmReleases;
            renderHelmReleases();
        }

        // Update sections visibility
        updateK8sSectionsVisibility();
    } else {
        // Docker mode
        const { environments, containers, npmServers } = data;

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
        controlMode = data.controlMode || 'docker';

        // Update dashboard title based on control mode
        const dashboardTitle = document.getElementById('dashboard-title');
        if (dashboardTitle) {
            dashboardTitle.textContent = controlMode === 'kubernetes' ? 'K8S CONTROL CENTER' : 'VRAM MASTERMIND';
        }

        // Update environment badge
        const envBadge = document.getElementById('env-badge');
        if (envBadge) {
            envBadge.textContent = currentEnvironment.toUpperCase();
            envBadge.className = `env-badge ${currentEnvironment}`;
        }

        // Update control mode badge
        const controlModeBadge = document.getElementById('control-mode-badge');
        if (controlModeBadge) {
            if (controlMode === 'kubernetes') {
                controlModeBadge.textContent = 'K8S';
                controlModeBadge.style.display = 'inline-block';
                controlModeBadge.className = 'control-mode-badge kubernetes';
            } else {
                controlModeBadge.style.display = 'none';
            }
        }

        // Update hot reload badge
        const hotReloadBadge = document.getElementById('hot-reload-badge');
        if (hotReloadBadge && isHotReloadActive) {
            hotReloadBadge.style.display = 'inline-block';
        } else if (hotReloadBadge) {
            hotReloadBadge.style.display = 'none';
        }

        // Update UI sections based on control mode
        updateUIForControlMode();
    } catch (err) {
        console.error('Unable to fetch environment info:', err);
    }
}

// Update UI sections based on control mode (Docker vs Kubernetes)
function updateUIForControlMode() {
    const envSectionEyebrow = document.getElementById('env-section-eyebrow');
    const envSectionTitle = document.getElementById('env-section-title');
    const containersSectionEyebrow = document.getElementById('containers-section-eyebrow');
    const containersSectionTitle = document.getElementById('containers-section-title');
    const clusterInfoSection = document.getElementById('cluster-info-section');
    const environmentsSection = document.getElementById('environments-section');
    const npmServersSection = document.querySelector('.npm-servers-section');

    if (controlMode === 'kubernetes') {
        // Update section titles for Kubernetes
        if (envSectionEyebrow) envSectionEyebrow.textContent = 'Kubernetes';
        if (envSectionTitle) envSectionTitle.textContent = 'Deployments';
        if (containersSectionEyebrow) containersSectionEyebrow.textContent = 'Kubernetes Pods';
        if (containersSectionTitle) containersSectionTitle.textContent = 'Running Pods';

        // Show cluster info section
        if (clusterInfoSection) clusterInfoSection.style.display = 'block';

        // Hide npm servers section in k8s mode
        if (npmServersSection) npmServersSection.style.display = 'none';
    } else {
        // Docker mode titles
        if (envSectionEyebrow) envSectionEyebrow.textContent = 'Docker Compose';
        if (envSectionTitle) envSectionTitle.textContent = 'Production Environments';
        if (containersSectionEyebrow) containersSectionEyebrow.textContent = 'Docker Containers';
        if (containersSectionTitle) containersSectionTitle.textContent = 'Running Containers';

        // Hide cluster info section
        if (clusterInfoSection) clusterInfoSection.style.display = 'none';

        // Show npm servers section
        if (npmServersSection) npmServersSection.style.display = 'block';
    }
}

fetchServices();
fetchEnvironments();
