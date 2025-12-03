import { COLOR_PALETTE } from './constants.js';
import { state } from './state.js'; // Need state for getCategoryColor

/**
 * Format a number as USD currency
 * @param {number} amount 
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
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
export const sanitizeInput = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * Generate a random color from the palette
 * @returns {string} Hex color
 */
export const getRandomColor = () => {
    return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
};

/**
 * Get color for a category
 * @param {string} categoryName 
 * @returns {string} Hex color
 */
export const getCategoryColor = (categoryName) => {
    if (!categoryName) return '#94a3b8'; // Default gray

    // Try to find in state
    if (state && state.categories) {
        const cat = state.categories.find(c => c.name === categoryName);
        if (cat && cat.color_code) return cat.color_code;
    }

    // Fallback: Consistent palette color based on name hash
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
        hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLOR_PALETTE.length;
    return COLOR_PALETTE[index];
};

/**
 * Validates transaction data.
 * @param {Object} transaction - The transaction object.
 * @returns {string|null} Error message or null if valid.
 */
export const validateTransaction = ({ amount, date, category, description }) => {
    if (!amount || isNaN(amount) || amount <= 0) {
        return 'Please enter a valid positive amount.';
    }
    if (!date) {
        return 'Please select a date.';
    }
    if (!category) {
        return 'Please select or enter a category.';
    }

    // Date Validation (Not > 1 year in future)
    const inputDate = new Date(date);
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    if (inputDate > oneYearFromNow) {
        return 'Date cannot be more than 1 year in the future.';
    }

    // Length Validation
    if (description && description.length > 100) {
        return 'Description is too long (max 100 characters).';
    }
    if (category.length > 50) {
        return 'Category is too long (max 50 characters).';
    }

    return null;
};

/**
 * Validates category data.
 * @param {Object} data - The category data.
 * @returns {string|null} - Error message or null if valid.
 */
export const validateCategory = (data) => {
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
export const validatePassword = (password) => {
    if (!password || password.length < 6) {
        return 'Password must be at least 6 characters long.';
    }
    return null;
};
