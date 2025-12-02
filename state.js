// Global State
window.state = {
    user: null,
    transactions: [],
    categories: [],
    accounts: [],
    goals: [],
    budgets: []
};

// Constants
window.CONSTANTS = {
    TABLES: {
        TRANSACTIONS: 'transactions',
        CATEGORIES: 'categories',
        ACCOUNTS: 'accounts',
        GOALS: 'goals',
        BUDGETS: 'budgets'
    },
    COLORS: {
        INCOME: '#10b981',
        EXPENSE: '#ef4444',
        TRANSFER: '#64748b'
    }
};
