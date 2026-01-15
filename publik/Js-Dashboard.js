class DashboardManager {
    constructor() {
        this.userData = null;
        this.init();
    }
    
    async init() {
        await this.checkAuth();
        this.loadUserData();
        this.bindEvents();
        this.loadApiKeys();
        this.loadStats();
    }
    
    async checkAuth() {
        try {
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.status && data.loggedIn) {
                this.userData = data.user;
                this.updateUserUI();
            } else {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/login';
        }
    }
    
    updateUserUI() {
        if (!this.userData) return;
        
        // Update username
        const usernameEl = document.getElementById('username-display');
        if (usernameEl) usernameEl.textContent = this.userData.username;
        
        // Update role
        const roleEl = document.getElementById('user-role');
        if (roleEl) {
            roleEl.textContent = this.userData.role.charAt(0).toUpperCase() + this.userData.role.slice(1);
        }
        
        // Update email
        const emailEl = document.getElementById('user-email');
        if (emailEl) emailEl.textContent = this.userData.email || `${this.userData.username}@asuma.my.id`;
        
        // Update avatar
        const avatarEl = document.getElementById('user-avatar');
        if (avatarEl) {
            const initial = this.userData.username.charAt(0).toUpperCase();
            avatarEl.innerHTML = `<span>${initial}</span>`;
        }
    }
    
    async loadUserData() {
        try {
            const response = await fetch('/api/user/apikeys', {
                method: 'GET',
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.status) {
                this.renderApiKeys(data.data.apikeys || []);
            }
        } catch (error) {
            console.error('Load user data error:', error);
        }
    }
    
    renderApiKeys(apiKeys) {
        const container = document.getElementById('api-keys-container');
        if (!container) return;
        
        if (apiKeys.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-key"></i>
                    <p>No API keys found</p>
                    <button class="btn-primary" onclick="dashboard.createApiKey()">Create Your First API Key</button>
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
                    <code>${key.key}</code>
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
                    <button class="btn-icon" onclick="dashboard.viewKeyDetails('${key.key}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="dashboard.editKey('${key.key}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="dashboard.revokeKey('${key.key}')">
                        <i class="fas fa-ban"></i>
                    </button>
                    <button class="btn-icon" onclick="dashboard.deleteKey('${key.key}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
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
        // Update stats di UI
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
    
    bindEvents() {
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        
        // Create API key button
        const createBtn = document.getElementById('create-api-key');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createApiKey());
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }
        
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.getAttribute('data-section');
                this.showSection(section);
            });
        });
    }
    
    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout error:', error);
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
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ 
                    name, 
                    limitPerDay: limitNum 
                })
            });
            
            const data = await response.json();
            if (data.status) {
                alert(`API Key created: ${data.data.apiKey.key}`);
                this.loadUserData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Create API key error:', error);
            alert('Failed to create API key');
        }
    }
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        });
    }
    
    showSection(section) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show selected section
        const target = document.getElementById(`${section}-section`);
        if (target) {
            target.style.display = 'block';
        }
        
        // Update active nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-section') === section) {
                link.classList.add('active');
            }
        });
    }
    
    refresh() {
        this.loadUserData();
        this.loadStats();
        alert('Data refreshed!');
    }
    
    viewKeyDetails(key) {
        alert(`View details for: ${key}\nFeature coming soon!`);
    }
    
    editKey(key) {
        alert(`Edit key: ${key}\nFeature coming soon!`);
    }
    
    async revokeKey(key) {
        if (!confirm('Are you sure you want to revoke this API key?')) return;
        
        try {
            const response = await fetch(`/api/user/apikeys/${key}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ status: 'revoked' })
            });
            
            const data = await response.json();
            if (data.status) {
                this.loadUserData();
                alert('API key revoked');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Revoke key error:', error);
            alert('Failed to revoke key');
        }
    }
    
    async deleteKey(key) {
        if (!confirm('Are you sure you want to delete this API key?')) return;
        
        try {
            const response = await fetch(`/api/user/apikeys/${key}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.status) {
                this.loadUserData();
                alert('API key deleted');
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Delete key error:', error);
            alert('Failed to delete key');
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardManager();
});
