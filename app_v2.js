// Main Application Logic & Routing

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Check for Supabase
    if (!window.supabaseClient) {
        console.error('Supabase client not initialized. Check config.js');
        return;
    }

    // Auth State Listener
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            window.state.user = session.user;
            window.loadData();
            window.navigateTo('dashboard');
            const emailEl = document.getElementById('user-email');
            if (emailEl) emailEl.textContent = session.user.email;
        } else {
            window.state.user = null;
            window.navigateTo('login');
        }
    });

    // Initial Route
    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (!session) {
        window.navigateTo('login');
    } else {
        window.state.user = session.user;
        window.loadData();
        // Stay on current view if possible, else dashboard
        // For simplicity, we default to dashboard on reload for now
        window.navigateTo('dashboard');
    }

    // Attach Auth Event Listener
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            if (e) e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) throw error;

                // State will be updated by onAuthStateChange listener
                // window.navigateTo('dashboard'); // Let the listener handle it
            } catch (error) {
                console.error('Login error:', error);
                alert('Error logging in: ' + error.message);
            }
        });
    }
    // Attach Navigation Listeners
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            window.navigateTo(page);
        });
    });
});

// Navigation Logic
window.navigateTo = (viewId) => {
    // Special case for Login
    const authOverlay = document.getElementById('auth-overlay');
    if (!authOverlay) {
        console.error('CRITICAL: #auth-overlay not found in DOM');
        return;
    }

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

    // Render specific view content
    if (viewId === 'dashboard') window.renderDashboard();
    if (viewId === 'transactions') window.renderTransactions();
    if (viewId === 'analytics') window.renderAnalytics();
    if (viewId === 'settings') window.renderSettings();
    if (viewId === 'accounts') window.renderAccounts();
};

// Data Loading
window.loadData = async () => {
    if (!window.state.user) return;

    // 1. Fetch Categories
    try {
        const { data: categories, error: catError } = await window.supabaseClient
            .from('categories')
            .select('*')
            .eq('user_id', window.state.user.id);

        if (catError) console.error('Error fetching categories:', catError);
        window.state.categories = categories || [];
    } catch (e) { console.error('Exception fetching categories:', e); }

    // 2. Fetch Accounts
    try {
        const { data: accounts, error: accError } = await window.supabaseClient
            .from('accounts')
            .select('*')
            .eq('user_id', window.state.user.id);

        if (accError) console.error('Error fetching accounts:', accError);
        window.state.accounts = accounts || [];
    } catch (e) { console.error('Exception fetching accounts:', e); }

    // 3. Fetch Transactions
    try {
        const { data: transactions, error: txError } = await window.supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', window.state.user.id)
            .order('date', { ascending: false });

        if (txError) console.error('Error fetching transactions:', txError);
        window.state.transactions = transactions || [];
    } catch (e) { console.error('Exception fetching transactions:', e); }

    // 4. Fetch Goals
    try {
        const { data: goals, error: goalsError } = await window.supabaseClient
            .from('goals')
            .select('*')
            .eq('user_id', window.state.user.id);

        if (goalsError) console.error('Error fetching goals:', goalsError);
        window.state.goals = goals || [];
    } catch (e) { console.error('Exception fetching goals:', e); }

    console.log('Data loaded:', window.state);

    // Re-render current view to show data
    const currentView = document.querySelector('.nav-item.active')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || 'dashboard';
    window.navigateTo(currentView);

};

// --- View Renderers ---

