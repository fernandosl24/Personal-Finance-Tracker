import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { loadData } from './dataLoader.js';
import { handleLogin, handleSignUp, handleLogout } from './auth.js';
import { renderSpendingChart, renderAnalyticsCategoryChart, renderAnalyticsTrendChart, renderAnalyticsDailyChart } from './charts.js';
import { renderTransactions, renderTransactionList, filterTransactions, handleTransactionSubmit, deleteTransaction, editTransaction, autoFillTransaction, processCSVImport } from './transactions.js';
import { renderAccounts, handleAccountSubmit, deleteAccount } from './accounts.js';
import { handleCategorySubmit, deleteCategory, editCategory, syncCategories, optimizeCategories } from './categories.js';
import { renderGoals } from './goals.js';
import { renderBudgets } from './budgets.js';
import { startAIAudit, processSmartImport } from './ai.js';
import { renderAuditResultsPage, loadSavedAuditResults } from './audit-results.js';
import { formatCurrency } from './utils.js';
import { initTheme, renderThemeSelector, attachThemeListener } from './theme.js';

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize theme first
    initTheme();
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./sw.js');
            // Service Worker registered successfully
        } catch (err) {
            console.error('Service Worker registration failed:', err);
        }
    }

    // Check for Supabase
    if (!supabaseClient) {
        console.error('Supabase client not initialized.');
        return;
    }

    // Auth State Listener
    let isInitialLoad = true;
    supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('🔐 Auth event:', event, 'Hash:', window.location.hash, 'Initial:', isInitialLoad);

        if (session) {
            state.user = session.user;

            // Only navigate on the very first SIGNED_IN event or if we're on login page
            const currentHash = window.location.hash.slice(1);
            const isOnLoginPage = currentHash === 'login' || !currentHash;

            if (event === 'SIGNED_IN' && (isInitialLoad || isOnLoginPage)) {
                console.log('✅ Navigating to dashboard (initial sign-in)');
                loadData();
                navigateTo('dashboard');
                isInitialLoad = false;
            } else if (event === 'SIGNED_IN' && !isInitialLoad && !isOnLoginPage) {
                // User is already signed in and on a page - just reload data
                console.log('🔄 Reloading data only (already on a page)');
                loadData();
            } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                // Silent data reload, absolutely no navigation
                console.log('🔄 Token refreshed - reloading data silently');
                loadData();
            } else if (event === 'INITIAL_SESSION') {
                // Initial session check - don't navigate, just load data
                console.log('🔄 Initial session - loading data only');
                loadData();
            }

            const emailEl = document.getElementById('user-email');
            if (emailEl) emailEl.textContent = session.user.email;
        } else {
            state.user = null;
            navigateTo('login');
        }
    });

    // Initial Route
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        navigateTo('login');
    } else {
        state.user = session.user;
        loadData();

        // Navigate to hash if present, otherwise dashboard
        const initialHash = window.location.hash.slice(1);
        navigateTo(initialHash || 'dashboard');
    }

    // Attach Auth Event Listener
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Determine if Login or Signup based on visibility or mode
            // For simplicity, let's assume the form handles both or we check a flag.
            // The original code had separate handleLogin/handleSignUp but the HTML only has one form?
            // Wait, app_v2.js only had handleLogin attached to auth-form submit.
            // But auth.js had handleSignUp.
            // Let's check the HTML. It has a toggle.
            // If we are in "Sign Up" mode, we call handleSignUp.
            const isSignUp = document.getElementById('auth-submit-btn').textContent === 'Sign Up';
            if (isSignUp) {
                handleSignUp(e);
            } else {
                handleLogin(e);
            }
        });
    }

    // Attach Logout Listener
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Attach Navigation Listeners
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            navigateTo(page);
        });
    });

    // Attach Add Transaction Button Listener (Issue #3 fix)
    const addTxBtn = document.getElementById('add-transaction-btn');
    if (addTxBtn) {
        addTxBtn.addEventListener('click', () => {
            // Reset form for new transaction with null checks
            const tIdEl = document.getElementById('t-id');
            const tSubmitBtn = document.getElementById('t-submit-btn');
            const deleteBtn = document.getElementById('t-delete-btn');
            const tDateEl = document.getElementById('t-date');
            const modal = document.getElementById('transaction-modal');

            if (tIdEl) tIdEl.value = '';
            if (tSubmitBtn) tSubmitBtn.textContent = 'Add Transaction';
            if (deleteBtn) deleteBtn.style.display = 'none';

            // Issue #22 fix: Set default date to today
            if (tDateEl) {
                const today = new Date().toISOString().split('T')[0];
                tDateEl.value = today;
            }

            if (modal) modal.style.display = 'flex';
        });
    }

    // Attach Close Transaction Modal Listener
    const closeTxModal = document.getElementById('close-tx-modal');
    if (closeTxModal) {
        closeTxModal.addEventListener('click', () => {
            const modal = document.getElementById('transaction-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    // Global Transaction Form Submit Listener (Issue #4 fix)
    const transactionForm = document.getElementById('add-transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionSubmit);
    }

    // Attach Delete Transaction Button Listener (Issue #6 fix - remove dynamic import)
    const deleteTxBtn = document.getElementById('t-delete-btn');
    if (deleteTxBtn) {
        deleteTxBtn.addEventListener('click', async () => {
            const txIdEl = document.getElementById('t-id');
            const txId = txIdEl ? txIdEl.value : null;

            if (txId && confirm('Are you sure you want to delete this transaction?')) {
                await deleteTransaction(txId);  // Use top-level import
                const modal = document.getElementById('transaction-modal');
                if (modal) modal.style.display = 'none';
            }
        });
    }

    // Attach Export CSV Listener (finding by onclick attribute for now)
    const exportBtn = document.querySelector('a[onclick="exportToCSV()"]');
    if (exportBtn) {
        exportBtn.removeAttribute('onclick'); // Remove inline handler
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            exportToCSV();
        });
    }
    // Mobile Menu Logic
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (mobileMenuBtn && sidebar && overlay) {
        // Toggle Sidebar
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        // Close when clicking overlay
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });

        // Close when clicking a nav link (on mobile)
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                }
            });
        });
    }
});

