/**
 * Application Constants
 */

export const TABLES = {
    TRANSACTIONS: 'transactions',
    ACCOUNTS: 'accounts',
    CATEGORIES: 'categories',
    GOALS: 'goals'
};

export const VIEWS = {
    DASHBOARD: 'dashboard',
    TRANSACTIONS: 'transactions',
    ANALYTICS: 'analytics',
    ACCOUNTS: 'accounts',
    SETTINGS: 'settings',
    LOGIN: 'login'
};

export const ERRORS = {
    LOGIN_FAILED: 'Error logging in: ',
    DATA_LOAD_FAILED: 'Failed to load data. Please refresh.',
    TRANSACTION_SAVE_FAILED: 'Error saving transaction: ',
    TRANSACTION_DELETE_FAILED: 'Error deleting transaction: ',
    ACCOUNT_SAVE_FAILED: 'Error adding account: ',
    ACCOUNT_DELETE_FAILED: 'Error deleting account: ',
    CATEGORY_SAVE_FAILED: 'Error saving category: ',
    CATEGORY_DELETE_FAILED: 'Error deleting category: ',
    AI_AUDIT_FAILED: 'Audit failed: ',
    SMART_IMPORT_FAILED: 'Smart Import failed: ',
    CSV_IMPORT_FAILED: 'Error importing CSV: '
};

export const COLOR_PALETTE = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#f43f5e', // Rose
    '#0ea5e9', // Sky
    '#84cc16', // Lime
    '#d946ef'  // Fuchsia
];
