// Transaction Management Logic

// Transaction Management Logic

/**
 * Handles the submission of the transaction form (Add/Edit).
 * @param {Event} e - The submit event.
 */
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
    const category = window.sanitizeInput(document.getElementById('t-category').value);
    const date = document.getElementById('t-date').value;
    const description = window.sanitizeInput(document.getElementById('t-desc').value);
    const notes = window.sanitizeInput(document.getElementById('t-notes').value);
    const accountId = document.getElementById('t-account').value;

    console.log('Submitting:', { id, type, amount, category, date, description, notes, accountId });

    // Validation
    const validationError = window.validateTransaction({ amount, date, category });
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
            if (!error) alert('Transaction updated!');
        } else {
            // INSERT new transaction
            const { error: insertError } = await window.supabaseClient
                .from('transactions')
                .insert([{
                    user_id: window.state.user.id,
                    type,
                    amount,
                    category,
                    date,
                    description,
                    notes,
                    account_id: accountId || null
                }]);
            error = insertError;

            // Balance update is now handled by DB Triggers
        }

        if (error) throw error;

        document.getElementById('transaction-modal').style.display = 'none';
        document.getElementById('add-transaction-form').reset();
        window.loadData(); // Reload all data to ensure UI is in sync

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
window.deleteTransaction = async (id) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
        const { error } = await window.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        window.loadData();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Error deleting transaction: ' + error.message);
    }
};

/**
 * Opens the edit modal for a transaction.
 * @param {string} id - The transaction ID.
 */
window.editTransaction = (id) => {
    const t = window.state.transactions.find(tr => tr.id === id);
    if (!t) return;

    document.getElementById('t-id').value = t.id;
    document.getElementById('t-type').value = t.type;
    document.getElementById('t-amount').value = t.amount;
    document.getElementById('t-category').value = t.category || 'Uncategorized';
    document.getElementById('t-date').value = t.date;
    document.getElementById('t-desc').value = t.description || '';
    document.getElementById('t-notes').value = t.notes || '';
    document.getElementById('t-account').value = t.account_id || '';

    document.getElementById('t-submit-btn').textContent = 'Update Transaction';
    document.getElementById('transaction-modal').style.display = 'flex';
};

/**
 * Filters transactions based on UI inputs.
 */
window.filterTransactions = () => {
    const search = document.getElementById('filter-search').value.toLowerCase();
    const type = document.getElementById('filter-type').value;
    const category = document.getElementById('filter-category').value;
    const account = document.getElementById('filter-account').value;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;

    const filtered = window.state.transactions.filter(t => {
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

    document.getElementById('transaction-list-container').innerHTML = window.renderTransactionList(filtered);
};

/**
 * Uses AI to auto-fill transaction details based on description and amount.
 */
window.autoFillTransaction = async () => {
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
            1. Category (from list: ${window.state.categories.map(c => c.name).join(', ')})
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
