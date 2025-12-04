import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { sanitizeInput, validateTransaction, formatCurrency, getCategoryColor } from './utils.js';
import { loadData } from './dataLoader.js';
import { analyzeTransactions, showAuditResults } from './ai.js';
import { updateAccountBalance } from './accounts.js';

/**
 * Handles the submission of the transaction form (Add/Edit).
 * @param {Event} e - The submit event.
 */
export const handleTransactionSubmit = async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('t-submit-btn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const id = document.getElementById('t-id').value; // Hidden ID
    const type = document.getElementById('t-type').value;
    const amount = parseFloat(document.getElementById('t-amount').value);
    const category = sanitizeInput(document.getElementById('t-category').value);
    const date = document.getElementById('t-date').value;
    const description = sanitizeInput(document.getElementById('t-desc').value);
    const notes = sanitizeInput(document.getElementById('t-notes').value);
    const accountId = document.getElementById('t-account').value;

    // Validation
    const validationError = validateTransaction({ amount, date, category, description });
    if (validationError) {
        alert(validationError);
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
    }

    try {
        let error;

        if (id) {
            // UPDATE existing transaction
            // 1. Fetch original transaction to revert its impact
            const originalTransaction = state.transactions.find(t => t.id == id);
            if (!originalTransaction) throw new Error('Original transaction not found');

            // 2. Revert Old Impact
            if (originalTransaction.account_id) {
                const oldAmount = originalTransaction.amount;
                const oldType = originalTransaction.type;
                // Reverse: Income -> Subtract, Expense -> Add
                const revertChange = oldType === 'income' ? -oldAmount : oldAmount;
                await updateAccountBalance(originalTransaction.account_id, revertChange);
            }

            // 3. Apply New Impact
            if (accountId) {
                // Apply: Income -> Add, Expense -> Subtract
                const newChange = type === 'income' ? amount : -amount;
                await updateAccountBalance(accountId, newChange);
            }

            // 4. Update Transaction
            const { error: updateError } = await supabaseClient
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
            if (!error) alert('Transaction updated!');

        } else {
            // INSERT new transaction
            const { error: insertError } = await supabaseClient
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

            // Apply Impact to Account
            if (!error && accountId) {
                const change = type === 'income' ? amount : -amount;
                await updateAccountBalance(accountId, change);
            }
        }

        if (error) throw error;

        document.getElementById('transaction-modal').style.display = 'none';
        document.getElementById('add-transaction-form').reset();
        loadData(); // Reload all data to ensure UI is in sync

    } catch (err) {
        console.error('Error saving transaction:', err);
        alert('Error saving transaction: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
};

/**
 * Deletes a transaction by ID.
 * @param {string} id - The transaction ID.
 */
export const deleteTransaction = async (id) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
        const { error } = await supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        loadData();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Error deleting transaction: ' + error.message);
    }
};

/**
 * Opens the edit modal for a transaction.
 * @param {string} id - The transaction ID.
 */
export const editTransaction = (id) => {
    console.log('editTransaction called with ID:', id, 'Type:', typeof id);
    // Convert ID to match the type in state.transactions (could be string or number)
    const t = state.transactions.find(tr => tr.id == id); // Use == for loose equality
    if (!t) {
        console.error('Transaction not found:', id);
        console.log('Available transaction IDs:', state.transactions.map(t => t.id));
        return;
    }

    console.log('Transaction found:', t);

    // Populate category dropdown
    const categorySelect = document.getElementById('t-category');
    categorySelect.innerHTML = state.categories.map(c =>
        `<option value="${c.name}">${c.name}</option>`
    ).join('');

    // Populate account dropdown
    const accountSelect = document.getElementById('t-account');
    accountSelect.innerHTML = '<option value="">No Account</option>' +
        state.accounts.map(a =>
            `<option value="${a.id}">${a.name}</option>`
        ).join('');

    // Set form values
    document.getElementById('t-id').value = t.id;
    document.getElementById('t-type').value = t.type;
    document.getElementById('t-amount').value = t.amount;
    document.getElementById('t-category').value = t.category || 'Uncategorized';
    document.getElementById('t-date').value = t.date;
    document.getElementById('t-desc').value = t.description || '';
    document.getElementById('t-notes').value = t.notes || '';
    document.getElementById('t-account').value = t.account_id || '';

    document.getElementById('t-submit-btn').textContent = 'Update Transaction';

    const modal = document.getElementById('transaction-modal');
    console.log('Modal element:', modal);
    if (modal) {
        modal.style.display = 'flex';
        console.log('Modal display set to flex');
    } else {
        console.error('Modal element not found!');
    }
};

