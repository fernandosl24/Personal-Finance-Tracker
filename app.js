// App State
const state = {
    user: null,
    currentPage: 'dashboard',
    transactions: [],
    budgets: [],
    goals: [],
    categories: [],
    isAuthModeSignup: false
};

// DOM Elements
const app = {
    authOverlay: document.getElementById('auth-overlay'),
    authForm: document.getElementById('auth-form'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    toggleAuthModeBtn: document.getElementById('toggle-auth-mode'),
    contentArea: document.getElementById('content-area'),
    pageTitle: document.getElementById('page-title'),
    navLinks: document.querySelectorAll('.nav-links li'),
    userName: document.getElementById('user-name'),
    userEmail: document.getElementById('user-email'),
    logoutBtn: document.getElementById('logout-btn')
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('FinanceFlow Initializing...');

    // Initialize Supabase
    try {
        if (!window.supabase) {
            throw new Error('Supabase client not loaded');
        }
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase Connected');
    } catch (error) {
        console.error('Initialization Error:', error);
        alert('Failed to connect to backend. Please check your internet connection.');
        return;
    }

    // Check Session
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    updateAuthState(session);

    // Auth Listener
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('Auth Event:', event);
        updateAuthState(session);
    });

    // Event Listeners
    setupEventListeners();

    // Initial Render
    if (state.user) {
        renderDashboard();
    }
});

function updateAuthState(session) {
    state.user = session ? session.user : null;

    if (state.user) {
        app.authOverlay.classList.remove('active');
        app.userName.textContent = state.user.user_metadata.full_name || 'User';
        app.userEmail.textContent = state.user.email;
        loadData();
    } else {
        app.authOverlay.classList.add('active');
        app.userName.textContent = 'Guest';
        app.userEmail.textContent = '';
    }
}

function setupEventListeners() {
    // Navigation
    app.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    // Auth Form
    app.authForm.addEventListener('submit', handleAuth);

    // Toggle Auth Mode
    app.toggleAuthModeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        state.isAuthModeSignup = !state.isAuthModeSignup;
        updateAuthUI();
    });

    // Logout
    app.logoutBtn.addEventListener('click', async () => {
        await window.supabaseClient.auth.signOut();
    });

    // Header Add Transaction Button
    const headerAddBtn = document.getElementById('add-transaction-btn');
    if (headerAddBtn) {
        headerAddBtn.addEventListener('click', () => {
            navigateTo('transactions');
            // Ideally open modal, but for now just nav to page where form is
            if (state.currentPage !== 'transactions') {
                navigateTo('transactions');
            }
            // Small delay to allow render to finish if navigating
            setTimeout(() => {
                const modal = document.getElementById('transaction-modal');
                if (modal) modal.style.display = 'flex';
            }, 100);
        });
    }

    // Modal Close Logic
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    };

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-modal')) {
            e.target.closest('.modal').style.display = 'none';
        }
    });
}

function updateAuthUI() {
    const title = app.authOverlay.querySelector('h2');
    const subtitle = app.authOverlay.querySelector('p');
    const btn = app.authSubmitBtn;
    const toggle = app.toggleAuthModeBtn;

    if (state.isAuthModeSignup) {
        title.textContent = 'Create Account';
        subtitle.textContent = 'Join FinanceFlow today.';
        btn.textContent = 'Sign Up';
        toggle.textContent = 'Already have an account? Sign In';
    } else {
        title.textContent = 'Welcome Back';
        subtitle.textContent = 'Manage your finances with style.';
        btn.textContent = 'Sign In';
        toggle.textContent = 'Don\'t have an account? Sign Up';
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    app.authSubmitBtn.disabled = true;
    app.authSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

    try {
        if (state.isAuthModeSignup) {
            const { error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: email.split('@')[0] } // Default name
                }
            });
            if (error) throw error;
            alert('Sign up successful! Please check your email for confirmation.');
        } else {
            const { error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
        }
    } catch (error) {
        alert(error.message);
    } finally {
        app.authSubmitBtn.disabled = false;
        app.authSubmitBtn.textContent = state.isAuthModeSignup ? 'Sign Up' : 'Sign In';
    }
}

