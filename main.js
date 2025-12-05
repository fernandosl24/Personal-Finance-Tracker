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
import { startAIAudit, processSmartImport, showAuditResults, applyAuditChanges } from './ai.js';
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
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            state.user = session.user;
            loadData();
            navigateTo('dashboard');
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
        navigateTo('dashboard');
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

    // Attach Add Transaction Button Listener
    const addTxBtn = document.getElementById('add-transaction-btn');
    if (addTxBtn) {
        addTxBtn.addEventListener('click', () => {
            // Reset form for new transaction
            document.getElementById('t-id').value = '';
            document.getElementById('t-submit-btn').textContent = 'Add Transaction';
            // Hide delete button when adding new transaction
            const deleteBtn = document.getElementById('t-delete-btn');
            if (deleteBtn) deleteBtn.style.display = 'none';
            document.getElementById('transaction-modal').style.display = 'flex';
        });
    }

    // Attach Close Transaction Modal Listener
    const closeTxModal = document.getElementById('close-tx-modal');
    if (closeTxModal) {
        closeTxModal.addEventListener('click', () => {
            document.getElementById('transaction-modal').style.display = 'none';
        });
    }

    // Attach Delete Transaction Button Listener (in modal)
    const deleteTxBtn = document.getElementById('t-delete-btn');
    if (deleteTxBtn) {
        deleteTxBtn.addEventListener('click', () => {
            const txId = document.getElementById('t-id').value;
            if (txId && confirm('Are you sure you want to delete this transaction?')) {
                // Import deleteTransaction from transactions.js
                import('./transactions.js').then(module => {
                    module.deleteTransaction(txId);
                    document.getElementById('transaction-modal').style.display = 'none';
                });
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
                <button class="btn btn-sm btn-block" style="margin-top: 1rem;" onclick="navigateTo('transactions')">View All</button>
            </div>
        </div>
    `;

    renderSpendingChart(chartTransactions);
};



const renderAnalytics = () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="dashboard-grid">
            <div class="card full-width">
                <h3>Income vs Expense (Last 6 Months)</h3>
                <canvas id="analyticsTrendChart"></canvas>
            </div>
            <div class="card">
                <h3>Expense Breakdown</h3>
                <canvas id="analyticsCategoryChart"></canvas>
            </div>
            <div class="card">
                <h3>Daily Spending (This Month)</h3>
                <canvas id="analyticsDailyChart"></canvas>
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
            </div>
            <small style="color: var(--text-secondary);">
                JSON backup includes all data (transactions, categories, accounts, goals, budgets).
            </small>
            
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
        </div>
    `;

    document.getElementById('save-settings-btn').addEventListener('click', () => {
        const key = document.getElementById('openai-key').value;
        if (key) {
            localStorage.setItem('openai_api_key', key);
            alert('Settings saved!');
        }
    });

    // Attach theme listener
    attachThemeListener();

    // Attach export/import listeners
    document.getElementById('export-json-btn').addEventListener('click', exportToJSON);
    document.getElementById('import-json-btn').addEventListener('click', importFromJSON);
    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

    document.getElementById('start-audit-btn').addEventListener('click', startAIAudit);
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


