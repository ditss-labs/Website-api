class DashboardManager {
    constructor() {
        this.userData = null;
        this.apiKeys = [];
        this.stats = null;
        
        this.init();
    }
    
    async init() {
        // Cek auth dulu
        const isAuthenticated = await this.checkAuth();
        if (!isAuthenticated) {
            window.location.href = '/login';
            return;
        }
        
        this.loadUserData();
        this.bindEvents();
        this.loadApiKeys();
        this.loadStats();
        this.startAutoRefresh();
    }
    
    async checkAuth() {
        try {
            const response = await fetch('/api/auth/me', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status && data.data.user) {
                    this.userData = data.data.user;
                    this.updateUserUI();
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    }
    
    updateUserUI() {
        if (!this.userData) return;
        
        // Update user info di UI
        const userElements = {
            'username-display': this.userData.username,
            'user-email': this.userData.email || `${this.userData.username}@asuma.my.id`,
            'user-role': this.userData.role.charAt(0).toUpperCase() + this.userData.role.slice(1),
            'profile-image': this.userData.profileurl
        };
        
        Object.keys(userElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'profile-image' && element.tagName === 'IMG') {
                    element.src = userElements[id];
                } else {
                    element.textContent = userElements[id];
                }
            }
        });
    }
    
    loadUserData() {
        // Load data tambahan jika perlu
        console.log('User loaded:', this.userData);
    }
    
    async loadApiKeys() {
        try {
            const response = await fetch('/api/user/apikeys', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status) {
                    this.apiKeys = data.data.apikeys || [];
                    this.renderApiKeys();
                }
            }
        } catch (error) {
            console.error('Load API keys error:', error);
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/user/stats', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status) {
                    this.stats = data.data;
                    this.renderStats();
                }
            }
        } catch (error) {
            console.error('Load stats error:', error);
        }
    }
    
    renderApiKeys() {
        const container = document.getElementById('api-keys-container');
        if (!container) return;
        
        if (this.apiKeys.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-key"></i>
                    <p>No API keys found</p>
                    <button class="btn-primary" id="create-first-key">Create Your First API Key</button>
                </div>
            `;
            document.getElementById('create-first-key')?.addEventListener('click', () => this.showCreateKeyModal());
            return;
        }
        
        container.innerHTML = this.apiKeys.map(key => `
            <div class="api-key-card ${key.status !== 'active' ? 'revoked' : ''}">
                <div class="api-key-header">
                    <h4>${key.name}</h4>
                    <span class="status-badge ${key.status}">${key.status}</span>
                </div>
                <div class="api-key-value">
                    <code>${key.key}</code>
                    <button class="copy-btn" data-key="${key.key}">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="api-key-stats">
                    <div class="stat">
                        <span class="stat-label">Usage Today</span>
                        <span class="stat-value">${key.usageToday}/${key.limitPerDay}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Total Usage</span>
                        <span class="stat-value">${key.totalUsage}</span>
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
        
        // Add copy functionality
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.currentTarget.getAttribute('data-key');
                this.copyToClipboard(key);
            });
        });
    }
    
    renderStats() {
        if (!this.stats) return;
        
        // Update stats UI
        const statsElements = {
            'total-requests': this.stats.totalRequests || 0,
            'today-requests': this.stats.todayRequests || 0,
            'active-keys': this.stats.activeKeys || 0,
            'banned-ips': this.stats.bannedIps || 0
        };
        
        Object.keys(statsElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = statsElements[id];
            }
        });
    }
    
    bindEvents() {
        // Logout button
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        
        // Create API key button
        document.getElementById('create-api-key')?.addEventListener('click', () => this.showCreateKeyModal());
        
        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', () => this.refreshData());
        
        // Menu navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.getAttribute('data-section');
                this.switchSection(section);
            });
        });
    }
    
    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login';
        }
    }
    
    showCreateKeyModal() {
        // Implement modal untuk create API key
        const modal = document.getElementById('create-key-modal');
        if (modal) {
            modal.style.display = 'block';
            
            document.getElementById('create-key-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('key-name').value;
                const limit = document.getElementById('key-limit').value;
                
                await this.createApiKey(name, limit);
                modal.style.display = 'none';
            });
        }
    }
    
    async createApiKey(name, limitPerDay) {
        try {
            const response = await fetch('/api/user/apikeys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ name, limitPerDay: parseInt(limitPerDay) })
            });
            
            const data = await response.json();
            if (data.status) {
                this.loadApiKeys(); // Reload keys
                this.showNotification('API key created successfully!', 'success');
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            console.error('Create API key error:', error);
            this.showNotification('Failed to create API key', 'error');
        }
    }
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    }
    
    switchSection(section) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(s => {
            s.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Update active nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-section') === section) {
                link.classList.add('active');
            }
        });
    }
    
    refreshData() {
        this.loadApiKeys();
        this.loadStats();
        this.showNotification('Data refreshed', 'info');
    }
    
    showNotification(message, type = 'info') {
        // Implement notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    startAutoRefresh() {
        // Auto refresh data setiap 60 detik
        setInterval(() => {
            this.loadApiKeys();
            this.loadStats();
        }, 60000);
    }
    
    // Method untuk window object
    viewKeyDetails(key) {
        console.log('View details:', key);
        // Implement detail view
    }
    
    editKey(key) {
        console.log('Edit key:', key);
        // Implement edit
    }
    
    async revokeKey(key) {
        if (!confirm('Are you sure you want to revoke this API key?')) return;
        
        try {
            const response = await fetch(`/api/user/apikeys/${key}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ status: 'revoked' })
            });
            
            const data = await response.json();
            if (data.status) {
                this.loadApiKeys();
                this.showNotification('API key revoked', 'success');
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            console.error('Revoke key error:', error);
            this.showNotification('Failed to revoke key', 'error');
        }
    }
    
    async deleteKey(key) {
        if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return;
        
        try {
            const response = await fetch(`/api/user/apikeys/${key}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            
            const data = await response.json();
            if (data.status) {
                this.loadApiKeys();
                this.showNotification('API key deleted', 'success');
            } else {
                this.showNotification(data.error, 'error');
            }
        } catch (error) {
            console.error('Delete key error:', error);
            this.showNotification('Failed to delete key', 'error');
        }
    }
}

// Global instance
window.dashboard = new DashboardManager();