// Navigation Logic
window.navigateTo = (page) => {
    state.currentPage = page;

    // Update Active Nav Link
    app.navLinks.forEach(link => {
        if (link.dataset.page === page) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Render Page Content
    switch (page) {
        case 'dashboard':
            app.pageTitle.textContent = 'Dashboard';
            renderDashboard();
            break;
        case 'transactions':
            app.pageTitle.textContent = 'Transactions';
            renderTransactions();
            break;
        case 'analytics':
            app.pageTitle.textContent = 'Analytics';
            renderAnalytics();
            break;
        case 'accounts':
            app.pageTitle.textContent = 'Accounts';
            renderAccounts();
            break;
        case 'budgets':
            app.pageTitle.textContent = 'Budgets';
            renderBudgets();
            break;
        case 'goals':
            app.pageTitle.textContent = 'Goals';
            renderGoals();
            break;
        case 'settings':
            app.pageTitle.textContent = 'Settings';
            renderSettings();
            break;
        default:
            renderDashboard();
    }
};

function renderAnalytics() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    app.contentArea.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <h3>Financial Insights</h3>
                <div class="filter-group">
                    <button class="btn btn-sm btn-primary" onclick="updateAnalytics('thisMonth')">This Month</button>
                    <button class="btn btn-sm" onclick="updateAnalytics('last3Months')" style="background: rgba(255,255,255,0.1);">Last 3 Months</button>
                    <button class="btn btn-sm" onclick="updateAnalytics('ytd')" style="background: rgba(255,255,255,0.1);">YTD</button>
                    <button class="btn btn-sm" onclick="updateAnalytics('allTime')" style="background: rgba(255,255,255,0.1);">All Time</button>
                </div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <h3>Spending by Category</h3>
                <canvas id="analyticsCategoryChart"></canvas>
            </div>
            <div class="card">
                <h3>Income vs Expense Trend</h3>
                <canvas id="analyticsTrendChart"></canvas>
            </div>
        </div>

        <div class="card" style="margin-top: 1.5rem;">
            <h3>Daily Spending (This Month)</h3>
            <canvas id="analyticsDailyChart"></canvas>
        </div>
    `;

    // Initial Render (This Month)
    updateAnalytics('thisMonth');
}

window.updateAnalytics = (range) => {
    // Update active button state
    const buttons = document.querySelectorAll('.filter-group button');
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(range.replace('thisMonth', 'this month').replace('last3Months', 'last 3 months').replace('ytd', 'ytd').replace('allTime', 'all time'))) {
            btn.classList.add('btn-primary');
            btn.style.background = '';
        } else {
            btn.classList.remove('btn-primary');
            btn.style.background = 'rgba(255,255,255,0.1)';
        }
    });

    // Filter Transactions
    const now = new Date();
    let filteredTransactions = state.transactions;

    if (range === 'thisMonth') {
        filteredTransactions = state.transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
    } else if (range === 'last3Months') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        filteredTransactions = state.transactions.filter(t => new Date(t.date) >= threeMonthsAgo);
    } else if (range === 'ytd') {
        filteredTransactions = state.transactions.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
    }

    // Render Charts
    renderAnalyticsCategoryChart(filteredTransactions);
    renderAnalyticsTrendChart(filteredTransactions, range);
    renderAnalyticsDailyChart(filteredTransactions);
};

function renderAnalyticsCategoryChart(transactions) {
    const ctx = document.getElementById('analyticsCategoryChart');
    if (!ctx) return;

    // Destroy existing chart if any
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const expenses = transactions.filter(t => t.type === 'expense'); // Already excludes transfers
    const byCategory = {};
    expenses.forEach(t => {
        const cat = t.category || 'Uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + t.amount;
    });

    const labels = Object.keys(byCategory);
    const data = Object.values(byCategory);
    const colors = labels.map(l => getCategoryColor(l));

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right', labels: { color: '#94a3b8' } }
            }
        }
    });
}

function renderAnalyticsTrendChart(transactions, range) {
    const ctx = document.getElementById('analyticsTrendChart');
    if (!ctx) return;

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    // Group by Month (YYYY-MM)
    const byMonth = {};
    transactions.forEach(t => {
        if (t.type === 'transfer') return; // Skip transfers

        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth[key]) byMonth[key] = { income: 0, expense: 0 };
        if (t.type === 'income') byMonth[key].income += t.amount;
        else if (t.type === 'expense') byMonth[key].expense += t.amount;
    });

    const labels = Object.keys(byMonth).sort();
    const incomeData = labels.map(l => byMonth[l].income);
    const expenseData = labels.map(l => byMonth[l].expense);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Income', data: incomeData, backgroundColor: '#10b981' },
                { label: 'Expense', data: expenseData, backgroundColor: '#ef4444' }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { labels: { color: '#94a3b8' } } }
        }
    });
}

function renderAnalyticsDailyChart(transactions) {
    const ctx = document.getElementById('analyticsDailyChart');
    if (!ctx) return;

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    // Filter for expenses only, group by day
    const expenses = transactions.filter(t => t.type === 'expense'); // Already excludes transfers
    const byDay = {};
    expenses.forEach(t => {
        const date = t.date; // YYYY-MM-DD
        byDay[date] = (byDay[date] || 0) + t.amount;
    });

    const labels = Object.keys(byDay).sort();
    const data = labels.map(l => byDay[l]);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Spending',
                data: data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { labels: { color: '#94a3b8' } } }
        }
    });
}

function renderSettings() {
    const apiKey = localStorage.getItem('openai_api_key') || '';

    app.contentArea.innerHTML = `
        <div class="card" style="max-width: 600px; margin: 0 auto;">
            <h3><i class="fa-solid fa-robot"></i> AI Settings</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Configure your OpenAI API key to enable smart transaction imports and auditing.
            </p>
            
            <form id="settings-form">
                <div class="form-group">
                    <label>OpenAI API Key</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="password" id="api-key" value="${apiKey}" placeholder="sk-..." style="flex: 1;">
                        <button type="button" class="btn" onclick="toggleApiKeyVisibility()">
                            <i class="fa-solid fa-eye" id="toggle-icon"></i>
                        </button>
                    </div>
                    <small style="display: block; margin-top: 0.5rem; color: var(--text-secondary);">
                        Don't have a key? <a href="https://platform.openai.com/api-keys" target="_blank" style="color: var(--accent-primary);">Get one here</a>.
                    </small>
                </div>
                <button type="submit" class="btn btn-primary">Save Settings</button>
            </form>
        </div>

        <div class="card" style="max-width: 600px; margin: 2rem auto;">
            <h3><i class="fa-solid fa-wand-magic-sparkles"></i> AI Transaction Audit</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Use OpenAI (GPT-4o) to scan your recent transactions and identify misclassified entries (e.g., missed Transfers).
            </p>
            
            <div class="form-group">
                <label>Analyze Last:</label>
                <select id="audit-limit" style="margin-bottom: 1rem;">
                    <option value="50">50 Transactions</option>
                    <option value="100">100 Transactions</option>
                    <option value="200">200 Transactions</option>
                    <option value="all">All Transactions</option>
                </select>
            </div>

            <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid var(--accent-primary); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <h4 style="font-size: 0.9rem; color: var(--accent-primary); margin-bottom: 0.5rem;">How it works</h4>
                <ul style="font-size: 0.85rem; color: var(--text-secondary); padding-left: 1.2rem; margin: 0;">
                    <li>Scans your selected transactions.</li>
                    <li>Identifies potential <strong>Transfers</strong> (matching amounts across accounts).</li>
                    <li>Suggests category improvements.</li>
                    <li>You review and approve all changes.</li>
                </ul>
            </div>
            <button class="btn btn-primary btn-block" onclick="startAIAudit()">
                <i class="fa-solid fa-microchip"></i> Start AI Audit
            </button>
        </div>

        <div class="card" style="max-width: 600px; margin: 2rem auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3><i class="fa-solid fa-tags"></i> Manage Categories</h3>
                <button class="btn btn-sm btn-primary" onclick="document.getElementById('category-modal').style.display='flex'">
                    <i class="fa-solid fa-plus"></i> Add Category
                </button>
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Create and manage custom categories for your transactions.
            </p>
            
            <div style="max-height: 300px; overflow-y: auto;">
                ${(state.categories || []).length === 0 ? '<p style="color: var(--text-secondary); text-align: center;">No custom categories found.</p>' : ''}
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        ${(state.categories || []).map(c => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 0.8rem 0;">
                                    <span class="badge" style="background-color: ${c.color_code}20; color: ${c.color_code}; border: 1px solid ${c.color_code}40;">
                                        ${c.name}
                                    </span>
                                </td>
                                <td style="padding: 0.8rem 0; color: var(--text-secondary); font-size: 0.9rem;">
                                    ${c.type.charAt(0).toUpperCase() + c.type.slice(1)}
                                </td>
                                <td style="text-align: right;">
                                    <button class="btn-icon delete-btn" onclick="deleteCategory(${c.id})">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Add Category Modal -->
        <div id="category-modal" class="modal">
            <div class="modal-content">
                <span class="close-modal" onclick="document.getElementById('category-modal').style.display='none'">&times;</span>
                <h2>Add Category</h2>
                <form id="add-category-form" onsubmit="return handleCategorySubmit(event)">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" id="cat-name" required placeholder="e.g., Subscriptions">
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="cat-type" required>
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <input type="color" id="cat-color" value="#6366f1" style="height: 40px; padding: 0.2rem;">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Save Category</button>
                </form>
            </div>
        </div>

        <div class="card" style="max-width: 600px; margin: 2rem auto; border: 1px solid var(--danger);">
            <h3 style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Danger Zone</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Irreversible actions. Proceed with caution.
            </p>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="font-size: 1rem; margin-bottom: 0.2rem;">Reset All Data</h4>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">Delete all transactions, accounts, budgets, and goals.</span>
                </div>
                <button class="btn" onclick="resetAllData()" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid var(--danger);">
                    Reset Data
                </button>
            </div>
        </div>
    `;

    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('api-key').value.trim();
        if (key) {
            localStorage.setItem('openai_api_key', key);
            alert('API Key saved successfully!');
        } else {
            localStorage.removeItem('openai_api_key');
            alert('API Key removed.');
        }
    });
}

window.resetAllData = async () => {
    const confirmation = prompt('WARNING: This will delete ALL your data (Transactions, Accounts, Goals, Budgets).\n\nType "DELETE" to confirm.');

    if (confirmation === 'DELETE') {
        try {
            const userId = state.user.id;

            // Delete in order of dependencies
            await window.supabaseClient.from('transactions').delete().eq('user_id', userId);
            await window.supabaseClient.from('budgets').delete().eq('user_id', userId);
            await window.supabaseClient.from('goals').delete().eq('user_id', userId);
            await window.supabaseClient.from('accounts').delete().eq('user_id', userId);

            alert('All data has been reset.');
            loadData();
        } catch (error) {
            console.error('Reset Error:', error);
            alert('Failed to reset data: ' + error.message);
        }
    } else if (confirmation !== null) {
        alert('Reset cancelled. You must type "DELETE" exactly.');
    }
};

window.toggleApiKeyVisibility = () => {
    const input = document.getElementById('api-key');
    const icon = document.getElementById('toggle-icon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
};

async function loadData() {
    try {
        // Fetch Transactions
        const { data: transactions, error: tError } = await window.supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (tError) throw tError;
        state.transactions = transactions;
        if (transactions.length > 0) {
            console.log('DEBUG: Transaction Structure:', transactions[0]);
        }

        // Fetch Budgets
        const { data: budgets, error: bError } = await window.supabaseClient
            .from('budgets')
            .select('*');

        if (bError) {
            console.warn('Budgets fetch error:', bError);
            state.budgets = [];
        } else {
            state.budgets = budgets;
        }

        // Fetch Goals
        const { data: goals, error: gError } = await window.supabaseClient
            .from('goals')
            .select('*');

        if (gError) {
            console.warn('Goals fetch error:', gError);
            state.goals = [];
        } else {
            state.goals = goals;
        }

        // Fetch Accounts
        const { data: accounts, error: aError } = await window.supabaseClient
            .from('accounts')
            .select('*');

        if (aError) {
            console.warn('Accounts fetch error:', aError);
            state.accounts = [];
        } else {
            state.accounts = accounts;
        }

        // Fetch Categories
        const { data: categories, error: cError } = await window.supabaseClient
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

        if (cError) {
            console.warn('Categories fetch error:', cError);
            state.categories = [];
        } else {
            state.categories = categories;
        }

        // Refresh current view
        navigateTo(state.currentPage);
    } catch (error) {
        console.error('Data Load Error:', error);
    }
}

// --- Helper Functions ---

function getUniqueCategories() {
    const defaultCategories = ['Groceries', 'Rent', 'Transport', 'Salary', 'Entertainment', 'Utilities'];
    const usedCategories = state.transactions.map(t => t.category).filter(Boolean);
    return [...new Set([...defaultCategories, ...usedCategories])].sort();
}

function getCategoryColor(category) {
    const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
        '#eab308', '#84cc16', '#10b981', '#06b6d4', '#0ea5e9'
    ];
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// --- Render Functions ---

function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate Totals (Exclude Transfers)
    const allIncome = state.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const allExpense = state.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = allIncome - allExpense;

    // Calculate Net Worth (Sum of all account balances)
    const netWorth = (state.accounts || []).reduce((sum, a) => sum + a.balance, 0);

    // Monthly Metrics (Exclude Transfers)
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

    // Determine if we should show Monthly or All Time for the chart
    // Only consider income/expense for chart data availability
    const hasMonthlyData = monthlyTransactions.some(t => t.type === 'income' || t.type === 'expense');
    const showAllTime = !hasMonthlyData && state.transactions.some(t => t.type === 'income' || t.type === 'expense');

    const chartTransactions = showAllTime ? state.transactions : monthlyTransactions;
    const chartTitle = showAllTime ? 'Spending Overview (All Time)' : 'Spending Overview (This Month)';

    app.contentArea.innerHTML = `
        <div class="dashboard-grid">
            <div class="card balance">
                <h3>Net Worth</h3>
                <div class="amount" style="color: var(--accent-primary);">${formatCurrency(netWorth)}</div>
                <small style="color: var(--text-secondary);">Cash Flow: ${formatCurrency(balance)}</small>
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

    // Render Chart
    renderSpendingChart(chartTransactions);
}

function renderSpendingChart(transactions) {
    const ctx = document.getElementById('spendingChart').getContext('2d');

    // Group expenses by category (Exclude Transfers)
    const expensesByCategory = {};
    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            const cat = t.category || 'Uncategorized';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
        });

    const labels = Object.keys(expensesByCategory);
    const data = Object.values(expensesByCategory);
    const colors = labels.map(l => getCategoryColor(l));

    if (labels.length === 0) {
        // Show empty state if no data
        return;
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8' }
                }
            }
        }
    });
}

