// Utility Functions

/**
 * Format a number as USD currency
 * @param {number} amount 
 * @returns {string} Formatted currency string
 */
window.formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

/**
 * Sanitize user input to prevent XSS
 * @param {string} str 
 * @returns {string} Sanitized string
 */
window.sanitizeInput = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * Curated Color Palette (Modern & Vibrant)
 */
window.COLOR_PALETTE = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#14b8a6', // Teal
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#d946ef', // Fuchsia
];

/**
 * Generate a random color from the palette
 * @returns {string} Hex color
 */
window.getRandomColor = () => {
    return window.COLOR_PALETTE[Math.floor(Math.random() * window.COLOR_PALETTE.length)];
};

/**
 * Get color for a category
 * @param {string} categoryName 
 * @returns {string} Hex color
 */
window.getCategoryColor = (categoryName) => {
    if (!categoryName) return '#94a3b8'; // Default gray

    // Try to find in state
    if (window.state && window.state.categories) {
        const cat = window.state.categories.find(c => c.name === categoryName);
        // Only use stored color if it's NOT the default green/generic one (if we want to force override)
        // But for now, we trust the state, assuming we will migrate the DB.
        if (cat && cat.color_code) return cat.color_code;
    }

    // Fallback: Consistent palette color based on name hash
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
        hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % window.COLOR_PALETTE.length;
    return window.COLOR_PALETTE[index];
};

// Global Error Handler
window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error('Global Error:', { msg, url, lineNo, columnNo, error });
    // Ideally, send this to a logging service (Sentry, etc.)
    return false; // Let default handler run too
};

/**
 * Validates transaction data.
 * @param {Object} data - The transaction data.
 * @returns {string|null} - Error message or null if valid.
 */
window.validateTransaction = (data) => {
    if (!data.amount || isNaN(data.amount) || parseFloat(data.amount) <= 0) {
        return 'Amount must be a positive number.';
    }
    if (!data.date) {
        return 'Date is required.';
    }
    // Future date check
    const today = new Date().toISOString().split('T')[0];
    if (data.date > today) {
        return 'Date cannot be in the future.';
    }
    if (!data.category || data.category === '') {
        return 'Category is required.';
    }
    return null;
};

/**
 * Validates category data.
 * @param {Object} data - The category data.
 * @returns {string|null} - Error message or null if valid.
 */
window.validateCategory = (data) => {
    if (!data.name || data.name.trim().length < 2) {
        return 'Category name must be at least 2 characters.';
    }
    if (data.name.length > 30) {
        return 'Category name must be less than 30 characters.';
    }
    return null;
};

/**
 * Validates password strength.
 * @param {string} password - The password.
 * @returns {string|null} - Error message or null if valid.
 */
window.validatePassword = (password) => {
    if (!password || password.length < 6) {
        return 'Password must be at least 6 characters long.';
    }
    return null;
};
