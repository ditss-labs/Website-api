class DashboardManager {
    constructor() {
        this.userData = null;
        console.log('🚀 DashboardManager initialized');
        this.init();
    }
    
    async init() {
        console.log('🔍 Checking authentication...');
        const isAuthenticated = await this.checkAuth();
        
        if (isAuthenticated) {
            console.log('✅ User authenticated, loading dashboard...');
            this.loadUserData();
            this.bindEvents();
            this.loadApiKeys();
            this.loadStats();
        } else {
            console.log('❌ User not authenticated, redirecting to login...');
            window.location.href = '/login';
        }
    }
    
    async checkAuth() {
        try {
            console.log('📡 Sending auth check request...');
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            console.log('📥 Auth check response status:', response.status);
            const data = await response.json();
            console.log('📦 Auth check response data:', data);
            
            if (data.status && data.loggedIn) {
                this.userData = data.user;
                console.log('✅ User authenticated:', data.user.username);
                return true;
            }
            
            console.log('❌ Auth check failed, loggedIn:', data.loggedIn);
            return false;
            
        } catch (error) {
            console.error('🔥 Auth check error:', error);
            return false;
        }
    }
    
    updateUserUI() {
        if (!this.userData) return;
        
        console.log('🎨 Updating UI for user:', this.userData.username);
        
        // Update username
        const usernameEl = document.getElementById('username-display');
        if (usernameEl) {
            usernameEl.textContent = this.userData.username;
            console.log('✓ Username updated');
        }
        
        // Update role
        const roleEl = document.getElementById('user-role');
        if (roleEl) {
            const role = this.userData.role.charAt(0).toUpperCase() + this.userData.role.slice(1);
            roleEl.textContent = role;
            console.log('✓ Role updated:', role);
        }
        
        // Update email
        const emailEl = document.getElementById('user-email');
        if (emailEl) {
            emailEl.textContent = this.userData.email || `${this.userData.username}@asuma.my.id`;
            console.log('✓ Email updated');
        }
        
        // Update avatar
        const avatarEl = document.getElementById('user-avatar');
        if (avatarEl) {
            const initial = this.userData.username.charAt(0).toUpperCase();
            avatarEl.innerHTML = `<span>${initial}</span>`;
            console.log('✓ Avatar updated');
        }
    }
    
    async loadUserData() {
        try {
            console.log('📡 Loading user data...');
            const response = await fetch('/api/user/apikeys', {
                method: 'GET',
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.status) {
                console.log('✅ User data loaded, API keys:', data.data.apikeys?.length || 0);
                this.renderApiKeys(data.data.apikeys || []);
            } else {
                console.error('❌ Failed to load user data:', data.error);
            }
        } catch (error) {
            console.error('🔥 Load user data error:', error);
        }
    }
    
    renderApiKeys(apiKeys) {
        const container = document.getElementById('api-keys-container');
        if (!container) return;
        
        console.log('🎨 Rendering API keys:', apiKeys.length);
        
        if (apiKeys.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-key"></i>
                    <p>No API keys found</p>
                    <button class="btn-primary" onclick="dashboard.createApiKey()">
                        Create Your First API Key
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = apiKeys.map(key => `
            <div class="api-key-card ${key.status !== 'active' ? 'revoked' : ''}">
                <div class="api-key-header">
                    <h4>${key.name || 'Unnamed Key'}</h4>
                    <span class="status-badge ${key.status}">${key.status}</span>
                </div>
                <div class="api-key-value">
                    <code title="${key.key}">${key.key.substring(0, 20)}...</code>
                    <button class="copy-btn" onclick="dashboard.copyToClipboard('${key.key}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="api-key-stats">
                    <div class="stat">
                        <span class="stat-label">Usage Today</span>
                        <span class="stat-value">${key.usageToday || 0}/${key.limitPerDay || 1000}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Total Usage</span>
                        <span class="stat-value">${key.totalUsage || 0}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Created</span>
                        <span class="stat-value">${new Date(key.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="api-key-actions">
                    <button class="btn-icon" title="View Details" onclick="dashboard.viewKeyDetails('${key.key}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" title="Edit" onclick="dashboard.editKey('${key.key}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" title="Revoke" onclick="dashboard.revokeKey('${key.key}')">
                        <i class="fas fa-ban"></i>
                    </button>
                    <button class="btn-icon" title="Delete" onclick="dashboard.deleteKey('${key.key}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    bindEvents() {
        console.log('🔗 Binding events...');
        
        // Logout button
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            console.log('👋 Logging out...');
            this.logout();
        });
        
        // Create API key button
        document.getElementById('create-api-key')?.addEventListener('click', () => {
            console.log('➕ Creating new API key...');
            this.createApiKey();
        });
        
        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            console.log('🔄 Refreshing data...');
            this.refresh();
        });
        
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.getAttribute('data-section');
                console.log('📱 Switching to section:', section);
                this.showSection(section);
            });
        });
        
        console.log('✅ Events bound');
    }
    
    async logout() {
        try {
            console.log('📡 Sending logout request...');
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.status) {
                console.log('✅ Logout successful');
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('🔥 Logout error:', error);
            window.location.href = '/login';
        }
    }
    
    async createApiKey() {
        const name = prompt('Enter API key name:', 'My API Key');
        if (!name) return;
        
        const limit = prompt('Daily request limit:', '1000');
        const limitNum = parseInt(limit) || 1000;
        
        try {
            const response = await fetch('/api/user/apikeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, limitPerDay: limitNum })
            });
            
            const data = await response.json();
            if (data.status) {
                alert(`✅ API Key created!\n\nKey: ${data.data.apiKey.key}\n\nSave this key!`);
                this.loadUserData();
            } else {
                alert('❌ Error: ' + data.error);
            }
        } catch (error) {
            console.error('Create API key error:', error);
            alert('❌ Failed to create API key');
        }
    }
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('✅ Copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('❌ Failed to copy');
        });
    }
    
    showSection(section) {
        document.querySelectorAll('.content-section').forEach(el => {
            el.style.display = 'none';
        });
        
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const target = document.getElementById(`${section}-section`);
        const navLink = document.querySelector(`.nav-link[data-section="${section}"]`);
        
        if (target) target.style.display = 'block';
        if (navLink) navLink.classList.add('active');
    }
    
    async refresh() {
        await this.loadUserData();
        await this.loadStats();
        alert('✅ Data refreshed!');
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/user/stats', {
                method: 'GET',
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.status) {
                this.updateStats(data.data);
            }
        } catch (error) {
            console.error('Load stats error:', error);
        }
    }
    
    updateStats(stats) {
        const elements = {
            'total-requests': stats.totalRequests || 0,
            'today-requests': stats.todayRequests || 0,
            'active-keys': stats.activeKeys || 0,
            'banned-ips': stats.bannedIps || 0
        };
        
        Object.keys(elements).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = elements[id];
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Dashboard page loaded');
    window.dashboard = new DashboardManager();
});