function renderTransactions() {
    const categories = getUniqueCategories();

    app.contentArea.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>All Transactions</h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('transaction-modal').style.display='flex'">
                        <i class="fa-solid fa-plus"></i> Add Transaction
                    </button>
                    <button class="btn btn-sm" onclick="document.getElementById('csv-import-modal').style.display='flex'" style="background: var(--accent-secondary); color: white; border: 1px solid var(--accent-secondary);">
                        <i class="fa-solid fa-file-csv"></i> Import CSV
                    </button>
                </div>
            </div>
            ${renderTransactionList(state.transactions)}
        </div>
        
        <!-- Add Transaction Modal -->
        <div id="transaction-modal" class="modal">
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h2>Add Transaction</h2>
                
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(99, 102, 241, 0.1); border: 1px dashed var(--accent-primary); border-radius: var(--radius-sm); text-align: center;">
                    <button type="button" class="btn btn-sm" onclick="document.getElementById('smart-import-modal').style.display='flex'" style="background: none; border: 1px solid var(--accent-primary); color: var(--accent-primary);">
                        <i class="fa-solid fa-magic"></i> Smart Import (AI)
                    </button>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">Auto-fill from text or image</p>
                </div>

                <form id="add-transaction-form" onsubmit="return handleTransactionSubmit(event)">
                    <input type="hidden" id="t-id"> <!-- Hidden ID for Editing -->
                    
                    <div class="form-group">
                        <label>Type</label>
                        <select id="t-type" required>
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                            <option value="transfer">Transfer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount</label>
                        <input type="number" id="t-amount" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select id="t-category" required>
                            <option value="">-- Select Category --</option>
                            ${(state.categories || []).map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                            <option value="Uncategorized">Uncategorized</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="t-date" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Account (Optional)</label>
                        <select id="t-account">
                            <option value="">-- Select Account --</option>
                            ${state.accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance)})</option>`).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="t-desc" placeholder="Optional note">
                    </div>

                    <div class="form-group">
                        <label>Notes (Private)</label>
                        <textarea id="t-notes" rows="2" placeholder="Add extra details..." style="width: 100%; padding: 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary);"></textarea>
                    </div>

                    <button type="submit" class="btn btn-primary btn-block" id="t-submit-btn">Save Transaction</button>
                </form>
            </div>
        </div>
        
        <!-- Smart Import Modal -->
        <div id="smart-import-modal" class="modal" style="z-index: 2100;">
            <div class="modal-content">
                <span class="close-modal" onclick="document.getElementById('smart-import-modal').style.display='none'">&times;</span>
                <h2><i class="fa-solid fa-robot"></i> Smart Import</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">
                    Paste a transaction text (SMS/Email) or upload a receipt image.
                </p>
                
                <div class="form-group">
                    <label>Paste Text</label>
                    <textarea id="ai-text-input" rows="3" placeholder="e.g., Spent $25.50 at Starbucks for coffee today" style="width: 100%; padding: 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary);"></textarea>
                </div>
                
                <div class="form-group" style="text-align: center; margin: 1.5rem 0;">
                    <span style="color: var(--text-secondary); font-size: 0.9rem;">- OR -</span>
                </div>

                <div class="form-group">
                    <label>Upload Receipt Image</label>
                    <input type="file" id="ai-image-input" accept="image/*" style="width: 100%;">
                </div>

                <button type="button" class="btn btn-primary btn-block" onclick="processSmartImport()">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze with Gemini
                </button>
            </div>
        </div>

        <!-- CSV Import Modal -->
        <div id="csv-import-modal" class="modal">
            <div class="modal-content">
                <span class="close-modal" onclick="document.getElementById('csv-import-modal').style.display='none'">&times;</span>
                <h2><i class="fa-solid fa-file-csv"></i> Import CSV (Bulk)</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">
                    Upload a bank statement file to add many transactions at once.
                </p>
                
                <div class="form-group">
                    <label>Select Account (Optional)</label>
                    <select id="csv-account-select" style="margin-bottom: 1rem;">
                        <option value="">-- Don't link to account --</option>
                        ${state.accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance)})</option>`).join('')}
                    </select>
                </div>

                <input type="file" id="csv-file-input" accept=".csv" style="margin-bottom: 1rem; width: 100%;">
                
                <div id="import-log" style="
                    background: #0f172a; 
                    padding: 1rem; 
                    border-radius: 6px; 
                    font-family: monospace; 
                    font-size: 0.8rem; 
                    height: 150px; 
                    overflow-y: auto; 
                    margin-bottom: 1rem;
                    border: 1px solid var(--border-color);
                ">Waiting for file...</div>
                
                <button class="btn btn-primary btn-block" onclick="processCSVImport()">Start Bulk Import</button>
            </div>
        </div>
    `;

    setupTransactionModal();
}

function renderTransactionList(transactions) {
    if (transactions.length === 0) {
        return '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No transactions found.</p>';
    }

    return `
        <table class="transaction-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style="text-align: right;">Amount</th>
                    <th style="text-align: center;">Action</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(t => {
        const category = t.category || 'Uncategorized';
        const color = getCategoryColor(category);

        let amountStyle = '';
        let amountPrefix = '';

        if (t.type === 'income') {
            amountStyle = 'color: var(--success)';
            amountPrefix = '+';
        } else if (t.type === 'expense') {
            amountStyle = 'color: var(--danger)';
            amountPrefix = '-';
        } else if (t.type === 'transfer') {
            amountStyle = 'color: var(--text-secondary)'; // Neutral color for transfers
            amountPrefix = '⇄ ';
        }

        return `
                    <tr>
                        <td>${new Date(t.date).toLocaleDateString()}</td>
                        <td>
                            <span class="badge" style="background-color: ${color}20; color: ${color}; border: 1px solid ${color}40;">
                                ${category}
                            </span>
                        </td>
                        <td>
                            ${t.description || '-'}
                            ${t.notes ? `<br><small style="color: var(--text-secondary);"><i class="fa-solid fa-note-sticky"></i> ${t.notes}</small>` : ''}
                        </td>
                        <td style="text-align: right; ${amountStyle}">
                            ${amountPrefix}${formatCurrency(t.amount)}
                        </td>
                        <td style="text-align: center;">
                            <button class="btn-icon" onclick="editTransaction(${t.id})" style="color: var(--accent-primary); margin-right: 0.5rem;">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-icon delete-btn" onclick="deleteTransaction(${t.id})">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

window.editTransaction = (id) => {
    const t = state.transactions.find(tr => tr.id === id);
    if (!t) return;

    document.getElementById('t-id').value = t.id;
    document.getElementById('t-type').value = t.type;
    document.getElementById('t-amount').value = t.amount;
    document.getElementById('t-category').value = t.category || '';

    // Fix Date Format (YYYY-MM-DD)
    const dateStr = t.date.split('T')[0];
    document.getElementById('t-date').value = dateStr;

    document.getElementById('t-desc').value = t.description || '';
    document.getElementById('t-notes').value = t.notes || '';
    document.getElementById('t-account').value = t.account_id || '';

    document.getElementById('t-submit-btn').textContent = 'Update Transaction';
    document.getElementById('transaction-modal').style.display = 'flex';
};

// Global CSV Import Logic
window.processCSVImport = async () => {
    const fileInput = document.getElementById('csv-file-input');
    const accountSelect = document.getElementById('csv-account-select');
    const logDiv = document.getElementById('import-log');
    const file = fileInput.files[0];
    const accountId = accountSelect.value;

    if (!file) {
        alert('Please select a CSV file.');
        return;
    }

    logDiv.innerHTML = 'Reading file...<br>';

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const newTransactions = [];
        let skippedCount = 0;
        let importedCount = 0;
        let netAmount = 0; // For updating account balance
        let latestDate = null;
        let latestBalance = null;

        logDiv.innerHTML += `Found ${lines.length} lines. Processing...<br>`;

        // Detect Format based on Header
        const headerLine = lines[0].toLowerCase();
        const isBankFormat = headerLine.includes('post date') && (headerLine.includes('debit') || headerLine.includes('credit'));

        if (isBankFormat) {
            logDiv.innerHTML += 'Detected Bank Export Format.<br>';
        } else {
            logDiv.innerHTML += 'Using Standard Format (Date, Description, Amount...).<br>';
        }

        for (let i = 1; i < lines.length; i++) { // Skip header
            const line = lines[i].trim();
            if (!line) continue;

            // Handle quotes and commas better
            const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            const cleanParts = parts.map(p => p.replace(/^"|"$/g, '').trim());

            let date, description, amount, type, category;
            let currentBalance = null;

            if (isBankFormat) {
                // Bank Format
                const robustParts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

                date = robustParts[1]; // Post Date
                description = robustParts[3]; // Description
                const debit = parseFloat(robustParts[4]) || 0;
                const credit = parseFloat(robustParts[5]) || 0;

                // Try to get balance from column 7 (index 7)
                if (robustParts.length > 7) {
                    currentBalance = parseFloat(robustParts[7]);
                }

                if (debit > 0) {
                    amount = debit;
                    type = 'expense';
                } else if (credit > 0) {
                    amount = credit;
                    type = 'income';
                } else {
                    continue; // No amount
                }
                category = 'Uncategorized';

            } else {
                // Standard Format
                const robustParts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                if (robustParts.length < 3) continue;

                date = robustParts[0];
                description = robustParts[1];
                amount = parseFloat(robustParts[2]);
                category = robustParts[3] || 'Uncategorized';
                type = (robustParts[4] || 'expense').toLowerCase().includes('income') ? 'income' : 'expense';
            }

            // Validate
            if (!date || isNaN(amount)) {
                continue;
            }

            // Normalize Date
            let dateObj;
            try {
                dateObj = new Date(date);
                if (!isNaN(dateObj.getTime())) {
                    date = dateObj.toISOString().split('T')[0];
                } else {
                    continue;
                }
            } catch (e) {
                console.warn('Date parse error', date);
                continue;
            }

            // Track latest balance
            if (currentBalance !== null && !isNaN(currentBalance)) {
                if (!latestDate || dateObj > latestDate) {
                    latestDate = dateObj;
                    latestBalance = currentBalance;
                }
            }

            // Duplicate Check
            const cleanDesc = description.replace(/"/g, '').trim().toLowerCase();
            const isDuplicate = state.transactions.some(t => {
                const tDate = t.date; // already YYYY-MM-DD from Supabase
                const tDesc = (t.description || '').trim().toLowerCase();
                const tAmount = parseFloat(t.amount);

                return tDate === date &&
                    Math.abs(tAmount - amount) < 0.01 &&
                    tDesc === cleanDesc;
            });

            if (isDuplicate) {
                skippedCount++;
            } else {
                const transaction = {
                    user_id: state.user.id,
                    date,
                    description: description.replace(/"/g, '').trim(),
                    amount,
                    category: category.replace(/"/g, '').trim(),
                    type
                };

                // Link Account if selected
                if (accountId) {
                    transaction.account_id = accountId;
                    // Calculate net change
                    if (type === 'income') netAmount += amount;
                    else netAmount -= amount;
                }

                newTransactions.push(transaction);
                importedCount++;
            }
        }

        if (newTransactions.length > 0) {
            logDiv.innerHTML += `Saving ${newTransactions.length} new transactions...<br>`;

            const { error } = await window.supabaseClient
                .from('transactions')
                .insert(newTransactions);

            if (error) {
                console.error(error);
                logDiv.innerHTML += `<span style="color: var(--danger)">Error: ${error.message}</span>`;
            } else {
                // Update Account Balance if linked
                if (accountId) {
                    let newBalance;
                    let updateMethod = '';

                    if (latestBalance !== null) {
                        // Use absolute balance from CSV
                        newBalance = latestBalance;
                        updateMethod = 'Using CSV Balance';
                    } else if (netAmount !== 0) {
                        // Use net calculation
                        const account = state.accounts.find(a => a.id == accountId);
                        if (account) {
                            newBalance = (account.balance || 0) + netAmount;
                            updateMethod = 'Using Net Calculation';
                        }
                    }

                    if (newBalance !== undefined) {
                        logDiv.innerHTML += `Updating account balance (${updateMethod})...<br>`;
                        const { error: accError } = await window.supabaseClient
                            .from('accounts')
                            .update({ balance: newBalance })
                            .eq('id', accountId);

                        if (accError) {
                            console.error('Balance update error:', accError);
                            logDiv.innerHTML += `<span style="color: var(--warning)">Warning: Failed to update account balance.</span>`;
                        } else {
                            logDiv.innerHTML += `<span style="color: var(--success)">Account balance updated to ${formatCurrency(newBalance)}!</span>`;
                        }
                    }
                }

                logDiv.innerHTML += `<span style="color: var(--success)">Success! Imported ${importedCount}. Skipped ${skippedCount}.</span>`;
                loadData();
                setTimeout(() => {
                    document.getElementById('csv-import-modal').style.display = 'none';
                    alert(`Import Complete!\nAdded: ${importedCount}\nSkipped (Duplicates): ${skippedCount}`);
                }, 1000);
            }
        } else {
            logDiv.innerHTML += `No new transactions found. Skipped ${skippedCount} duplicates.`;
        }
    };
    reader.readAsText(file);
};

// Global Transaction Handler
window.handleTransactionSubmit = async (e) => {
    e.preventDefault();
    console.log('Global transaction submit triggered');

    const submitBtn = document.getElementById('t-submit-btn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const id = document.getElementById('t-id').value; // Hidden ID
    const type = document.getElementById('t-type').value;
    const amount = parseFloat(document.getElementById('t-amount').value);
    const category = document.getElementById('t-category').value;
    const date = document.getElementById('t-date').value;
    const description = document.getElementById('t-desc').value;
    const notes = document.getElementById('t-notes').value;
    const accountId = document.getElementById('t-account').value;

    console.log('Submitting:', { id, type, amount, category, date, description, notes, accountId });

    try {
        let error;

        if (id) {
            // UPDATE existing transaction
            // Note: Handling balance updates on edit is complex (reverting old, applying new). 
            // For MVP, we'll just update the transaction details. 
            // Ideally, we should recalculate balance if amount/account changed.

            const { error: updateError } = await window.supabaseClient
                .from('transactions')
                .update({
                    type,
                    amount,
                    category,
                    date,
                    description,
                    notes,
                    account_id: accountId || null
                })
                .eq('id', id);
            error = updateError;
            alert('Transaction updated!');
        } else {
            // INSERT new transaction
            const { error: insertError } = await window.supabaseClient
                .from('transactions')
                .insert([{
                    user_id: state.user.id,
                    type,
                    amount,
                    category,
                    date,
                    description,
                    notes,
                    account_id: accountId || null
                }]);
            error = insertError;

            // Update Account Balance (Only for new transactions for simplicity)
            if (!error && accountId) {
                const account = state.accounts.find(a => a.id == accountId);
                if (account) {
                    let newBalance = account.balance || 0;
                    if (type === 'income') newBalance += amount;
                    else newBalance -= amount; // Expense or Transfer Out

                    await window.supabaseClient
                        .from('accounts')
                        .update({ balance: newBalance })
                        .eq('id', accountId);
                }
            }
            alert('Transaction added successfully!');
        }

        if (error) throw error;

        document.getElementById('transaction-modal').style.display = 'none';
        document.getElementById('add-transaction-form').reset();
        document.getElementById('t-id').value = ''; // Clear ID
        loadData();

    } catch (err) {
        console.error('Transaction Error:', err);
        alert('Error saving transaction: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
};



function setupTransactionModal() {
    // No longer needed with global handler
}

// Global Delete Function
window.deleteTransaction = async (id) => {
    if (!confirm('Are you sure?')) return;

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        loadData();
    } catch (err) {
        alert('Error deleting: ' + err.message);
    }
};

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function renderAccounts() {
    app.contentArea.innerHTML = `
    <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>My Accounts</h3>
                <button class="btn btn-primary btn-sm" onclick="document.getElementById('account-modal').style.display='flex'">
                    <i class="fa-solid fa-plus"></i> Add Account
                </button>
            </div>
            
            <div class="accounts-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
                ${(state.accounts || []).length === 0 ? '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center;">No accounts linked.</p>' : ''}
                ${(state.accounts || []).map(a => `
                    <div style="background: linear-gradient(135deg, ${a.color || '#1e293b'} 0%, rgba(0,0,0,0.2) 100%); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); position: relative; overflow: hidden;">
                        <div style="position: relative; z-index: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                <div>
                                    <h4 style="font-size: 1.1rem; margin-bottom: 0.2rem;">${a.name}</h4>
                                    <span style="font-size: 0.8rem; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">${a.type}</span>
                                </div>
                                <i class="fa-solid fa-wallet" style="font-size: 1.5rem; opacity: 0.5;"></i>
                            </div>
                            <div style="font-size: 1.8rem; font-weight: 700; margin-bottom: 1rem;">
                                ${formatCurrency(a.balance)}
                            </div>
                            <div style="text-align: right;">
                                <button class="btn-icon" onclick="deleteAccount(${a.id})" style="color: rgba(255,255,255,0.7);"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Add Account Modal -->
        <div id="account-modal" class="modal">
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h2>Add Account</h2>
                <form id="add-account-form">
                    <div class="form-group">
                        <label>Account Name</label>
                        <input type="text" id="a-name" required placeholder="e.g., Chase Checking">
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="a-type" required>
                            <option value="Bank">Bank</option>
                            <option value="Cash">Cash</option>
                            <option value="Credit">Credit Card</option>
                            <option value="Investment">Investment</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Current Balance</label>
                        <input type="number" id="a-balance" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <input type="color" id="a-color" value="#6366f1" style="height: 40px; padding: 0.2rem;">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Save Account</button>
                </form>
            </div>
        </div>
    `;

    setupAccountModal();
}

function setupAccountModal() {
    const form = document.getElementById('add-account-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('a-name').value;
            const type = document.getElementById('a-type').value;
            const balance = parseFloat(document.getElementById('a-balance').value);
            const color = document.getElementById('a-color').value;

            try {
                const { error } = await window.supabaseClient
                    .from('accounts')
                    .insert([{
                        user_id: state.user.id,
                        name,
                        type,
                        balance,
                        color
                    }]);

                if (error) throw error;

                alert('Account added!');
                document.getElementById('account-modal').style.display = 'none';
                loadData();
            } catch (err) {
                console.error(err);
                alert('Error adding account: ' + err.message);
            }
        });
    }
}

window.deleteAccount = async (id) => {
    if (!confirm('Delete this account?')) return;
    try {
        const { error } = await window.supabaseClient.from('accounts').delete().eq('id', id);
        if (error) throw error;
        loadData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

function renderBudgets() {
    app.contentArea.innerHTML = `
    < div class="card" >
        <p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Budgets Feature Coming Soon...</p>
        </div >
    `;
}

function renderGoals() {
    app.contentArea.innerHTML = `
    <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>Savings Goals</h3>
                <button class="btn btn-primary btn-sm" onclick="document.getElementById('goal-modal').style.display='flex'">
                    <i class="fa-solid fa-plus"></i> New Goal
                </button>
            </div>
            
            <div class="goals-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem;">
                ${state.goals.length === 0 ? '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center;">No goals set yet.</p>' : ''}
                ${state.goals.map(g => {
        const percentage = Math.min((g.current_amount / g.target_amount) * 100, 100);
        return `
                    <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                            <h4 style="font-size: 1.1rem;">${g.name}</h4>
                            <i class="fa-solid fa-trophy" style="color: var(--warning);"></i>
                        </div>
                        <div style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-secondary);">
                            <span>${formatCurrency(g.current_amount)}</span>
                            <span>Target: ${formatCurrency(g.target_amount)}</span>
                        </div>
                        <div class="progress-bar" style="background: rgba(255,255,255,0.1); height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 1rem;">
                            <div style="width: ${percentage}%; background-color: var(--accent-primary); height: 100%; transition: width 0.5s ease;"></div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-block" onclick="contributeToGoal(${g.id})" style="background: rgba(255,255,255,0.1);">+ Add Funds</button>
                            <button class="btn-icon" onclick="deleteGoal(${g.id})" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    `;
    }).join('')}
            </div>
        </div>

        <!-- Add Goal Modal -->
    <div id="goal-modal" class="modal">
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h2>New Savings Goal</h2>
            <form id="add-goal-form">
                <div class="form-group">
                    <label>Goal Name</label>
                    <input type="text" id="g-name" required placeholder="e.g., New Laptop">
                </div>
                <div class="form-group">
                    <label>Target Amount</label>
                    <input type="number" id="g-target" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Target Date</label>
                    <input type="date" id="g-date" required>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Create Goal</button>
            </form>
        </div>
    </div>
`;

    setupGoalModal();
}

function setupGoalModal() {
    const form = document.getElementById('add-goal-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('g-name').value;
            const target_amount = parseFloat(document.getElementById('g-target').value);
            const deadline = document.getElementById('g-date').value;

            try {
                const { error } = await window.supabaseClient
                    .from('goals')
                    .insert([{
                        user_id: state.user.id,
                        name,
                        target_amount,
                        current_amount: 0,
                        deadline
                    }]);

                if (error) throw error;

                alert('Goal created!');
                document.getElementById('goal-modal').style.display = 'none';
                loadData();
            } catch (err) {
                console.error(err);
                alert('Error creating goal: ' + err.message);
            }
        });
    }
}