/**
 * Renders the full Transactions view with filters.
 */
export const renderTransactions = () => {
    const categories = [...new Set(state.categories.map(c => c.name))];
    const contentArea = document.getElementById('content-area');

    contentArea.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>All Transactions</h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary btn-sm" id="open-tx-modal-btn">
                        <i class="fa-solid fa-plus"></i> Add Transaction
                    </button>
                    <button class="btn btn-sm" id="open-csv-modal-btn" style="background: var(--accent-secondary); color: white; border: 1px solid var(--accent-secondary);">
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
                        <input type="text" id="filter-search" placeholder="Search descriptions..." 
                            style="width: 100%; padding: 0.5rem 0.5rem 0.5rem 2rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                    </div>
                </div>

                <!-- Type -->
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Type</label>
                    <select id="filter-type" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                        <option value="all">All Types</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                        <option value="transfer">Transfer</option>
                    </select>
                </div>

                <!-- Category -->
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Category</label>
                    <select id="filter-category" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                        <option value="all">All Categories</option>
                        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>

                <!-- Account -->
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Account</label>
                    <select id="filter-account" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                        <option value="all">All Accounts</option>
                        ${state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                    </select>
                </div>

                <!-- Date Range -->
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">From</label>
                    <input type="date" id="filter-date-from" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                </div>
                <div>
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">To</label>
                    <input type="date" id="filter-date-to" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                </div>
            </div>

            <div id="transaction-list-container"></div>
        </div>

        <!-- CSV Import Modal -->
        <div id="csv-import-modal" class="modal">
            <div class="modal-content">
                <span class="close-modal" id="close-csv-modal">&times;</span>
                <h2>Import CSV</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Upload a CSV file with columns: Date, Description, Amount, Type, Category.</p>
                <input type="file" id="csv-file-input" accept=".csv" style="margin-bottom: 1rem;">
                <button class="btn btn-primary btn-block" id="process-csv-btn">Import</button>
            </div>
        </div>
    `;

    // Initial render of the transaction list
    const container = document.getElementById('transaction-list-container');
    container.innerHTML = renderTransactionList(state.transactions);
    attachTransactionListeners(container);
    attachSwipeListeners();

    // Attach Filter Listeners
    const filterInputs = ['filter-search', 'filter-type', 'filter-category', 'filter-account', 'filter-date-from', 'filter-date-to'];
    filterInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', filterTransactions);
    });

    // Attach Button Listeners
    document.getElementById('open-tx-modal-btn').addEventListener('click', () => {
        document.getElementById('transaction-modal').style.display = 'flex';
    });

    document.getElementById('open-csv-modal-btn').addEventListener('click', () => {
        document.getElementById('csv-import-modal').style.display = 'flex';
    });

    document.getElementById('close-csv-modal').addEventListener('click', () => {
        document.getElementById('csv-import-modal').style.display = 'none';
    });

    document.getElementById('process-csv-btn').addEventListener('click', processCSVImport);
};

/**
 * Filters transactions based on UI inputs.
 */
export const filterTransactions = () => {
    const search = document.getElementById('filter-search').value.toLowerCase();
    const type = document.getElementById('filter-type').value;
    const category = document.getElementById('filter-category').value;
    const account = document.getElementById('filter-account').value;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;

    const filtered = state.transactions.filter(t => {
        // 1. Search
        if (search && !t.description.toLowerCase().includes(search) && !(t.notes || '').toLowerCase().includes(search)) {
            return false;
        }

        // 2. Type
        if (type !== 'all' && t.type !== type) {
            return false;
        }

        // 3. Category
        if (category !== 'all' && t.category !== category) {
            return false;
        }

        // 4. Account
        if (account !== 'all' && t.account_id != account) { // Loose equality for string/number match
            return false;
        }

        // 5. Date Range
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;

        return true;
    });

    const container = document.getElementById('transaction-list-container');
    container.innerHTML = renderTransactionList(filtered);
    attachTransactionListeners(container);
    attachSwipeListeners();
};

/**
 * Uses AI to auto-fill transaction details based on description and amount.
 */
export const autoFillTransaction = async () => {
    const desc = document.getElementById('t-desc').value;
    const amount = document.getElementById('t-amount').value;

    if (!desc) {
        alert('Please enter a description first.');
        return;
    }

    const btn = document.getElementById('auto-fill-btn');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> AI Thinking...';

    try {
        const openAIKey = localStorage.getItem('openai_api_key');
        if (!openAIKey) throw new Error('Please save your OpenAI API Key in Settings.');

        const prompt = `
            Based on the transaction description "${desc}" and amount "${amount}", suggest:
            1. Category (from list: ${state.categories.map(c => c.name).join(', ')})
            2. Type (income, expense, transfer)
            3. A short, helpful note (max 10 words)

            Return JSON: { "category": "...", "type": "...", "note": "..." }
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
                    { role: "system", content: "You are a financial assistant. Respond in JSON." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
        }
        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenAI');
        }
        const result = JSON.parse(data.choices[0].message.content);

        // Apply suggestions
        if (result.category) document.getElementById('t-category').value = result.category;
        if (result.type) document.getElementById('t-type').value = result.type.toLowerCase();
        if (result.note) document.getElementById('t-notes').value = result.note;

    } catch (error) {
        console.error('Auto-fill Error:', error);
        alert('Auto-fill failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
};

/**
 * Renders the list of transactions as HTML.
 * @param {Array} transactions - The transactions to render.
 * @returns {string} HTML string.
 */
export const renderTransactionList = (transactions) => {
    if (transactions.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No transactions found.</div>';
    }

    return `
        <ul class="transaction-list">
            ${transactions.map(t => {
        const accountName = state.accounts.find(a => a.id == t.account_id)?.name || '-';
        const isIncome = t.type === 'income';
        const color = isIncome ? 'var(--success)' : (t.type === 'transfer' ? 'var(--text-secondary)' : 'var(--text-primary)');
        const sign = isIncome ? '+' : (t.type === 'expense' ? '-' : '');

        return `
                <li class="transaction-item" data-id="${t.id}" style="cursor: pointer;">
                    <div class="tx-content">
                        <div class="tx-left">
                            <div class="tx-category-icon" style="background-color: ${getCategoryColor(t.category)}20; color: ${getCategoryColor(t.category)};">
                                <i class="fa-solid fa-tag"></i>
                            </div>
                            <div class="tx-details">
                                <span class="tx-desc">${sanitizeInput(t.description)}</span>
                                <span class="tx-meta">
                                    ${new Date(t.date).toLocaleDateString()} • <span style="color: ${getCategoryColor(t.category)}">${sanitizeInput(t.category)}</span>
                                    ${t.account_id ? `• <span style="color: var(--text-secondary)">${sanitizeInput(accountName)}</span>` : ''}
                                </span>
                            </div>
                        </div>
                        <div class="tx-right">
                            <span class="tx-amount ${t.type === 'income' ? 'income' : 'expense'}">
                                ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
                            </span>
                        </div>
                    </div>
                    <div class="swipe-action">
                        <i class="fa-solid fa-trash"></i>
                    </div>
                </li>
            `;
    }).join('')}
        </ul>
    `;
};

/**
 * Attaches event listeners to the transaction list buttons using event delegation.
 * This prevents memory leaks by using a single listener instead of many.
 * @param {HTMLElement} container - The container element.
 */
export const attachTransactionListeners = (container) => {
    // Remove old listener if it exists (cleanup)
    if (container._transactionClickHandler) {
        container.removeEventListener('click', container._transactionClickHandler);
    }

    // Create new handler using event delegation
    const clickHandler = (e) => {
        console.log('Click detected on:', e.target);

        // Check if click was on swipe action (delete) - but swipe-action is hidden by default
        const swipeAction = e.target.closest('.swipe-action');
        if (swipeAction) {
            console.log('Swipe action clicked');
            const txItem = swipeAction.closest('.transaction-item');
            if (txItem) {
                deleteTransaction(txItem.dataset.id);
            }
            return;
        }

        // Check if click was on transaction item (open edit modal)
        const txItem = e.target.closest('.transaction-item');
        if (txItem) {
            console.log('Transaction item clicked, ID:', txItem.dataset.id);
            editTransaction(txItem.dataset.id);
            return;
        }

        console.log('Click not on transaction item');
    };

    // Store reference for cleanup
    container._transactionClickHandler = clickHandler;

    // Attach single listener to container
    container.addEventListener('click', clickHandler);
    console.log('Transaction listeners attached to container');
};

const attachSwipeListeners = () => {
    const items = document.querySelectorAll('.transaction-item');
    let touchStartX = 0;
    let touchEndX = 0;

    items.forEach(item => {
        item.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        });

        item.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe(item);
        });
    });

    const handleSwipe = (item) => {
        if (touchStartX - touchEndX > 100) {
            // Swipe Left
            item.classList.add('swiped');
            // Trigger delete confirmation after a delay or show a button
            if (confirm('Delete this transaction?')) {
                deleteTransaction(item.dataset.id);
            } else {
                item.classList.remove('swiped');
            }
        }
        if (touchEndX - touchStartX > 100) {
            // Swipe Right (Reset)
            item.classList.remove('swiped');
        }
    };
};



