// Data Management System
const DataStore = {
    // Initialize data with defaults
    data: {
        users: [],
        calculations: [],
        chatHistory: [],
        sessions: [],
        currentUser: null
    },

    // Initialization flag and promise
    initialized: false,
    initPromise: null,

    // Initialize the DataStore
    async init() {
        // Return existing promise if initialization is in progress
        if (this.initPromise) {
            return this.initPromise;
        }

        // Create new initialization promise
        this.initPromise = (async () => {
            if (this.initialized) return;

            try {
                // Load all data from localStorage with retries
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        ['users', 'calculations', 'chatHistory', 'sessions', 'currentUser'].forEach(key => {
                            try {
                                const data = localStorage.getItem(key);
                                if (data) {
                                    this.data[key] = JSON.parse(data);
                                }
                            } catch (e) {
                                console.error(`Error loading ${key} from localStorage (attempt ${attempt}):`, e);
                                // Keep default value on error
                            }
                        });
                        break; // Success, exit retry loop
                    } catch (e) {
                        if (attempt === 3) throw e; // Throw on final attempt
                        await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // Exponential backoff
                    }
                }

                // Validate and repair data structures
                this.data.users = Array.isArray(this.data.users) ? this.data.users : [];
                this.data.calculations = Array.isArray(this.data.calculations) ? this.data.calculations : [];
                this.data.chatHistory = Array.isArray(this.data.chatHistory) ? this.data.chatHistory : [];
                this.data.sessions = Array.isArray(this.data.sessions) ? this.data.sessions : [];

                // Initialize admin user if not exists
                if (!this.data.users.some(u => u.role === 'admin')) {
                    this.data.users.push({
                        id: 'admin',
                        name: 'Admin',
                        email: 'admin@rgr',
                        password: '123456',
                        role: 'admin',
                        createdAt: new Date().toISOString()
                    });
                    await this.saveData('users');
                }

                this.initialized = true;
            } catch (error) {
                console.error('Error initializing DataStore:', error);
                // Reset initialization state to allow retry
                this.initialized = false;
                this.initPromise = null;
                throw new Error('Failed to initialize DataStore. Please refresh the page and try again.');
            }
        })();

        return this.initPromise;
    },

    // Reset DataStore (for recovery)
    async reset() {
        this.data = {
            users: [],
            calculations: [],
            chatHistory: [],
            sessions: [],
            currentUser: null
        };
        this.initialized = false;
        this.initPromise = null;
        
        // Clear localStorage
        try {
            localStorage.clear();
        } catch (e) {
            console.error('Error clearing localStorage:', e);
        }

        // Reinitialize
        return this.init();
    },

    // User Management
    async createUser(name, email, password) {
        await this.init();

        if (!name || !email || !password) {
            throw new Error('All fields are required');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Invalid email format');
        }

        const existingUser = this.data.users.find(u => u.email === email);
        if (existingUser) {
            throw new Error('Email already registered');
        }

        const user = {
            id: Date.now().toString(),
            name,
            email,
            password, // In a real app, this should be hashed
            role: 'user',
            createdAt: new Date().toISOString()
        };

        this.data.users.push(user);
        await this.saveData('users');
        return user;
    },

    async login(email, password) {
        await this.init();

        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        const user = this.data.users.find(u => u.email === email && u.password === password);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // End any existing sessions for this user
        this.data.sessions = this.data.sessions.map(s => {
            if (s.userId === user.id && !s.endTime) {
                s.endTime = new Date().toISOString();
            }
            return s;
        });

        // Create new session
        const session = {
            id: Date.now().toString(),
            userId: user.id,
            startTime: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };

        this.data.sessions.push(session);
        this.data.currentUser = user;
        await this.saveData('sessions');
        await this.saveData('currentUser');

        // Update activity
        await this.updateActivity();
        return user;
    },

    async logout() {
        await this.init();

        if (this.data.currentUser) {
            // End current session
            const currentSession = this.data.sessions.find(s => 
                s.userId === this.data.currentUser.id && !s.endTime
            );
            if (currentSession) {
                currentSession.endTime = new Date().toISOString();
                await this.saveData('sessions');
            }
            this.data.currentUser = null;
            await this.saveData('currentUser');
        }
    },

    // Calculation History
    async addCalculation(expression, result) {
        await this.init();

        if (!expression || result === undefined) {
            throw new Error('Invalid calculation data');
        }

        const calculation = {
            id: Date.now().toString(),
            userId: this.data.currentUser?.id || 'guest',
            expression,
            result: String(result),
            timestamp: new Date().toISOString()
        };

        this.data.calculations.unshift(calculation);
        if (this.data.calculations.length > 100) {
            this.data.calculations.pop();
        }
        await this.saveData('calculations');
        await this.updateActivity();
        return calculation;
    },

    // Chat History
    async addChatMessage(message, isUser) {
        await this.init();

        if (!message) {
            throw new Error('Message cannot be empty');
        }

        const chat = {
            id: Date.now().toString(),
            userId: this.data.currentUser?.id || 'guest',
            message,
            isUser,
            timestamp: new Date().toISOString()
        };

        this.data.chatHistory.unshift(chat);
        if (this.data.chatHistory.length > 100) {
            this.data.chatHistory.pop();
        }
        await this.saveData('chatHistory');
        await this.updateActivity();
        return chat;
    },

    // Activity Tracking
    async updateActivity() {
        await this.init();

        if (this.data.currentUser) {
            const session = this.data.sessions.find(s => 
                s.userId === this.data.currentUser.id && !s.endTime
            );
            if (session) {
                session.lastActivity = new Date().toISOString();
                await this.saveData('sessions');
            }
        }
    },

    // Stats for Admin Panel
    async getStats() {
        await this.init();

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        // Clean up stale sessions (older than 30 minutes without activity)
        const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString();
        this.data.sessions = this.data.sessions.map(s => {
            if (!s.endTime && s.lastActivity < thirtyMinutesAgo) {
                s.endTime = s.lastActivity;
            }
            return s;
        });
        await this.saveData('sessions');

        return {
            totalUsers: this.data.users.length,
            activeSessions: this.data.sessions.filter(s => !s.endTime).length,
            calculationsToday: this.data.calculations.filter(c => c.timestamp >= todayStart).length,
            totalChatMessages: this.data.chatHistory.length
        };
    },

    // Data Persistence with retry mechanism
    async saveData(key) {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                localStorage.setItem(key, JSON.stringify(this.data[key]));
                return;
            } catch (error) {
                console.error(`Error saving data (attempt ${attempt}):`, error);
                
                if (error.name === 'QuotaExceededError') {
                    // Handle storage quota exceeded
                    if (key === 'calculations' || key === 'chatHistory') {
                        this.data[key] = this.data[key].slice(0, 50);
                        continue; // Retry with reduced data
                    }
                    
                    // Clear old sessions
                    if (key === 'sessions') {
                        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                        this.data.sessions = this.data.sessions.filter(s => s.startTime > thirtyDaysAgo);
                        continue; // Retry with cleaned up sessions
                    }
                }

                if (attempt === maxRetries) {
                    throw new Error('Failed to save data after multiple attempts');
                }
                
                // Wait before retrying with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            }
        }
    },

    // Admin Functions
    async deleteUser(userId) {
        await this.init();

        if (!this.data.currentUser || this.data.currentUser.role !== 'admin') {
            throw new Error('Unauthorized');
        }
        if (userId === 'admin') {
            throw new Error('Cannot delete admin user');
        }
        this.data.users = this.data.users.filter(u => u.id !== userId);
        await this.saveData('users');
    },

    async getRecentUsers() {
        await this.init();
        return this.data.users
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10);
    },

    async getRecentCalculations() {
        await this.init();
        return this.data.calculations.slice(0, 10);
    },

    async getRecentChats() {
        await this.init();
        return this.data.chatHistory.slice(0, 10);
    },

    // User's personal history
    async getUserCalculations(userId) {
        await this.init();
        return this.data.calculations
            .filter(c => c.userId === userId)
            .slice(0, 20);
    },

    async getUserChats(userId) {
        await this.init();
        return this.data.chatHistory
            .filter(c => c.userId === userId)
            .slice(0, 20);
    },

    // Helper methods
    async getCurrentUser() {
        await this.init();
        return this.data.currentUser;
    },

    // Error recovery
    async recoverFromError() {
        console.log('Attempting to recover from error...');
        try {
            // Reset initialization state
            this.initialized = false;
            this.initPromise = null;

            // Try to salvage data
            const backup = {};
            ['users', 'calculations', 'chatHistory', 'sessions', 'currentUser'].forEach(key => {
                try {
                    const data = localStorage.getItem(key);
                    if (data) backup[key] = JSON.parse(data);
                } catch (e) {
                    console.error(`Could not salvage ${key}:`, e);
                }
            });

            // Reset and reinitialize
            await this.reset();

            // Restore salvaged data
            Object.keys(backup).forEach(key => {
                if (Array.isArray(backup[key])) {
                    this.data[key] = backup[key];
                }
            });

            // Save restored data
            for (const key of Object.keys(backup)) {
                await this.saveData(key);
            }

            return true;
        } catch (error) {
            console.error('Recovery failed:', error);
            return false;
        }
    }
};

// Initialize DataStore when the script loads
window.addEventListener('load', async () => {
    await DataStore.init();
});