window.deleteGoal = async (id) => {
    if (!confirm('Delete this goal?')) return;
    try {
        const { error } = await window.supabaseClient.from('goals').delete().eq('id', id);
        if (error) throw error;
        loadData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.exportToCSV = () => {
    if (state.transactions.length === 0) {
        alert('No transactions to export.');
        return;
    }

    const headers = ['Date', 'Type', 'Category', 'Amount', 'Description'];
    const rows = state.transactions.map(t => [
        new Date(t.date).toLocaleDateString(),
        t.type,
        t.category || 'Uncategorized',
        t.amount,
        `"${(t.description || '').replace(/"/g, '""')}"` // Escape quotes
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'finance_tracker_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.contributeToGoal = async (id) => {
    const amount = parseFloat(prompt('Enter amount to add:'));
    if (isNaN(amount) || amount <= 0) return;

    try {
        const goal = state.goals.find(g => g.id === id);
        const newAmount = (goal.current_amount || 0) + amount;

        const { error } = await window.supabaseClient
            .from('goals')
            .update({ current_amount: newAmount })
            .eq('id', id);

        if (error) throw error;
        loadData();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

// --- Smart Import Feature ---

window.processSmartImport = async () => {
    const openAIKey = localStorage.getItem('openai_api_key');
    if (!openAIKey) {
        alert('Please save your OpenAI API Key first in Settings.');
        return;
    }

    const textInput = document.getElementById('ai-text-input').value;
    const imageInput = document.getElementById('ai-image-input').files[0];

    if (!textInput && !imageInput) {
        alert('Please provide text or an image.');
        return;
    }

    const btn = document.querySelector('button[onclick="processSmartImport()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';

    try {
        let userContent = [];

        if (textInput) {
            userContent.push({ type: "text", text: textInput });
        }

        if (imageInput) {
            const base64Image = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageInput);
            });
            userContent.push({
                type: "image_url",
                image_url: {
                    url: base64Image
                }
            });
        }

        const systemPrompt = `Extract transaction details from the user input (text or receipt image).
        Return a JSON object with:
        - "date": YYYY-MM-DD
        - "amount": number
        - "description": string
        - "category": string (guess from context)
        - "type": "expense" or "income" or "transfer"
        
        If details are missing, make a best guess or leave empty.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAIKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'OpenAI API Error');
        }

        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);

        // Populate Form
        if (result.type) document.getElementById('t-type').value = result.type;
        if (result.amount) document.getElementById('t-amount').value = result.amount;
        if (result.category) document.getElementById('t-category').value = result.category;
        if (result.date) document.getElementById('t-date').value = result.date;
        if (result.description) document.getElementById('t-desc').value = result.description;

        alert('Smart Import Successful! Please review the details.');
        document.getElementById('smart-import-modal').style.display = 'none';

    } catch (error) {
        console.error('Smart Import Error:', error);
        alert('Analysis failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// --- Category Management ---

window.handleCategorySubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value;
    const type = document.getElementById('cat-type').value;
    const color = document.getElementById('cat-color').value;

    try {
        const { error } = await window.supabaseClient
            .from('categories')
            .insert([{
                user_id: state.user.id,
                name,
                type,
                color_code: color
            }]);

        if (error) throw error;

        alert('Category added!');
        document.getElementById('category-modal').style.display = 'none';
        loadData(); // Refresh UI
    } catch (err) {
        console.error('Category Error:', err);
        alert('Error adding category: ' + err.message);
    }
    return false;
};

window.deleteCategory = async (id) => {
    if (!confirm('Delete this category?')) return;
    try {
        const { error } = await window.supabaseClient
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
        loadData();
    } catch (err) {
        alert('Error deleting category: ' + err.message);
    }
};

// --- AI Audit Feature ---

// --- AI Audit Feature ---

// --- AI Audit Feature ---

async function startAIAudit() {
    const openAIKey = localStorage.getItem('openai_api_key');
    if (!openAIKey) {
        alert('Please save your OpenAI API Key first in Settings.');
        return;
    }

    // 1. Get Configured Limit
    const limitSelect = document.getElementById('audit-limit');
    const limitValue = limitSelect ? limitSelect.value : '50';

    let transactionsToAnalyze = [];
    if (limitValue === 'all') {
        transactionsToAnalyze = state.transactions;
    } else {
        transactionsToAnalyze = state.transactions.slice(0, parseInt(limitValue));
    }

    if (transactionsToAnalyze.length === 0) {
        alert('No transactions to analyze.');
        return;
    }

    const btn = document.querySelector('button[onclick="startAIAudit()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;

    // Create Account Map
    const accountMap = {};
    state.accounts.forEach(a => accountMap[a.id] = a.name);

    const BATCH_SIZE = 25;
    const batches = [];
    for (let i = 0; i < transactionsToAnalyze.length; i += BATCH_SIZE) {
        batches.push(transactionsToAnalyze.slice(i, i + BATCH_SIZE));
    }

    let allUpdates = [];

    try {
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing batch ${i + 1} of ${batches.length}...`;

            // Prepare Prompt for this batch
            const transactionList = batch.map(t => ({
                id: t.id,
                date: t.date,
                description: t.description,
                amount: t.amount,
                category: t.category,
                type: t.type,
                account_name: accountMap[t.account_id] || 'Unknown Account'
            }));

            const systemPrompt = `You are a financial auditor. Analyze the provided list of transactions.
            
            YOUR PRIMARY GOAL: Identify "Transfers" that are currently mislabeled as 'income' or 'expense'.
            A Transfer is typically characterized by:
            1. Two transactions with the EXACT SAME amount (or very close).
            2. One is an 'expense' (money leaving Account A) and one is 'income' (money entering Account B).
            3. They occur on the same date or within 1-2 days of each other.
            4. Descriptions often mention "Transfer", "Payment", "Credit Card", or the other account's name.

            If you find such a pair, mark BOTH as "transfer".

            YOUR SECONDARY GOAL: Suggest better categories for 'Uncategorized' or generic items.

            Return a JSON object with a key "updates" containing a list of objects. Each object must have:
            - "id": The transaction ID
            - "new_type": "transfer" (only if it's a transfer)
            - "new_category": Suggested category (optional)
            - "reason": Brief explanation (e.g., "Matches transaction ID 123 with same amount")
            
            Only include transactions that need changes.`;

            // Call OpenAI API
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openAIKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: JSON.stringify(transactionList) }
                    ],
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'OpenAI API Error');
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            const batchUpdates = JSON.parse(content).updates || [];
            allUpdates = allUpdates.concat(batchUpdates);

            // Small delay to be nice to the API
            if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (allUpdates.length === 0) {
            alert('AI Analysis complete. No changes suggested.');
        } else {
            showAuditResults(allUpdates);
        }

    } catch (error) {
        console.error('AI Audit Error:', error);
        alert('AI Analysis failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function showAuditResults(updates) {
    // Create Modal HTML dynamically
    const modalId = 'audit-modal';
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const updatesHtml = updates.map((u, index) => {
        const t = state.transactions.find(tx => tx.id === u.id);
        if (!t) return '';
        return `
            <div class="audit-item" style="background: rgba(255,255,255,0.05); padding: 1rem; margin-bottom: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <strong>${t.description}</strong>
                    <span style="color: var(--text-secondary); font-size: 0.8rem;">${t.date}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem; align-items: center; font-size: 0.9rem;">
                    <div style="color: var(--danger);">
                        ${t.type.toUpperCase()} / ${t.category}
                    </div>
                    <i class="fa-solid fa-arrow-right" style="color: var(--text-secondary);"></i>
                    <div style="color: var(--success);">
                        ${(u.new_type || t.type).toUpperCase()} / ${u.new_category || t.category}
                    </div>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--accent-primary);">
                    <i class="fa-solid fa-robot"></i> ${u.reason}
                </div>
                <div style="margin-top: 0.5rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="checkbox" class="audit-check" data-index="${index}" checked>
                        Approve Change
                    </label>
                </div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close-modal" onclick="document.getElementById('${modalId}').style.display='none'">&times;</span>
            <h2><i class="fa-solid fa-wand-magic-sparkles"></i> AI Suggested Changes</h2>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Review the suggestions below. Uncheck any you want to discard.
            </p>
            
            <div style="max-height: 400px; overflow-y: auto; margin-bottom: 1rem;">
                ${updatesHtml}
            </div>

            <button class="btn btn-primary btn-block" onclick="applyAuditChanges()">
                Apply Selected Changes
            </button>
        </div>
    `;

    // Store updates for apply function
    window.currentAuditUpdates = updates;
    modal.style.display = 'flex';
}

window.applyAuditChanges = async () => {
    const checks = document.querySelectorAll('.audit-check:checked');
    const selectedIndices = Array.from(checks).map(c => parseInt(c.dataset.index));
    const updatesToApply = window.currentAuditUpdates.filter((_, i) => selectedIndices.includes(i));

    if (updatesToApply.length === 0) {
        document.getElementById('audit-modal').style.display = 'none';
        return;
    }

    const btn = document.querySelector('#audit-modal button.btn-primary');
    btn.disabled = true;
    btn.textContent = 'Applying Changes...';

    try {
        for (const update of updatesToApply) {
            const patch = {};
            if (update.new_type) patch.type = update.new_type;
            if (update.new_category) patch.category = update.new_category;

            await window.supabaseClient
                .from('transactions')
                .update(patch)
                .eq('id', update.id);
        }

        alert(`Successfully updated ${updatesToApply.length} transactions.`);
        document.getElementById('audit-modal').style.display = 'none';
        loadData(); // Refresh UI

    } catch (error) {
        console.error('Apply Audit Error:', error);
        alert('Failed to apply changes: ' + error.message);
    }
};
