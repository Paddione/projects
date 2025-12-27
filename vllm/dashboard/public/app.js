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

let servicesData = [];

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

function renderServices() {
    servicesGrid.innerHTML = servicesData.map(service => `
        <div class="card" id="card-${service.id}">
            <div class="card-header">
                <div class="card-title-group">
                    <h3>
                        ${service.url ? `<a href="${service.url}" target="_blank" class="service-link">${service.name} <span>↗</span></a>` : service.name}
                    </h3>
                    <div class="card-model">${service.model}</div>
                </div>
                <div class="status-badge stopped" id="status-${service.id}">Stopped</div>
            </div>
            <p class="card-desc">${service.description}</p>
            
            <div class="error-zone" id="error-${service.id}" style="display: none;">
                <div class="error-header">
                    <span>ERROR</span>
                    <button onclick="clearError('${service.id}')">✕</button>
                </div>
                <div class="error-msg"></div>
            </div>

            <div class="card-footer">
                <div class="vram-req">Est. VRAM: <span>${service.vramEstimate}</span></div>
                <div class="control-group">
                    <button class="ctrl-btn start" title="Start" id="start-${service.id}" onclick="controlService('${service.id}', 'start')">▶</button>
                    <button class="ctrl-btn restart" title="Restart" id="restart-${service.id}" onclick="controlService('${service.id}', 'restart')">⟳</button>
                    <button class="ctrl-btn stop" title="Stop" id="stop-${service.id}" onclick="controlService('${service.id}', 'stop')">⬛</button>
                </div>
            </div>
        </div>
    `).join('');
}

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

    [startBtn, stopBtn, restartBtn].forEach(b => b.disabled = true);

    socket.emit('control_service', { serviceId: id, action });
}

function clearError(id) {
    socket.emit('clear_error', id);
}

socket.on('status_update', (data) => {
    const { vram, statuses, errors } = data;

    // Update VRAM
    vramUsedEl.textContent = vram.used;
    vramTotalEl.textContent = vram.total;
    const percent = Math.round((vram.used / vram.total) * 100);
    vramBar.style.width = `${percent}%`;
    vramPercentEl.textContent = `${percent}%`;

    // Update Statuses
    Object.entries(statuses).forEach(([id, isRunning]) => {
        const badge = document.getElementById(`status-${id}`);
        const startBtn = document.getElementById(`start-${id}`);
        const stopBtn = document.getElementById(`stop-${id}`);
        const restartBtn = document.getElementById(`restart-${id}`);
        const errorZone = document.getElementById(`error-${id}`);

        if (!badge || !startBtn) return;

        badge.className = `status-badge ${isRunning ? 'running' : 'stopped'}`;
        badge.textContent = isRunning ? 'Running' : 'Stopped';

        startBtn.disabled = isRunning;
        stopBtn.disabled = !isRunning;
        restartBtn.disabled = false;

        // Update Errors
        if (errors && errors[id]) {
            errorZone.style.display = 'block';
            errorZone.querySelector('.error-msg').textContent = errors[id];
        } else {
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