/**
 * Loads and displays audit history
 */
const loadAuditHistory = async () => {
    const container = document.getElementById('audit-history-container');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('audit_results')
            .select('*')
            .eq('user_id', state.user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    No audit history found. Run your first AI audit to get started!
                </p>
            `;
            return;
        }

        const rows = data.map(audit => {
            const date = new Date(audit.created_at).toLocaleString();
            const statusColor = audit.status === 'applied' ? 'var(--success)' :
                audit.status === 'pending' ? 'var(--warning)' :
                    'var(--text-secondary)';
            const statusIcon = audit.status === 'applied' ? 'fa-check-circle' :
                audit.status === 'pending' ? 'fa-clock' :
                    'fa-times-circle';

            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 0.75rem; background: var(--bg-secondary);">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <i class="fa-solid ${statusIcon}" style="color: ${statusColor};"></i>
                            <strong>${date}</strong>
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">
                            ${audit.total_suggestions} suggestions found
                            ${audit.status === 'applied' ? ` • ${audit.applied_count} changes applied` : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        ${audit.status === 'pending' ? `
                            <button class="btn btn-sm btn-primary" onclick="viewAudit('${audit.id}')">
                                <i class="fa-solid fa-eye"></i> View
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-secondary" onclick="viewAudit('${audit.id}')">
                                <i class="fa-solid fa-history"></i> Review
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = rows;

    } catch (error) {
        console.error('Error loading audit history:', error);
        container.innerHTML = `
            <p style="text-align: center; color: var(--danger); padding: 1rem;">
                Error loading audit history. Please try again.
            </p>
        `;
    }
};

