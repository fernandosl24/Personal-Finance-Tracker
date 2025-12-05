import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { getRandomColor } from './utils.js';
import { loadData } from './dataLoader.js';

/**
 * Saves audit results to localStorage
 * @param {Array} updates - List of suggested updates
 */
export const saveAuditResults = (updates) => {
    const auditData = {
        timestamp: new Date().toISOString(),
        totalSuggestions: updates.length,
        updates: updates
    };
    localStorage.setItem('financeflow-audit-results', JSON.stringify(auditData));
};

/**
 * Loads saved audit results from localStorage
 * @returns {Object|null} Saved audit data or null
 */
export const loadSavedAuditResults = () => {
    const saved = localStorage.getItem('financeflow-audit-results');
    return saved ? JSON.parse(saved) : null;
};

/**
 * Clears saved audit results
 */
export const clearAuditResults = () => {
    localStorage.removeItem('financeflow-audit-results');
};

/**
 * Navigates to audit results page
 */
export const navigateToAuditResults = () => {
    window.location.hash = '#audit-results';
};

/**
 * Renders the Audit Results page
 * @param {Array} updates - List of suggested updates
 */
export const renderAuditResultsPage = (updates) => {
    const contentArea = document.getElementById('content-area');
    const savedData = loadSavedAuditResults();
    const timestamp = savedData ? new Date(savedData.timestamp).toLocaleString() : 'Unknown';

    // Get all available categories for dropdowns
    const allCategories = state.categories.map(c => c.name).sort();

    // Build table rows
    const rows = updates.map((u, index) => {
        const tx = state.transactions.find(t => t.id === u.id);
        if (!tx) {
            console.warn('Transaction not found:', u.id);
            return '';
        }

        // Build the "New" column - dropdown for category, text for type
        let newValueHTML;
        if (u.field === 'category') {
            const categoryOptions = [...new Set([...allCategories, u.new_value])].sort();
            newValueHTML = `
                <select class="audit-new-value" data-id="${u.id}" data-field="${u.field}" data-index="${index}" style="
                    width: 100%;
                    padding: 0.4rem;
                    background-color: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    color: var(--success);
                    font-weight: 500;
                    font-family: inherit;
                ">
                    ${categoryOptions.map(cat => `
                        <option value="${cat}" ${cat === u.new_value ? 'selected' : ''}>${cat}</option>
                    `).join('')}
                </select>
            `;
        } else {
            newValueHTML = `<span style="color: var(--success); font-weight: 500;">${u.new_value}</span>`;
        }

        return `
            <tr class="audit-row" data-index="${index}">
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tx.description}</td>
                <td>${u.field}</td>
                <td style="color: var(--danger); text-decoration: line-through;">${u.field === 'category' ? tx.category : tx.type}</td>
                <td>${newValueHTML}</td>
                <td style="max-width: 200px; font-size: 0.85rem;">${u.reason}</td>
                <td style="text-align: center;">
                    <input type="checkbox" class="audit-check" checked data-id="${u.id}" data-field="${u.field}" data-index="${index}">
                </td>
            </tr>
        `;
    }).filter(row => row !== '').join('');

    contentArea.innerHTML = `
        <div class="card">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
                <div>
                    <h2 style="margin: 0 0 0.5rem 0;">
                        <i class="fa-solid fa-robot"></i> AI Audit Results
                    </h2>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">
                        Found ${updates.length} suggestions • Run on ${timestamp}
                    </p>
                </div>
                <button class="btn btn-secondary" onclick="window.location.hash='#settings'">
                    <i class="fa-solid fa-arrow-left"></i> Back to Settings
                </button>
            </div>

            <!-- Action Bar -->
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center;">
                <button class="btn btn-sm" id="select-all-btn">
                    <i class="fa-solid fa-check-double"></i> Select All
                </button>
                <button class="btn btn-sm" id="deselect-all-btn">
                    <i class="fa-solid fa-square"></i> Deselect All
                </button>
                <div style="flex: 1;"></div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span id="selected-count" style="color: var(--text-secondary); font-weight: 500;">
                        ${updates.length} selected
                    </span>
                    <button class="btn btn-primary" id="apply-changes-btn">
                        <i class="fa-solid fa-check"></i> Apply Selected Changes
                    </button>
                </div>
            </div>

            <!-- Search and Filter -->
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="position: relative;">
                    <i class="fa-solid fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary);"></i>
                    <input type="text" id="audit-search" placeholder="Search transactions..." 
                        style="width: 100%; padding: 0.5rem 0.5rem 0.5rem 2rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                </div>
                <select id="audit-filter" style="padding: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                    <option value="all">All Changes</option>
                    <option value="category">Category Changes Only</option>
                    <option value="type">Type Changes Only</option>
                </select>
            </div>

            <!-- Results Table -->
            <div style="overflow-x: auto; margin-bottom: 1rem;">
                <table class="transaction-table" style="width: 100%;">
                    <thead style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 10;">
                        <tr>
                            <th>Transaction</th>
                            <th>Field</th>
                            <th>Old Value</th>
                            <th>New Value</th>
                            <th>Reason</th>
                            <th>Apply</th>
                        </tr>
                    </thead>
                    <tbody id="audit-results-tbody">
                        ${rows}
                    </tbody>
                </table>
            </div>

            <!-- Footer Stats -->
            <div style="padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius-sm); text-align: center; color: var(--text-secondary);">
                Showing <span id="visible-count">${updates.length}</span> of ${updates.length} suggestions
            </div>
        </div>
    `;

    // Attach event listeners
    attachAuditListeners(updates);
};