window.renderDashboard = () => {
    const totalBalance = window.state.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    // Calculate Monthly Stats
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyTransactions = window.state.transactions.filter(t => {
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
    const allIncome = window.state.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const allExpense = window.state.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    // Determine if we should show Monthly or All Time for the chart
    const hasMonthlyData = monthlyTransactions.some(t => t.type === 'income' || t.type === 'expense');
    const showAllTime = !hasMonthlyData && window.state.transactions.some(t => t.type === 'income' || t.type === 'expense');

    const chartTransactions = showAllTime ? window.state.transactions : monthlyTransactions;
    const chartTitle = showAllTime ? 'Spending Overview (All Time)' : 'Spending Overview (This Month)';

    // Update DOM
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="dashboard-grid">
            <div class="card balance">
                <h3>Net Worth</h3>
                <div class="amount" style="color: var(--accent-primary);">${window.formatCurrency(totalBalance)}</div>
            </div>
            <div class="card income">
                <h3>Income <small>(${showAllTime ? 'All Time' : 'This Month'})</small></h3>
                <div class="amount">${window.formatCurrency(showAllTime ? allIncome : monthlyIncome)}</div>
            </div>
            <div class="card expense">
                <h3>Expenses <small>(${showAllTime ? 'All Time' : 'This Month'})</small></h3>
                <div class="amount">${window.formatCurrency(showAllTime ? allExpense : monthlyExpense)}</div>
            </div>
        </div>

        <div class="dashboard-grid" style="grid-template-columns: 2fr 1fr;">
            <div class="card">
                <h3>${chartTitle}</h3>
                <canvas id="spendingChart"></canvas>
            </div>
            <div class="card">
                <h3>Recent Activity</h3>
                ${window.renderTransactionList(window.state.transactions.slice(0, 5))}
                <button class="btn btn-sm btn-block" style="margin-top: 1rem;" onclick="navigateTo('transactions')">View All</button>
            </div>
        </div>
    `;

    window.renderSpendingChart(chartTransactions);
};

window.renderTransactions = () => {
    const categories = [...new Set(window.state.categories.map(c => c.name))];
    const contentArea = document.getElementById('content-area');

    contentArea.innerHTML = `
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

            <!-- Filter Bar -->
            <div class="filter-bar" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                
                <!-- Search -->
                <div style="grid-column: span 2;">
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Search</label>
                    <div style="position: relative;">
                        <i class="fa-solid fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary);"></i>
                        <input type="text" id="filter-search" placeholder="Search descriptions..." oninput="filterTransactions()" 
                            style="width: 100%; padding: 0.5rem 0.5rem 0.5rem 2rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                    </div>
                </div>

                <!-- Type -->
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Type</label>
                    <select id="filter-type" onchange="filterTransactions()" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                        <option value="all">All Types</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                        <option value="transfer">Transfer</option>
                    </select>
                </div>

                <!-- Category -->
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Category</label>
                    <select id="filter-category" onchange="filterTransactions()" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                        <option value="all">All Categories</option>
                        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>

                <!-- Account -->
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Account</label>
                    <select id="filter-account" onchange="filterTransactions()" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                        <option value="all">All Accounts</option>
                        ${window.state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                    </select>
                </div>

                <!-- Date Range -->
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">From</label>
                    <input type="date" id="filter-date-from" onchange="filterTransactions()" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                </div>
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">To</label>
                    <input type="date" id="filter-date-to" onchange="filterTransactions()" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                </div>
            </div>

            <div id="transaction-list-container">
                ${window.renderTransactionList(window.state.transactions)}
            </div>
        </div>
        
        <!-- Add Transaction Modal -->
        <div id="transaction-modal" class="modal">
            <div class="modal-content">
                <span class="close-modal" onclick="document.getElementById('transaction-modal').style.display='none'">&times;</span>
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
                            ${(window.state.categories || []).map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
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
                            ${window.state.accounts.map(a => `<option value="${a.id}">${a.name} (${window.formatCurrency(a.balance)})</option>`).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <label style="margin-bottom: 0;">Description</label>
                            <button type="button" id="auto-fill-btn" onclick="autoFillTransaction()" style="font-size: 0.8rem; color: var(--accent-primary); background: none; border: none; cursor: pointer;">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> AI Auto-Fill
                            </button>
                        </div>
                        <input type="text" id="t-desc" placeholder="e.g., Uber Ride">
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
                
                <button class="btn btn-primary btn-block" onclick="processSmartImport()">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Analyze & Fill
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
                        ${window.state.accounts.map(a => `<option value="${a.id}">${a.name} (${window.formatCurrency(a.balance)})</option>`).join('')}
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
                
                <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="csv-ai-analyze">
                    <label for="csv-ai-analyze" style="cursor: pointer; color: var(--text-primary); font-size: 0.9rem;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent-primary);"></i> Analyze with AI (Categorize & Note)
                    </label>
                </div>
                
                <button class="btn btn-primary btn-block" onclick="processCSVImport()">Start Bulk Import</button>
            </div>
        </div>
    `;

    // Setup Modals (if needed, but onclicks handle most)
};

window.renderTransactionList = (transactions) => {
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
        const color = window.getCategoryColor(category);

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
                            ${amountPrefix}${window.formatCurrency(t.amount)}
                        </td>
                        <td style="text-align: center;">
                            <button class="btn-icon" onclick="editTransaction('${t.id}')" title="Edit">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-icon delete" onclick="deleteTransaction('${t.id}')" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
    }).join('')}
            </tbody>
        </table>
    `;
};

window.renderAnalytics = () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="dashboard-grid">
            <div class="card">
                <h3>Spending by Category</h3>
                <canvas id="analyticsCategoryChart"></canvas>
            </div>
            <div class="card">
                <h3>Monthly Trend</h3>
                <canvas id="analyticsTrendChart"></canvas>
            </div>
        </div>
        <div class="card" style="margin-top: 1.5rem;">
            <h3>Daily Spending (This Month)</h3>
            <canvas id="analyticsDailyChart" style="max-height: 300px;"></canvas>
        </div>
    `;

    window.renderAnalyticsCategoryChart(window.state.transactions);
    window.renderAnalyticsTrendChart(window.state.transactions);
    window.renderAnalyticsDailyChart(window.state.transactions);
};

window.renderAccounts = () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>Accounts</h3>
                <button class="btn btn-primary btn-sm" onclick="document.getElementById('account-modal').style.display='flex'">
                    <i class="fa-solid fa-plus"></i> Add Account
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
                ${window.state.accounts.map(a => `
                    <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <h4 style="margin: 0; color: var(--text-primary);">${a.name}</h4>
                                <small style="color: var(--text-secondary); text-transform: capitalize;">${a.type}</small>
                            </div>
                            <button class="btn-icon delete" onclick="deleteAccount('${a.id}')">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                        <div style="margin-top: 1rem; font-size: 1.5rem; font-weight: 600; color: var(--accent-primary);">
                            ${window.formatCurrency(a.balance)}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Add Account Modal -->
        <div id="account-modal" class="modal">
            <div class="modal-content">
                <span class="close-modal" onclick="document.getElementById('account-modal').style.display='none'">&times;</span>
                <h2>Add Account</h2>
                <form id="add-account-form" onsubmit="return handleAccountSubmit(event)">
                    <div class="form-group">
                        <label>Account Name</label>
                        <input type="text" id="acc-name" required placeholder="e.g., Chase Checking">
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="acc-type">
                            <option value="checking">Checking</option>
                            <option value="savings">Savings</option>
                            <option value="credit">Credit Card</option>
                            <option value="investment">Investment</option>
                            <option value="cash">Cash</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Current Balance</label>
                        <input type="number" id="acc-balance" step="0.01" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Save Account</button>
                </form>
            </div>
        </div>
    `;
};

window.handleAccountSubmit = async (e) => {
    e.preventDefault();
    const name = window.sanitizeInput(document.getElementById('acc-name').value);
    const type = document.getElementById('acc-type').value;
    const balance = parseFloat(document.getElementById('acc-balance').value);

    try {
        const { error } = await window.supabaseClient
            .from('accounts')
            .insert([{
                user_id: window.state.user.id,
                name,
                type,
                balance
            }]);

        if (error) throw error;

        document.getElementById('account-modal').style.display = 'none';
        document.getElementById('add-account-form').reset();
        window.loadData();
    } catch (err) {
        alert('Error adding account: ' + err.message);
    }
    return false;
};

window.deleteAccount = async (id) => {
    if (!confirm('Delete this account? Transactions linked to it will remain but lose the link.')) return;
    try {
        const { error } = await window.supabaseClient
            .from('accounts')
            .delete()
            .eq('id', id);

        if (error) throw error;
        window.loadData();
    } catch (err) {
        alert('Error deleting account: ' + err.message);
    }
};

window.renderSettings = () => {
    const contentArea = document.getElementById('content-area');
    const apiKey = localStorage.getItem('openai_api_key') || '';

    contentArea.innerHTML = `
        <div class="card" style="margin-bottom: 2rem;">
            <h3><i class="fa-solid fa-robot"></i> AI Configuration</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Configure your OpenAI API key to enable Smart Import features.
                <br><small>Your key is stored locally in your browser.</small>
            </p>
            
            <div class="form-group">
                <label>OpenAI API Key</label>
                <div style="display: flex; gap: 0.5rem;">
                    <input type="password" id="openai-key" value="${apiKey}" placeholder="sk-..." style="flex: 1;">
                    <button class="btn" onclick="toggleApiKeyVisibility()" style="background: var(--bg-body); border: 1px solid var(--border-color);">
                        <i class="fa-solid fa-eye" id="toggle-eye"></i>
                    </button>
                </div>
            </div>
            <button class="btn btn-primary" id="save-key-btn">Save Key</button>
        </div>

        <!-- Category Management -->
        <div class="card" style="margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3><i class="fa-solid fa-tags"></i> Manage Categories</h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm" onclick="optimizeCategories()" style="background: var(--accent-secondary); color: white; border: 1px solid var(--accent-secondary);">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Optimize
                    </button>
                    <button class="btn btn-sm" id="sync-cat-btn" onclick="syncCategories()" style="background: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-primary);">
                        <i class="fa-solid fa-rotate"></i> Sync
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('category-modal').style.display='flex'">
                        <i class="fa-solid fa-plus"></i> Add Category
                    </button>
                </div>
            </div>

            <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                <table class="transaction-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Color</th>
                            <th style="text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${window.state.categories.map(c => `
                            <tr>
                                <td>${c.name}</td>
                                <td style="text-transform: capitalize;">${c.type}</td>
                                <td>
                                    <div style="width: 20px; height: 20px; background-color: ${c.color_code}; border-radius: 4px;"></div>
                                </td>
                                <td style="text-align: center;">
                                    <button class="btn-icon" onclick="editCategory('${c.id}')" title="Edit">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button class="btn-icon delete" onclick="deleteCategory('${c.id}')" title="Delete">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- AI Audit -->
        <div class="card" style="margin-bottom: 2rem;">
            <h3><i class="fa-solid fa-magnifying-glass-chart"></i> AI Transaction Audit</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Let AI analyze your transactions to find errors, suggest better categories, and identify recurring bills.
            </p>
            
            <div class="form-group">
                <label>Audit Scope</label>
                <select id="audit-scope" style="max-width: 200px;">
                    <option value="50">Last 50 Transactions</option>
                    <option value="100">Last 100 Transactions</option>
                    <option value="all">All Transactions</option>
                </select>
            </div>

            <button class="btn btn-primary" onclick="startAIAudit()">
                <i class="fa-solid fa-robot"></i> Start AI Audit
            </button>
        </div>

        <div class="card danger-zone" style="border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.05);">
            <h3 style="color: var(--danger);">Danger Zone</h3>
            <p style="color: var(--text-secondary);">Irreversible actions.</p>
            <button class="btn" style="background: var(--danger); color: white; border: none;" onclick="resetAllData()">
                Reset All Data
            </button>
        </div>

        <!-- Add/Edit Category Modal -->
        <div id="category-modal" class="modal">
            <div class="modal-content">
                <span class="close-modal" onclick="document.getElementById('category-modal').style.display='none'">&times;</span>
                <h2>Manage Category</h2>
                <form id="add-category-form" onsubmit="return handleCategorySubmit(event)">
                    <input type="hidden" id="cat-id">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" id="cat-name" required>
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="cat-type">
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <input type="color" id="cat-color" value="#6366f1" style="width: 100%; height: 40px;">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block" id="cat-submit-btn">Save Category</button>
                </form>
            </div>
        </div>
    `;

    // Event Listener for Save Key
    document.getElementById('save-key-btn').addEventListener('click', () => {
        const key = document.getElementById('openai-key').value;
        if (key) {
            localStorage.setItem('openai_api_key', key);
            alert('API Key saved!');
        } else {
            alert('Please enter a valid key.');
        }
    });
};

window.toggleApiKeyVisibility = () => {
    const input = document.getElementById('openai-key');
    const icon = document.getElementById('toggle-eye');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

window.resetAllData = async () => {
    if (!confirm('WARNING: This will delete ALL your transactions, accounts, and categories. This cannot be undone. Are you sure?')) return;

    try {
        // Delete in order of dependencies
        await window.supabaseClient.from('transactions').delete().neq('id', 0); // Delete all
        await window.supabaseClient.from('accounts').delete().neq('id', 0);
        await window.supabaseClient.from('categories').delete().neq('id', 0);

        alert('All data has been reset.');
        window.loadData();
    } catch (err) {
        alert('Error resetting data: ' + err.message);
    }
};

// --- AI Audit Logic (kept in app.js for now or move to ai.js later) ---

window.startAIAudit = async () => {
    const openAIKey = localStorage.getItem('openai_api_key');
    if (!openAIKey) {
        alert('Please save your OpenAI API Key first.');
        return;
    }

    const scope = document.getElementById('audit-scope').value;
    let transactionsToAnalyze = window.state.transactions;

    if (scope !== 'all') {
        transactionsToAnalyze = transactionsToAnalyze.slice(0, parseInt(scope));
    }

    if (transactionsToAnalyze.length === 0) {
        alert('No transactions to audit.');
        return;
    }

    const btn = document.querySelector('button[onclick="startAIAudit()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Auditing...';

    try {
        // Show progress modal
        const modal = document.createElement('div');
        modal.id = 'audit-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>AI Audit in Progress</h2>
                <div id="audit-progress" style="margin: 1rem 0; color: var(--text-secondary);">Starting...</div>
                <div style="width: 100%; background: var(--bg-body); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div id="audit-bar" style="width: 0%; height: 100%; background: var(--accent-primary); transition: width 0.3s;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        const updates = await window.analyzeTransactions(transactionsToAnalyze, (current, total) => {
            const pct = Math.round((current / total) * 100);
            document.getElementById('audit-progress').textContent = `Analyzing ${current} of ${total} transactions...`;
            document.getElementById('audit-bar').style.width = `${pct}%`;
        });

        document.body.removeChild(modal);

        if (updates.length === 0) {
            alert('AI found no issues or improvements!');
        } else {
            window.showAuditResults(updates);
        }

    } catch (error) {
        console.error('Audit Error:', error);
        alert('Audit failed: ' + error.message);
        if (document.getElementById('audit-modal')) document.body.removeChild(document.getElementById('audit-modal'));
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

window.analyzeTransactions = async (transactions, onProgress) => {
    const BATCH_SIZE = 25;
    const updates = [];
    const openAIKey = localStorage.getItem('openai_api_key');

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        if (onProgress) onProgress(i + 1, transactions.length);

        // Prepare payload (minimal data to save tokens)
        const payload = batch.map(t => ({
            id: t.id,
            date: t.date,
            desc: t.description,
            amount: t.amount,
            cat: t.category,
            type: t.type,
            acc: window.state.accounts.find(a => a.id == t.account_id)?.name || 'Unknown'
        }));

        const prompt = `
            Audit these transactions. Look for:
            1. Mis-categorization (e.g., "Uber" as "Groceries").
            2. Missing categories ("Uncategorized").
            3. Better category names (standardize).
            4. Transfers (e.g., "Payment to Credit Card" should be type="transfer").
            
            Existing Categories: ${window.state.categories.map(c => c.name).join(', ')}.
            Prioritize using Existing Categories if they fit. Only suggest new ones if necessary.

            Return JSON with a list of "changes":
            [{ "id": "tx_id", "field": "category|type", "new_value": "...", "reason": "..." }]
            Only include transactions that need changes.
        `;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAIKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are a strict financial auditor. Respond in JSON." },
                    { role: "user", content: prompt + "\nData: " + JSON.stringify(payload) }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) throw new Error('OpenAI API Error');
        const data = await response.json();
        const batchChanges = JSON.parse(data.choices[0].message.content).changes || [];
        updates.push(...batchChanges);
    }

    return updates;
};

window.showAuditResults = (updates) => {
    const modal = document.createElement('div');
    modal.id = 'audit-results-modal';
    modal.className = 'modal';

    const rows = updates.map(u => {
        const tx = window.state.transactions.find(t => t.id === u.id);
        if (!tx) return '';
        return `
            <tr>
                <td>${tx.description}</td>
                <td>${u.field}</td>
                <td style="color: var(--danger); text-decoration: line-through;">${u.field === 'category' ? tx.category : tx.type}</td>
                <td style="color: var(--success); font-weight: 500;">${u.new_value}</td>
                <td><small>${u.reason}</small></td>
                <td style="text-align: center;">
                    <input type="checkbox" class="audit-check" checked data-id="${u.id}" data-field="${u.field}" data-value="${u.new_value}">
                </td>
            </tr>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <span class="close-modal" onclick="document.getElementById('audit-results-modal').remove()">&times;</span>
            <h2>Audit Results</h2>
            <p>Found ${updates.length} suggested improvements.</p>
            <div style="max-height: 400px; overflow-y: auto; margin-bottom: 1rem;">
                <table class="transaction-table">
                    <thead>
                        <tr>
                            <th>Transaction</th>
                            <th>Field</th>
                            <th>Old</th>
                            <th>New</th>
                            <th>Reason</th>
                            <th>Apply</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <button class="btn btn-primary btn-block" onclick="applyAuditChanges()">Apply Selected Changes</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
};

window.applyAuditChanges = async () => {
    const checks = document.querySelectorAll('.audit-check:checked');
    const changes = Array.from(checks).map(c => ({
        id: c.dataset.id,
        field: c.dataset.field,
        value: c.dataset.value
    }));

    if (changes.length === 0) return;

    const btn = document.querySelector('#audit-results-modal .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Applying...';

    try {
        // 1. Check for new categories to create
        const newCategories = new Set();
        changes.forEach(c => {
            if (c.field === 'category') {
                const exists = window.state.categories.some(cat => cat.name.toLowerCase() === c.value.toLowerCase());
                if (!exists) newCategories.add(c.value);
            }
        });

        for (const catName of newCategories) {
            await window.supabaseClient.from('categories').insert([{
                user_id: window.state.user.id,
                name: catName,
                type: 'expense',
                color_code: window.getRandomColor()
            }]);
        }

        // 2. Apply updates
        for (const change of changes) {
            const update = {};
            update[change.field] = change.value;

            await window.supabaseClient
                .from('transactions')
                .update(update)
                .eq('id', change.id);
        }

        alert(`Applied ${changes.length} changes!`);
        document.getElementById('audit-results-modal').remove();
        window.loadData();

    } catch (error) {
        console.error('Apply Error:', error);
        alert('Error applying changes: ' + error.message);
    }
};

window.processCSVImport = async () => {
    const fileInput = document.getElementById('csv-file-input');
    const accountId = document.getElementById('csv-account-select').value;
    const aiCheckbox = document.getElementById('csv-ai-analyze');
    const shouldAnalyze = aiCheckbox ? aiCheckbox.checked : false;
    const logDiv = document.getElementById('import-log');

    if (!fileInput.files.length) {
        alert('Please select a CSV file.');
        return;
    }

    const file = fileInput.files[0];
    const btn = document.querySelector('button[onclick="processCSVImport()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const lines = text.split('\n');
            logDiv.innerHTML = `Found ${lines.length} lines. Parsing...<br>`;

            const newTransactions = [];
            let importedCount = 0;
            let skippedCount = 0;
            let netAmount = 0;
            let latestBalance = null;
            let latestDate = null;

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
                const isDuplicate = window.state.transactions.some(t => {
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
                        user_id: window.state.user.id,
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

                const { data: insertedData, error } = await window.supabaseClient
                    .from('transactions')
                    .insert(newTransactions)
                    .select();

                if (error) throw error;

                // Update Account Balance (Critical Fix)
                if (accountId) {
                    if (latestBalance !== null) {
                        // Use absolute balance from CSV
                        await window.supabaseClient
                            .from('accounts')
                            .update({ balance: latestBalance })
                            .eq('id', accountId);
                        logDiv.innerHTML += `Updated account balance to ${window.formatCurrency(latestBalance)} (from CSV).<br>`;
                    } else if (netAmount !== 0) {
                        // Use net calculation (Fetch-Modify-Write for better safety)
                        const { data: freshAccount, error: fetchError } = await window.supabaseClient
                            .from('accounts')
                            .select('balance')
                            .eq('id', accountId)
                            .single();

                        if (!fetchError && freshAccount) {
                            const newBalance = (freshAccount.balance || 0) + netAmount;
                            await window.supabaseClient
                                .from('accounts')
                                .update({ balance: newBalance })
                                .eq('id', accountId);
                            logDiv.innerHTML += `Updated account balance by ${netAmount > 0 ? '+' : ''}${window.formatCurrency(netAmount)}.<br>`;
                        } else if (fetchError) {
                            console.error('Balance fetch error:', fetchError);
                            logDiv.innerHTML += `<span style="color: var(--warning)">Warning: Failed to fetch account balance for update.</span>`;
                        }
                    }
                }

                window.loadData();
                logDiv.innerHTML += '<span style="color: var(--success)">Success!</span><br>';

                // Trigger AI Analysis if checked
                if (shouldAnalyze && insertedData && insertedData.length > 0) {
                    logDiv.innerHTML += '<br><span style="color: var(--accent-primary)">Running AI Analysis...</span>';
                    try {
                        const updates = await window.analyzeTransactions(insertedData, (current, total) => {
                            logDiv.innerHTML += `<br>Analyzing batch ${current} of ${total}...`;
                            logDiv.scrollTop = logDiv.scrollHeight;
                        });

                        if (updates.length > 0) {
                            setTimeout(() => {
                                document.getElementById('csv-import-modal').style.display = 'none';
                                window.showAuditResults(updates);
                            }, 1000);
                            return; // Skip the standard alert
                        } else {
                            logDiv.innerHTML += '<br>AI found no changes needed.';
                        }
                    } catch (aiErr) {
                        console.error('AI Error:', aiErr);
                        logDiv.innerHTML += `<br><span style="color: var(--danger)">AI Error: ${aiErr.message}</span>`;
                    }
                }

                setTimeout(() => {
                    document.getElementById('csv-import-modal').style.display = 'none';
                    alert(`Import Complete!\nAdded: ${importedCount}\nSkipped (Duplicates): ${skippedCount}`);
                }, 1000);
            } else {
                logDiv.innerHTML += `No new transactions found. Skipped ${skippedCount} duplicates.`;
            }

        } catch (err) {
            console.error('CSV Import Error:', err);
            logDiv.innerHTML += `<br><span style="color: var(--danger)">Error: ${err.message}</span>`;
            alert('Error importing CSV: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };
    reader.readAsText(file);
};

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

        if (!response.ok) throw new Error('OpenAI API Error');
        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);

        // Pre-fill Modal
        document.getElementById('smart-import-modal').style.display = 'none';
        document.getElementById('transaction-modal').style.display = 'flex';

        if (result.date) document.getElementById('t-date').value = result.date;
        if (result.amount) document.getElementById('t-amount').value = result.amount;
        if (result.description) document.getElementById('t-desc').value = result.description;
        if (result.type) document.getElementById('t-type').value = result.type.toLowerCase();
        if (result.category) document.getElementById('t-category').value = result.category;

        // Auto-select category if exists, else add to dropdown temporarily
        // (For now, we just set value, user might need to add it if it's new)

    } catch (error) {
        console.error('Smart Import Error:', error);
        alert('Smart Import failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};