/**
 * Views a specific audit by ID
 * @param {string} auditId - Audit ID to view
 */
window.viewAudit = async (auditId) => {
    try {
        const { data, error } = await supabaseClient
            .from('audit_results')
            .select('*')
            .eq('id', auditId)
            .eq('user_id', state.user.id)
            .single();

        if (error) throw error;

        if (data) {
            // Store in session for quick access
            sessionStorage.setItem('current-audit-id', data.id);

            // Navigate to audit results page
            const auditData = {
                id: data.id,
                timestamp: data.created_at,
                totalSuggestions: data.total_suggestions,
                status: data.status,
                updates: data.updates
            };

            renderAuditResultsPage(data.updates, auditData);
            window.location.hash = '#audit-results';
        }
    } catch (error) {
        console.error('Error viewing audit:', error);
        alert('Error loading audit: ' + error.message);
    }
};

// Navigation Logic
const navigateTo = (viewId) => {
    // Special case for Login
    const authOverlay = document.getElementById('auth-overlay');
    if (!authOverlay) return;

    if (viewId === 'login') {
        authOverlay.classList.add('active');
        return;
    } else {
        authOverlay.classList.remove('active');
    }

    // Update Nav Active State
    document.querySelectorAll('[data-page]').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`[data-page="${viewId}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Update Page Title
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = viewId.charAt(0).toUpperCase() + viewId.slice(1);

    // Render specific view content
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'transactions') renderTransactions();
    if (viewId === 'analytics') renderAnalytics();
    if (viewId === 'settings') renderSettings();
    if (viewId === 'accounts') renderAccounts();
    if (viewId === 'goals') renderGoals();
    if (viewId === 'budgets') renderBudgets();
    if (viewId === 'audit-results') {
        loadSavedAuditResults().then(savedResults => {
            if (savedResults && savedResults.updates) {
                renderAuditResultsPage(savedResults.updates, savedResults);
            } else {
                navigateTo('settings');
                alert('No audit results found. Please run an audit first.');
            }
        });
    }
    // if (viewId === 'categories') renderCategories(); // Categories managed in settings
};

// Expose navigateTo to window for legacy onclicks (if any remain)
window.navigateTo = navigateTo;

// View Renderers
const renderDashboard = () => {
    const totalBalance = state.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    // Calculate Monthly Stats
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyTransactions = state.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyIncome = monthlyTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpense = monthlyTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    // All Time Stats
    const allIncome = state.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const allExpense = state.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    // Determine if we should show Monthly or All Time for the chart
    const hasMonthlyData = monthlyTransactions.some(t => t.type === 'income' || t.type === 'expense');
    const showAllTime = !hasMonthlyData && state.transactions.some(t => t.type === 'income' || t.type === 'expense');

    const chartTransactions = showAllTime ? state.transactions : monthlyTransactions;
    const chartTitle = showAllTime ? 'Spending Overview (All Time)' : 'Spending Overview (This Month)';

    // Update DOM
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="dashboard-grid">
            <div class="card balance">
                <h3>Net Worth</h3>
                <div class="amount" style="color: var(--accent-primary);">${formatCurrency(totalBalance)}</div>
            </div>
            <div class="card income">
                <h3>Income <small>(${showAllTime ? 'All Time' : 'This Month'})</small></h3>
                <div class="amount">${formatCurrency(showAllTime ? allIncome : monthlyIncome)}</div>
            </div>
            <div class="card expense">
                <h3>Expenses <small>(${showAllTime ? 'All Time' : 'This Month'})</small></h3>
                <div class="amount">${formatCurrency(showAllTime ? allExpense : monthlyExpense)}</div>
            </div>
        </div>

        <div class="dashboard-grid" style="grid-template-columns: 2fr 1fr;">
            <div class="card">
                <h3>${chartTitle}</h3>
                <canvas id="spendingChart"></canvas>
            </div>
            <div class="card">
                <h3>Recent Activity</h3>
                ${renderTransactionList(state.transactions.slice(0, 5))}
                <button class="btn btn-sm btn-block nav-link" data-page="transactions">View All</button>
            </div>
        </div>
    `;

    renderSpendingChart(chartTransactions);
};



