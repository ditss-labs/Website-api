class APIDashboard {
    constructor() {
        this.charts = {};
        this.websocket = null;
        this.map = null;
        this.soundEnabled = true;
        this.tradingMode = false;
        this.endpoints = new Map();
        this.init();
    }

    init() {
        this.initParticles();
        this.initCharts();
        this.initMap();
        this.initEventListeners();
        this.loadInitialData();
        this.connectWebSocket();
        this.startTimers();
        this.notify('Dashboard initialized', 'success');
    }

    initParticles() {
        particlesJS('particles-js', {
            particles: {
                number: { value: 100, density: { enable: true, value_area: 800 } },
                color: { value: '#4361ee' },
                shape: { type: 'circle' },
                opacity: { value: 0.5, random: true },
                size: { value: 3, random: true },
                line_linked: { enable: true, distance: 150, color: '#4361ee', opacity: 0.2, width: 1 },
                move: { enable: true, speed: 2, direction: 'none', random: true, straight: false }
            },
            interactivity: {
                detect_on: 'canvas',
                events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } }
            }
        });
    }

    initCharts() {
        this.charts.requests = new Chart(document.getElementById('requestsChart').getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: '#4361ee', backgroundColor: 'rgba(67, 97, 238, 0.1)', tension: 0.4, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
        });

        const tradingOptions = {
            series: [{ data: [] }],
            chart: { type: 'candlestick', height: 250, foreColor: '#94a3b8', toolbar: { show: false } },
            xaxis: { type: 'datetime', labels: { style: { colors: '#94a3b8' } } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            grid: { borderColor: 'rgba(255,255,255,0.1)' }
        };

        this.charts.trading = new ApexCharts(document.getElementById('tradingChart'), tradingOptions);
        this.charts.trading.render();
    }

    initMap() {
        this.map = L.map('worldMap').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(this.map);

        this.markers = L.layerGroup().addTo(this.map);
        this.updateMap();
    }

    initEventListeners() {
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
        document.getElementById('soundToggle').addEventListener('click', () => this.toggleSound());
        document.getElementById('tradingToggle').addEventListener('click', () => this.toggleTradingMode());
        document.getElementById('viewErrors').addEventListener('click', () => this.showErrorDetails());
        document.getElementById('clearStream').addEventListener('click', () => this.clearStream());
        document.getElementById('pauseStream').addEventListener('click', () => this.toggleStream());
        document.getElementById('generateInsight').addEventListener('click', () => this.generateAIInsight());
        document.getElementById('fullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
        document.getElementById('endpointSearch').addEventListener('input', (e) => this.filterEndpoints(e.target.value));
        document.getElementById('clearSearch').addEventListener('click', () => {
            document.getElementById('endpointSearch').value = '';
            this.filterEndpoints('');
        });
        document.getElementById('simulateBuy').addEventListener('click', () => this.simulateTrade('buy'));
        document.getElementById('simulateSell').addEventListener('click', () => this.simulateTrade('sell'));
        document.getElementById('refreshMap').addEventListener('click', () => this.updateMap());
        document.getElementById('zoomIn').addEventListener('click', () => this.map.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.map.zoomOut());
        document.getElementById('timeframe').addEventListener('change', (e) => this.updateTradingData(e.target.value));
    }

    async loadInitialData() {
        try {
            const [stats, endpoints, live] = await Promise.all([
                fetch('/admin/stats/dashboard').then(r => r.json()),
                fetch('/admin/stats/live').then(r => r.json()),
                fetch('/admin/stats/endpoint/all').then(r => r.json()).catch(() => ({ result: [] }))
            ]);
            
            this.updateDashboard(stats.dashboard);
            this.updateLiveData(live.live || live);
            this.updateEndpoints(endpoints.result || []);
            this.updateConnection(true);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.notify('Failed to load dashboard data', 'error');
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/admin/stats/ws`;
        
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            this.updateConnection(true);
            this.addStreamEvent('WebSocket connected', 'system');
        };
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.processWebSocketData(data);
        };
        
        this.websocket.onclose = () => {
            this.updateConnection(false);
            setTimeout(() => this.connectWebSocket(), 5000);
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    processWebSocketData(data) {
        if (data.type === 'stats') {
            this.updateRealtimeStats(data.data);
        } else if (data.type === 'request') {
            this.addRequestToStream(data.data);
            this.updateEndpoint(data.data.endpoint);
        } else if (data.type === 'error') {
            this.notify(`API Error: ${data.data.endpoint} - ${data.data.error}`, 'error');
        }
    }

    updateDashboard(data) {
        if (!data) return;
        
        document.getElementById('totalRequests').textContent = data.overview.totalRequests.toLocaleString();
        document.getElementById('successRate').textContent = data.overview.successRate;
        document.getElementById('successCount').textContent = data.overview.successRequests;
        document.getElementById('failedCount').textContent = data.overview.failedRequests;
        document.getElementById('avgResponse').textContent = data.overview.avgResponseTime;
        document.getElementById('errorRate').textContent = data.overview.failedRequests > 0 ? 
            ((data.overview.failedRequests / data.overview.totalRequests) * 100).toFixed(2) + '%' : '0%';
        
        const error4xx = data.dashboard?.statusCodes?.['400'] || 0;
        const error5xx = data.dashboard?.statusCodes?.['500'] || 0;
        document.getElementById('error4xx').textContent = error4xx;
        document.getElementById('error5xx').textContent = error5xx;
        
        const progress = Math.min(100, parseFloat(data.overview.successRate) || 0);
        document.querySelector('.progress-fill').style.width = `${progress}%`;
        
        const responseTime = parseInt(data.overview.avgResponseTime) || 0;
        const gaugePos = Math.min(100, responseTime / 10);
        document.getElementById('responseGauge').style.width = `${gaugePos}%`;
        
        this.updateChartData(data.hourlyStats || []);
        this.updateLastUpdate();
    }

    updateLiveData(data) {
        if (!data) return;
        
        document.getElementById('activeUsers').textContent = data.systemStatus?.totalEndpointsTracked || 0;
        document.getElementById('locationCount').textContent = data.activeEndpoints?.length || 0;
        
        if (data.recentActivity) {
            data.recentActivity.slice(0, 5).forEach(activity => {
                this.addStreamEvent(`${activity.endpoint} - ${activity.status}`, activity.success ? 'success' : 'error');
            });
        }
    }

    updateEndpoints(endpoints) {
        const container = document.getElementById('endpointList');
        container.innerHTML = '';
        
        if (!endpoints || endpoints.length === 0) {
            container.innerHTML = '<div class="endpoint-item loading"><i class="fas fa-info-circle"></i><span>No endpoints found</span></div>';
            return;
        }
        
        endpoints.forEach(endpoint => {
            const methodClass = `method-${endpoint.method.toLowerCase()}`;
            const item = document.createElement('div');
            item.className = 'endpoint-item';
            item.innerHTML = `
                <i class="fas fa-link"></i>
                <div class="endpoint-info">
                    <div class="endpoint-path">${endpoint.endpoint}</div>
                    <div class="endpoint-method ${methodClass}">${endpoint.method}</div>
                </div>
                <div class="endpoint-stats">
                    <span>${endpoint.requests || 0}</span>
                    <span>${endpoint.successRate || '0%'}</span>
                </div>
            `;
            container.appendChild(item);
        });
        
        document.getElementById('endpointCount').textContent = endpoints.length;
    }

    updateRealtimeStats(stats) {
        const now = new Date();
        const timeLabel = now.getHours().toString().padStart(2, '0') + ':' + 
                         now.getMinutes().toString().padStart(2, '0');
        
        const chart = this.charts.requests;
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        
        chart.data.labels.push(timeLabel);
        chart.data.datasets[0].data.push(stats.totalRequests || 0);
        chart.update('none');
        
        const rate = stats.requestsLast5Min || 0;
        document.getElementById('requestRate').textContent = rate;
        document.getElementById('streamTotal').textContent = parseInt(document.getElementById('streamTotal').textContent) + 1;
    }

    addRequestToStream(request) {
        const stream = document.getElementById('liveStream');
        const time = new Date(request.timestamp || Date.now()).toLocaleTimeString();
        const type = request.status >= 200 && request.status < 300 ? 'success' : 'error';
        
        const item = document.createElement('div');
        item.className = `stream-item ${type}`;
        item.innerHTML = `
            <span class="stream-time">${time}</span>
            <span class="stream-endpoint">${request.endpoint}</span>
            <span class="stream-method">${request.method}</span>
            <span class="stream-status">${request.status}</span>
            <span class="stream-time">${request.responseTime || 0}ms</span>
        `;
        
        stream.insertBefore(item, stream.firstChild);
        
        if (stream.children.length > 50) {
            stream.removeChild(stream.lastChild);
        }
        
        if (type === 'error' && this.soundEnabled) {
            this.playSound('notification');
        }
    }

    addStreamEvent(message, type = 'system') {
        const stream = document.getElementById('liveStream');
        const time = new Date().toLocaleTimeString();
        
        const item = document.createElement('div');
        item.className = `stream-item ${type}`;
        item.innerHTML = `
            <span class="stream-time">${time}</span>
            <span class="stream-message">${message}</span>
        `;
        
        stream.insertBefore(item, stream.firstChild);
        
        if (stream.children.length > 20) {
            stream.removeChild(stream.lastChild);
        }
    }

    updateEndpoint(endpoint) {
        if (!this.endpoints.has(endpoint)) {
            this.endpoints.set(endpoint, { count: 0, success: 0, errors: 0 });
        }
        
        const data = this.endpoints.get(endpoint);
        data.count++;
        this.endpoints.set(endpoint, data);
    }

    updateMap() {
        this.markers.clearLayers();
        
        const locations = [
            { lat: 40.7128, lng: -74.0060, name: 'New York', requests: 1250 },
            { lat: 51.5074, lng: -0.1278, name: 'London', requests: 980 },
            { lat: 35.6762, lng: 139.6503, name: 'Tokyo', requests: 850 },
            { lat: -33.8688, lng: 151.2093, name: 'Sydney', requests: 620 },
            { lat: -23.5505, lng: -46.6333, name: 'São Paulo', requests: 540 }
        ];
        
        locations.forEach(loc => {
            const marker = L.circleMarker([loc.lat, loc.lng], {
                radius: Math.min(20, Math.max(5, Math.sqrt(loc.requests) / 5)),
                fillColor: '#4361ee',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7
            }).addTo(this.markers);
            
            marker.bindPopup(`<b>${loc.name}</b><br>Requests: ${loc.requests.toLocaleString()}`);
        });
        
        document.getElementById('locationCount').textContent = locations.length;
    }

    updateTradingData(timeframe) {
        const data = this.generateTradingData(timeframe);
        this.charts.trading.updateSeries([{ data }]);
        
        const price = 100 + (Math.random() * 20 - 10);
        const change = (Math.random() * 5 - 2.5).toFixed(2);
        const volume = Math.floor(Math.random() * 1000000);
        
        document.getElementById('apiPrice').textContent = `$${price.toFixed(2)}`;
        document.getElementById('apiChange').textContent = `${change >= 0 ? '+' : ''}${change}%`;
        document.getElementById('apiVolume').textContent = volume.toLocaleString();
        
        if (parseFloat(change) >= 0) {
            document.getElementById('apiChange').className = 'value positive';
        } else {
            document.getElementById('apiChange').className = 'value negative';
        }
    }

    generateTradingData(timeframe) {
        const data = [];
        let basePrice = 100;
        const now = Date.now();
        let interval = 3600000;
        
        if (timeframe === '4h') interval = 3600000 * 4;
        if (timeframe === '1d') interval = 3600000 * 24;
        if (timeframe === '1w') interval = 3600000 * 24 * 7;
        
        for (let i = 50; i >= 0; i--) {
            const timestamp = now - (i * interval);
            const open = basePrice + (Math.random() * 10 - 5);
            const close = open + (Math.random() * 10 - 5);
            const high = Math.max(open, close) + Math.random() * 5;
            const low = Math.min(open, close) - Math.random() * 5;
            
            data.push({ x: timestamp, y: [open, high, low, close] });
            basePrice = close;
        }
        
        return data;
    }

    toggleTheme() {
        document.body.classList.toggle('light-theme');
        const icon = document.querySelector('#themeToggle i');
        icon.className = document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const icon = document.querySelector('#soundToggle i');
        icon.className = this.soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        this.notify(`Sound ${this.soundEnabled ? 'enabled' : 'disabled'}`, 'success');
    }

    toggleTradingMode() {
        this.tradingMode = !this.tradingMode;
        const btn = document.getElementById('tradingToggle');
        const card = document.getElementById('tradingViewCard');
        
        if (this.tradingMode) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-chart-line"></i> Trading Active';
            card.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.5)';
            this.notify('Trading mode activated', 'success');
            this.playSound('trading');
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fas fa-chart-line"></i> Trading Mode';
            card.style.boxShadow = '';
        }
    }

    toggleStream() {
        const btn = document.getElementById('pauseStream');
        const icon = btn.querySelector('i');
        
        if (icon.className.includes('fa-pause')) {
            icon.className = 'fas fa-play';
            this.addStreamEvent('Stream paused', 'system');
        } else {
            icon.className = 'fas fa-pause';
            this.addStreamEvent('Stream resumed', 'system');
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    clearStream() {
        document.getElementById('liveStream').innerHTML = '';
        document.getElementById('streamTotal').textContent = '0';
        this.addStreamEvent('Stream cleared', 'system');
    }

    filterEndpoints(query) {
        const items = document.querySelectorAll('.endpoint-item');
        query = query.toLowerCase();
        
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? 'flex' : 'none';
        });
    }

    simulateTrade(type) {
        const price = parseFloat(document.getElementById('apiPrice').textContent.slice(1));
        const amount = Math.floor(Math.random() * 1000) + 100;
        const total = (price * amount).toFixed(2);
        
        this.notify(`Simulated ${type.toUpperCase()}: ${amount} units at $${price} = $${total}`, 'success');
        this.addStreamEvent(`Trade ${type.toUpperCase()}: ${amount} units @ $${price}`, type);
        
        if (this.soundEnabled) {
            this.playSound('trading');
        }
    }

    generateAIInsight() {
        const insights = [
            "API performance is optimal. All endpoints responding within expected range.",
            "Consider implementing cache for frequently accessed endpoints to reduce response time.",
            "Error rate is within acceptable limits. No immediate action required.",
            "Peak traffic detected between 14:00-16:00 UTC. Consider scaling during this period.",
            "All systems operational. Uptime: 99.9% for the last 30 days."
        ];
        
        const insight = insights[Math.floor(Math.random() * insights.length)];
        const container = document.getElementById('aiInsights');
        
        const item = document.createElement('div');
        item.className = 'insight-item';
        item.innerHTML = `
            <i class="fas fa-robot"></i>
            <span>${insight}</span>
        `;
        
        container.insertBefore(item, container.firstChild);
        this.notify('AI Insight generated', 'success');
    }

    showErrorDetails() {
        this.notify('Opening error dashboard...', 'info');
        setTimeout(() => {
            window.open('/admin/stats/errors', '_blank');
        }, 500);
    }

    exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            endpoints: Array.from(this.endpoints.entries()),
            stats: {
                totalRequests: document.getElementById('totalRequests').textContent,
                successRate: document.getElementById('successRate').textContent,
                errorRate: document.getElementById('errorRate').textContent
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api-dashboard-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        this.notify('Data exported successfully', 'success');
    }

    refreshData() {
        this.loadInitialData();
        this.notify('Dashboard refreshed', 'success');
        
        const btn = document.getElementById('refreshBtn');
        btn.style.transform = 'rotate(360deg)';
        setTimeout(() => btn.style.transform = '', 500);
    }

    updateConnection(connected) {
        const status = document.getElementById('connectionStatus');
        const text = document.getElementById('connectionText');
        
        if (connected) {
            status.className = 'status-dot connected';
            text.textContent = 'Connected';
            status.style.animation = 'pulse 2s infinite';
        } else {
            status.className = 'status-dot';
            text.textContent = 'Disconnected';
            status.style.animation = 'pulse 1s infinite';
        }
    }

    updateLastUpdate() {
        const now = new Date();
        document.getElementById('lastUpdate').textContent = 
            `Last update: ${now.toLocaleTimeString()}`;
        document.getElementById('serverTime').textContent = 
            now.toUTCString().split(' ')[4] + ' UTC';
    }

    updateChartData(hourlyStats) {
        if (!hourlyStats || !hourlyStats.length) return;
        
        const labels = hourlyStats.map(h => h.hour);
        const data = hourlyStats.map(h => h.requests);
        
        this.charts.requests.data.labels = labels;
        this.charts.requests.data.datasets[0].data = data;
        this.charts.requests.update();
    }

    notify(message, type = 'info') {
        const container = document.getElementById('notificationCenter');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${type.toUpperCase()}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notification-body">${message}</div>
        `;
        
        container.appendChild(notification);
        
        if (this.soundEnabled && type !== 'info') {
            this.playSound('notification');
        }
        
        setTimeout(() => notification.remove(), 5000);
    }

    playSound(type) {
        const audio = document.getElementById(`${type}Sound`);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
    }

    startTimers() {
        setInterval(() => this.updateLastUpdate(), 1000);
        
        let uptime = 0;
        setInterval(() => {
            uptime++;
            const hours = Math.floor(uptime / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((uptime % 3600) / 60).toString().padStart(2, '0');
            const seconds = (uptime % 60).toString().padStart(2, '0');
            document.getElementById('uptimeCounter').textContent = `${hours}:${minutes}:${seconds}`;
        }, 1000);
        
        setInterval(() => {
            document.getElementById('memoryUsage').textContent = 
                `${Math.floor(performance.memory?.usedJSHeapSize / 1024 / 1024) || 0} MB`;
            document.getElementById('cpuUsage').textContent = 
                `${Math.floor(Math.random() * 30) + 5}%`;
        }, 5000);
        
        setInterval(() => this.updateTradingData('1h'), 10000);
    }
}

window.addEventListener('load', () => {
    window.dashboard = new APIDashboard();
});