/**
 * Attaches event listeners to audit results page
 * @param {Array} updates - Original updates array
 */
const attachAuditListeners = (updates) => {
    // Select/Deselect All
    document.getElementById('select-all-btn')?.addEventListener('click', () => {
        document.querySelectorAll('.audit-check').forEach(cb => cb.checked = true);
        updateSelectedCount();
    });

    document.getElementById('deselect-all-btn')?.addEventListener('click', () => {
        document.querySelectorAll('.audit-check').forEach(cb => cb.checked = false);
        updateSelectedCount();
    });

    // Update count when checkboxes change
    document.querySelectorAll('.audit-check').forEach(cb => {
        cb.addEventListener('change', updateSelectedCount);
    });

    // Search functionality
    document.getElementById('audit-search')?.addEventListener('input', (e) => {
        filterResults(e.target.value, document.getElementById('audit-filter').value, updates);
    });

    // Filter functionality
    document.getElementById('audit-filter')?.addEventListener('change', (e) => {
        filterResults(document.getElementById('audit-search').value, e.target.value, updates);
    });

    // Apply changes button
    document.getElementById('apply-changes-btn')?.addEventListener('click', () => {
        applySelectedChanges(updates);
    });
};

/**
 * Updates the selected count display
 */
const updateSelectedCount = () => {
    const checked = document.querySelectorAll('.audit-check:checked').length;
    const countEl = document.getElementById('selected-count');
    if (countEl) {
        countEl.textContent = `${checked} selected`;
    }
};

/**
 * Filters audit results based on search and filter
 * @param {string} searchTerm - Search term
 * @param {string} filterType - Filter type (all/category/type)
 * @param {Array} updates - Original updates array
 */
const filterResults = (searchTerm, filterType, updates) => {
    const rows = document.querySelectorAll('.audit-row');
    let visibleCount = 0;

    rows.forEach((row, index) => {
        const update = updates[index];
        const tx = state.transactions.find(t => t.id === update.id);

        if (!tx) {
            row.style.display = 'none';
            return;
        }

        // Check search term
        const matchesSearch = !searchTerm ||
            tx.description.toLowerCase().includes(searchTerm.toLowerCase());

        // Check filter
        const matchesFilter = filterType === 'all' || update.field === filterType;

        if (matchesSearch && matchesFilter) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    // Update visible count
    const visibleCountEl = document.getElementById('visible-count');
    if (visibleCountEl) {
        visibleCountEl.textContent = visibleCount;
    }
};

/**
 * Applies the selected audit changes
 * @param {Array} updates - Original updates array
 */
const applySelectedChanges = async (updates) => {
    const checks = document.querySelectorAll('.audit-check:checked');
    const changes = Array.from(checks).map(c => {
        const index = parseInt(c.dataset.index);
        const update = updates[index];
        const id = c.dataset.id;
        const field = c.dataset.field;

        // Get the value from the dropdown if it's a category change
        let value;
        if (field === 'category') {
            const dropdown = document.querySelector(`.audit-new-value[data-index="${index}"]`);
            value = dropdown ? dropdown.value : update.new_value;
        } else {
            value = update.new_value;
        }

        return { id, field, value };
    });

    if (changes.length === 0) {
        alert('No changes selected.');
        return;
    }

    const btn = document.getElementById('apply-changes-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Applying...';

    try {
        // 1. Check for new categories to create
        const newCategories = new Set();
        changes.forEach(c => {
            if (c.field === 'category') {
                const exists = state.categories.some(cat => cat.name.toLowerCase() === c.value.toLowerCase());
                if (!exists) newCategories.add(c.value);
            }
        });

        for (const catName of newCategories) {
            await supabaseClient.from('categories').insert([{
                user_id: state.user.id,
                name: catName,
                type: 'expense',
                color_code: getRandomColor()
            }]);
        }

        // 2. Apply updates
        for (const change of changes) {
            const update = {};
            update[change.field] = change.value;

            await supabaseClient
                .from('transactions')
                .update(update)
                .eq('id', change.id);
        }

        alert(`Successfully applied ${changes.length} changes!`);

        // Clear saved results and reload data
        clearAuditResults();
        await loadData();

        // Navigate back to settings
        window.location.hash = '#settings';

    } catch (error) {
        console.error('Apply Error:', error);
        alert('Error applying changes: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};