const renderAnalytics = () => {
    const contentArea = document.getElementById('content-area');

    // Calculate summary statistics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthTransactions = state.transactions.filter(t =>
        new Date(t.date) >= startOfMonth
    );

    const income = thisMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const expenses = thisMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const netSavings = income - expenses;
    const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;

    // Calculate top spending categories
    const categorySpending = {};
    thisMonthTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
        });

    const topCategories = Object.entries(categorySpending)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    contentArea.innerHTML = `
        <div class="analytics-container">
            <h2>Financial Analytics</h2>
            
            <!-- Summary Cards -->
            <div class="analytics-summary">
                <div class="summary-card">
                    <h4>Total Income (This Month)</h4>
                    <p class="summary-value" style="color: var(--success);">${formatCurrency(income)}</p>
                </div>
                <div class="summary-card">
                    <h4>Total Expenses (This Month)</h4>
                    <p class="summary-value" style="color: var(--danger);">${formatCurrency(expenses)}</p>
                </div>
                <div class="summary-card">
                    <h4>Net Savings (This Month)</h4>
                    <p class="summary-value" style="color: ${netSavings >= 0 ? 'var(--success)' : 'var(--danger)'};">${formatCurrency(netSavings)}</p>
                </div>
                <div class="summary-card">
                    <h4>Savings Rate</h4>
                    <p class="summary-value" style="color: ${savingsRate >= 20 ? 'var(--success)' : 'var(--warning)'};">${savingsRate.toFixed(1)}%</p>
                </div>
            </div>
            
            <!-- Charts Row 1 -->
            <div class="charts-row">
                <div class="card chart-card">
                    <h3>Expense Breakdown</h3>
                    <canvas id="analyticsCategoryChart"></canvas>
                </div>
                <div class="card chart-card">
                    <h3>Daily Spending (This Month)</h3>
                    <canvas id="analyticsDailyChart"></canvas>
                </div>
            </div>
            
            <!-- Charts Row 2 -->
            <div class="charts-row">
                <div class="card chart-card-full">
                    <h3>Income vs Expense (Last 6 Months)</h3>
                    <canvas id="analyticsTrendChart"></canvas>
                </div>
            </div>
            
            <!-- Top Spending Categories -->
            <div class="card">
                <h3>Top Spending Categories (This Month)</h3>
                <div id="top-categories-list">
                    ${topCategories.length > 0 ? topCategories.map(([category, amount], index) => `
                        <div style="display: flex; justify-content: space-between; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
                            <span>${index + 1}. ${category}</span>
                            <span style="font-weight: 600; color: var(--accent-primary);">${formatCurrency(amount)}</span>
                        </div>
                    `).join('') : '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No data available</p>'}
                </div>
            </div>
        </div>
    `;

    renderAnalyticsTrendChart(state.transactions);
    renderAnalyticsCategoryChart(state.transactions);
    renderAnalyticsDailyChart(state.transactions);
};

