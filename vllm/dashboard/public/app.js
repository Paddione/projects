const socket = io({ withCredentials: true });

document.getElementById('logout-btn').addEventListener('click', async () => {
    const res = await fetch('/api/logout');
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

const groupLabels = {
    core: 'Core AI',
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

async function fetchServices() {
    try {
        const res = await fetch('/api/services');
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
        renderServices();
    } catch (err) {
        console.error('Unable to fetch services', err);
        servicesGrid.innerHTML = '<div class="card">Unable to load services. Please log in again.</div>';
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
        const res = await fetch(`/api/services/${activeLogServiceId}/logs`);
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

async function fetchUsers() {
    showUserMessage('Loading users...', false);

    try {
        const res = await fetch('/api/users');
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
            method: 'POST'
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
        const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
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
    const { vram, statuses, errors, system, summary } = data;

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

fetchServices();
