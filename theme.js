/**
 * Theme management for FinanceFlow
 */

const THEMES = {
    dark: {
        '--bg-primary': '#0f0f1e',
        '--bg-secondary': '#1a1a2e',
        '--card-bg': '#16213e',
        '--text-primary': '#e0e0e0',
        '--text-secondary': '#9ca3af',
        '--accent-primary': '#8b5cf6',
        '--accent-secondary': '#ec4899',
        '--border-color': '#374151',
        '--success': '#22c55e',
        '--danger': '#ef4444',
        '--warning': '#f59e0b'
    },
    light: {
        '--bg-primary': '#f8f9fa',
        '--bg-secondary': '#ffffff',
        '--card-bg': '#ffffff',
        '--text-primary': '#1f2937',
        '--text-secondary': '#6b7280',
        '--accent-primary': '#8b5cf6',
        '--accent-secondary': '#ec4899',
        '--border-color': '#e5e7eb',
        '--success': '#16a34a',
        '--danger': '#dc2626',
        '--warning': '#ea580c'
    },
    ocean: {
        '--bg-primary': '#001f3f',
        '--bg-secondary': '#003459',
        '--card-bg': '#004876',
        '--text-primary': '#e0f2fe',
        '--text-secondary': '#bae6fd',
        '--accent-primary': '#06b6d4',
        '--accent-secondary': '#0891b2',
        '--border-color': '#075985',
        '--success': '#22c55e',
        '--danger': '#ef4444',
        '--warning': '#f59e0b'
    },
    sunset: {
        '--bg-primary': '#2d1b1e',
        '--bg-secondary': '#3d2329',
        '--card-bg': '#4d2b34',
        '--text-primary': '#fce7f3',
        '--text-secondary': '#f9a8d4',
        '--accent-primary': '#f97316',
        '--accent-secondary': '#ec4899',
        '--border-color': '#5d3340',
        '--success': '#22c55e',
        '--danger': '#ef4444',
        '--warning': '#fbbf24'
    }
};

/**
 * Gets current theme from localStorage
 */
export const getCurrentTheme = () => {
    return localStorage.getItem('financeflow-theme') || 'dark';
};

/**
 * Applies a theme
 */
export const applyTheme = (themeName) => {
    const theme = THEMES[themeName];
    if (!theme) return;

    const root = document.documentElement;
    Object.entries(theme).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });

    localStorage.setItem('financeflow-theme', themeName);

    // Update body class for theme-specific styling
    document.body.className = `theme-${themeName}`;
};

/**
 * Initializes theme system
 */
export const initTheme = () => {
    const savedTheme = getCurrentTheme();
    applyTheme(savedTheme);

    // Update theme selector if it exists
    const themeSelect = document.getElementById('theme-selector');
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
};

/**
 * Renders theme selector UI
 */
export const renderThemeSelector = () => {
    const currentTheme = getCurrentTheme();
    return `
        <div class="theme-selector-container">
            <label for="theme-selector">
                <i class="fa-solid fa-palette"></i> Theme
            </label>
            <select id="theme-selector" class="theme-selector">
                <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark (Default)</option>
                <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light</option>
                <option value="ocean" ${currentTheme === 'ocean' ? 'selected' : ''}>Ocean Blue</option>
                <option value="sunset" ${currentTheme === 'sunset' ? 'selected' : ''}>Sunset Pink</option>
            </select>
        </div>
    `;
};

/**
 * Attaches theme change listener
 */
export const attachThemeListener = () => {
    const themeSelect = document.getElementById('theme-selector');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });
    }
};