const renderSettings = () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="card" style="max-width: 600px; margin: 0 auto;">
            <h3>Settings</h3>
            
            <div class="form-group">
                <label>OpenAI API Key</label>
                <input type="password" id="openai-key" placeholder="sk-..." value="${localStorage.getItem('openai_api_key') || ''}">
                <small style="color: var(--text-secondary);">Required for AI features (Smart Import, Audit).</small>
            </div>
            
            <hr style="margin: 2rem 0; border-color: var(--border-color);">
            
            <h3>Appearance</h3>
            ${renderThemeSelector()}
            
            <hr style="margin: 2rem 0; border-color: var(--border-color);">
            
            <h3>Data Management</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Export your data for backup or import from a previous backup.
            </p>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                <button class="btn btn-secondary btn-sm" id="export-json-btn">
                    <i class="fa-solid fa-download"></i> Export Backup (JSON)
                </button>
                <button class="btn btn-secondary btn-sm" id="import-json-btn">
                    <i class="fa-solid fa-upload"></i> Import Backup (JSON)
                </button>
                <button class="btn btn-secondary btn-sm" id="export-csv-btn">
                    <i class="fa-solid fa-file-csv"></i> Export CSV
                </button>
                <button class="btn btn-secondary btn-sm" id="export-pdf-btn">
                    <i class="fa-solid fa-file-pdf"></i> Export PDF Report
                </button>
            </div>
            <small style="color: var(--text-secondary);">
                JSON backup includes all data. PDF generates a formatted financial report.
            </small>
            
            <hr style="margin: 2rem 0; border-color: var(--border-color);">

            <h3>Category Management</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Manage your transaction categories. Add custom categories or optimize existing ones.
            </p>
            
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
                <button class="btn btn-primary btn-sm" id="add-category-btn">
                    <i class="fa-solid fa-plus"></i> Add Category
                </button>
                <button class="btn btn-secondary btn-sm" id="sync-categories-btn">
                    <i class="fa-solid fa-sync"></i> Sync Categories
                </button>
                <button class="btn btn-secondary btn-sm" id="optimize-categories-btn">
                    <i class="fa-solid fa-magic"></i> AI Optimize
                </button>
            </div>

            <div id="categories-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.5rem;">
                <p style="text-align: center; color: var(--text-secondary); padding: 1rem;">
                    Loading categories...
                </p>
            </div>

            <hr style="margin: 2rem 0; border-color: var(--border-color);">

            <button class="btn btn-primary" id="save-settings-btn">Save Settings</button>

            <hr style="margin: 2rem 0; border-color: var(--border-color);">

            <h3>AI Transaction Audit</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Analyze your transactions to find mis-categorizations and suggest improvements.
            </p>
            <div class="form-group">
                <label>Scope</label>
                <select id="audit-scope">
                    <option value="50">Last 50 Transactions</option>
                    <option value="100">Last 100 Transactions</option>
                    <option value="all">All Transactions</option>
                </select>
            </div>
            <button class="btn btn-primary" id="start-audit-btn">
                <i class="fa-solid fa-robot"></i> Start AI Audit
            </button>

            <hr style="margin: 2rem 0; border-color: var(--border-color);">

            <h3>Audit History</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                View and manage your previous AI audit results.
            </p>
            <div id="audit-history-container">
                <p style="text-align: center; color: var(--text-secondary); padding: 1rem;">
                    <i class="fa-solid fa-circle-notch fa-spin"></i> Loading audit history...
                </p>
            </div>
        </div>
    `;

    // Load audit history
    loadAuditHistory();

    // Load categories list after a short delay to ensure data is loaded
    setTimeout(() => renderCategoriesList(), 300);

    // Attach settings listeners (Issue #10 fix - prevent memory leak)
    const settingsButtons = [
        {
            id: 'save-settings-btn', handler: () => {
                const key = document.getElementById('openai-key').value;
                if (key) {
                    localStorage.setItem('openai_api_key', key);
                    alert('Settings saved!');
                }
            }
        },
        { id: 'export-json-btn', handler: exportToJSON },
        { id: 'import-json-btn', handler: importFromJSON },
        { id: 'export-csv-btn', handler: exportToCSV },
        { id: 'export-pdf-btn', handler: exportToPDF },
        { id: 'add-category-btn', handler: () => handleCategorySubmit(null, true) },
        { id: 'sync-categories-btn', handler: syncCategories },
        { id: 'optimize-categories-btn', handler: optimizeCategories },
        { id: 'start-audit-btn', handler: startAIAudit }
    ];

    settingsButtons.forEach(({ id, handler }) => {
        const element = document.getElementById(id);
        if (element) {
            // Clone element to remove all existing event listeners
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);

            // Add fresh listener
            newElement.addEventListener('click', handler);
        }
    });

    // Attach theme listener
    attachThemeListener();
};

const exportToCSV = () => {
    const rows = [
        ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account', 'Notes'],
        ...state.transactions.map(t => [
            t.date,
            `"${t.description.replace(/"/g, '""')}"`,
            t.amount,
            t.type,
            t.category,
            state.accounts.find(a => a.id == t.account_id)?.name || 'Unknown',
            `"${(t.notes || '').replace(/"/g, '""')}"`
        ])
    ];

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};