/**
 * Processes the CSV Import.
 */
export const processCSVImport = async () => {
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
    const btn = document.getElementById('process-csv-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Processing...';

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

            // Build Set for O(1) duplicate detection (optimization)
            const existingTxSet = new Set(
                state.transactions.map(t => {
                    const tDesc = (t.description || '').trim().toLowerCase();
                    return `${t.date}|${t.amount}|${tDesc}`;
                })
            );

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

                // Duplicate Check (optimized with Set for O(1) lookup)
                const cleanDesc = description.replace(/"/g, '').trim().toLowerCase();
                const txKey = `${date}|${amount}|${cleanDesc}`;
                const isDuplicate = existingTxSet.has(txKey);

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

                const { data: insertedData, error } = await supabaseClient
                    .from('transactions')
                    .insert(newTransactions)
                    .select();

                if (error) throw error;

                // Update Account Balance (Critical Fix)
                if (accountId) {
                    if (latestBalance !== null) {
                        // Use absolute balance from CSV
                        await supabaseClient
                            .from('accounts')
                            .update({ balance: latestBalance })
                            .eq('id', accountId);
                        logDiv.innerHTML += `Updated account balance to ${formatCurrency(latestBalance)} (from CSV).<br>`;
                    } else if (netAmount !== 0) {
                        // Use net calculation (Fetch-Modify-Write for better safety)
                        const { data: freshAccount, error: fetchError } = await supabaseClient
                            .from('accounts')
                            .select('balance')
                            .eq('id', accountId)
                            .single();

                        if (!fetchError && freshAccount) {
                            const newBalance = (freshAccount.balance || 0) + netAmount;
                            await supabaseClient
                                .from('accounts')
                                .update({ balance: newBalance })
                                .eq('id', accountId);
                            logDiv.innerHTML += `Updated account balance by ${netAmount > 0 ? '+' : ''}${formatCurrency(netAmount)}.<br>`;
                        } else if (fetchError) {
                            console.error('Balance fetch error:', fetchError);
                            logDiv.innerHTML += `<span style="color: var(--warning)">Warning: Failed to fetch account balance for update.</span>`;
                        }
                    }
                }

                loadData();
                logDiv.innerHTML += '<span style="color: var(--success)">Success!</span><br>';

                // Trigger AI Analysis if checked
                if (shouldAnalyze && insertedData && insertedData.length > 0) {
                    logDiv.innerHTML += '<br><span style="color: var(--accent-primary)">Running AI Analysis...</span>';
                    try {
                        const updates = await analyzeTransactions(insertedData, (current, total) => {
                            logDiv.innerHTML += `<br>Analyzing batch ${current} of ${total}...`;
                            logDiv.scrollTop = logDiv.scrollHeight;
                        });

                        if (updates.length > 0) {
                            setTimeout(() => {
                                document.getElementById('csv-import-modal').style.display = 'none';
                                showAuditResults(updates);
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
            btn.textContent = originalText;
        }
    };
    reader.readAsText(file);
};
