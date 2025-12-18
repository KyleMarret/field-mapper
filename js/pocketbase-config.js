// ========================================
// POCKETBASE CONFIGURATION
// ========================================

// Update this URL based on your setup:
// - Local development: 'http://127.0.0.1:8090'
// - Same network: 'http://YOUR_COMPUTER_IP:8090'
// - Production: 'https://your-domain.com' or your PocketHost URL

const POCKETBASE_URL = 'http://127.0.0.1:8090';

// Collection names (must match your PocketBase setup)
const COLLECTIONS = {
    FARMS: 'farms',
    FIELDS: 'fields',
    SAMPLES: 'samples',
    LAB_RESULTS: 'lab_results'
};

// Optional: Authentication settings
const AUTH_ENABLED = false; // Set to true if you want user login
const AUTO_LOGIN_EMAIL = ''; // For testing, leave blank for production
const AUTO_LOGIN_PASSWORD = '';

// Sync settings
const SYNC_INTERVAL = 30000; // Auto-sync every 30 seconds when online
const RETRY_DELAY = 5000; // Retry failed syncs after 5 seconds
const MAX_RETRY_ATTEMPTS = 3;

// Export for use in app.js
window.POCKETBASE_CONFIG = {
    url: POCKETBASE_URL,
    collections: COLLECTIONS,
    auth: {
        enabled: AUTH_ENABLED,
        autoLoginEmail: AUTO_LOGIN_EMAIL,
        autoLoginPassword: AUTO_LOGIN_PASSWORD
    },
    sync: {
        interval: SYNC_INTERVAL,
        retryDelay: RETRY_DELAY,
        maxRetries: MAX_RETRY_ATTEMPTS
    }
};