/**
 * Exports all data to JSON for backup
 */
const exportToJSON = () => {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        user: {
            id: state.user?.id,
            email: state.user?.email
        },
        data: {
            transactions: state.transactions,
            categories: state.categories,
            accounts: state.accounts,
            goals: state.goals,
            budgets: state.budgets
        }
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeflow_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert('Data exported successfully! Save this file for backup.');
};

/**
 * Imports data from JSON backup
 */
const importFromJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            // Validate import data
            if (!importData.version || !importData.data) {
                alert('Invalid backup file format.');
                return;
            }

            if (!confirm('This will import data from the backup. Existing data will be merged. Continue?')) {
                return;
            }

            // Import each data type
            const { transactions, categories, accounts, goals, budgets } = importData.data;

            // Import categories first (dependencies)
            if (categories && categories.length > 0) {
                for (const cat of categories) {
                    const exists = state.categories.find(c => c.name === cat.name && c.type === cat.type);
                    if (!exists) {
                        await supabaseClient.from('categories').insert([{
                            user_id: state.user.id,
                            name: cat.name,
                            type: cat.type,
                            color_code: cat.color_code
                        }]);
                    }
                }
            }

            // Import accounts
            if (accounts && accounts.length > 0) {
                for (const acc of accounts) {
                    const exists = state.accounts.find(a => a.name === acc.name);
                    if (!exists) {
                        await supabaseClient.from('accounts').insert([{
                            user_id: state.user.id,
                            name: acc.name,
                            balance: acc.balance
                        }]);
                    }
                }
            }

            // Import goals
            if (goals && goals.length > 0) {
                for (const goal of goals) {
                    const exists = state.goals.find(g => g.name === goal.name);
                    if (!exists) {
                        await supabaseClient.from('goals').insert([{
                            user_id: state.user.id,
                            name: goal.name,
                            target_amount: goal.target_amount,
                            current_amount: goal.current_amount,
                            deadline: goal.deadline
                        }]);
                    }
                }
            }

            // Import budgets
            if (budgets && budgets.length > 0) {
                for (const budget of budgets) {
                    const exists = state.budgets.find(b => b.category === budget.category);
                    if (!exists) {
                        await supabaseClient.from('budgets').insert([{
                            user_id: state.user.id,
                            category: budget.category,
                            amount: budget.amount,
                            period: budget.period || 'monthly'
                        }]);
                    }
                }
            }

            // Import transactions last
            if (transactions && transactions.length > 0) {
                for (const tx of transactions) {
                    const exists = state.transactions.find(t =>
                        t.date === tx.date &&
                        t.amount === tx.amount &&
                        t.description === tx.description
                    );
                    if (!exists) {
                        await supabaseClient.from('transactions').insert([{
                            user_id: state.user.id,
                            date: tx.date,
                            description: tx.description,
                            amount: tx.amount,
                            type: tx.type,
                            category: tx.category,
                            account_id: tx.account_id,
                            notes: tx.notes
                        }]);
                    }
                }
            }

            // Reload all data
            await loadData();
            alert('Data imported successfully!');
            window.location.reload();
        } catch (error) {
            console.error('Import error:', error);
            alert('Failed to import data. Please check the file format.');
        }
    };

    input.click();
};

/**
 * Exports transactions to PDF report
 */
const exportToPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Calculate summary statistics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthTransactions = state.transactions.filter(t =>
        new Date(t.date) >= startOfMonth
    );

    const income = thisMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const expenses = thisMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const netSavings = income - expenses;

    // Calculate top categories
    const categorySpending = {};
    thisMonthTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
        });

    const topCategories = Object.entries(categorySpending)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Header
    doc.setFontSize(20);
    doc.text('FinanceFlow - Financial Report', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });

    // Summary Section
    doc.setFontSize(14);
    doc.text('Monthly Summary', 20, 45);

    doc.setFontSize(10);
    let y = 55;
    doc.text(`Total Income: ${formatCurrency(income)}`, 20, y);
    y += 7;
    doc.text(`Total Expenses: ${formatCurrency(expenses)}`, 20, y);
    y += 7;
    doc.text(`Net Savings: ${formatCurrency(netSavings)}`, 20, y);
    y += 15;

    // Top Categories
    doc.setFontSize(14);
    doc.text('Top Spending Categories', 20, y);
    y += 10;

    doc.setFontSize(10);
    topCategories.forEach(([category, amount], index) => {
        doc.text(`${index + 1}. ${category}: ${formatCurrency(amount)}`, 25, y);
        y += 7;
    });

    y += 10;

    // Recent Transactions
    doc.setFontSize(14);
    doc.text('Recent Transactions (Last 20)', 20, y);
    y += 10;

    doc.setFontSize(9);
    const recentTransactions = state.transactions.slice(0, 20);

    recentTransactions.forEach((t, index) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        const accountName = state.accounts.find(a => a.id === t.account_id)?.name || '-';
        const line = `${t.date} | ${t.description.substring(0, 30)} | ${t.category} | ${t.type} | ${formatCurrency(t.amount)}`;
        doc.text(line, 20, y);
        y += 6;
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    // Save
    doc.save(`financeflow_report_${new Date().toISOString().split('T')[0]}.pdf`);
};


/**
 * Renders the categories list in settings
 */
const renderCategoriesList = () => {
    const container = document.getElementById('categories-list');
    console.log('renderCategoriesList called, container:', container, 'categories:', state.categories?.length);
    if (!container) return;

    if (!state.categories || state.categories.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; color: var(--text-secondary); padding: 1rem;">
                No categories found. Add your first category!
            </p>
        `;
        return;
    }

    const rows = state.categories.map(cat => {
        const typeColor = cat.type === 'income' ? 'var(--success)' :
            cat.type === 'expense' ? 'var(--danger)' :
                'var(--accent-primary)';

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${cat.color_code};"></div>
                    <span style="font-weight: 500;">${cat.name}</span>
                    <span style="font-size: 0.8rem; color: ${typeColor}; text-transform: capitalize;">
                        ${cat.type}
                    </span>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-icon edit-category-btn" data-category-id="${cat.id}" title="Edit">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-category-btn" data-category-id="${cat.id}" title="Delete" style="color: var(--danger);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = rows || `
        <p style="text-align: center; color: var(--text-secondary); padding: 1rem;">
            No categories found.
        </p>
    `;

    // Attach event listeners to edit and delete buttons
    const editButtons = document.querySelectorAll('.edit-category-btn');
    const deleteButtons = document.querySelectorAll('.delete-category-btn');

    console.log('Attaching listeners to', editButtons.length, 'edit buttons and', deleteButtons.length, 'delete buttons');

    editButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const categoryId = btn.dataset.categoryId;
            console.log('Edit clicked for category:', categoryId);
            editCategory(categoryId);
        });
    });

    deleteButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const categoryId = btn.dataset.categoryId;
            console.log('Delete clicked for category:', categoryId);
            deleteCategory(categoryId);
        });
    });
};

// Make functions globally accessible
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.renderCategoriesList = renderCategoriesList;
