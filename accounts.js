import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { sanitizeInput, formatCurrency } from './utils.js';
import { loadData } from './dataLoader.js';

/**
 * Updates an account's balance by a specific amount.
 * @param {string} accountId - The account ID.
 * @param {number} amountChange - The amount to add (positive) or subtract (negative).
 */
export const updateAccountBalance = async (accountId, amountChange) => {
    if (!accountId) return;

    try {
        // 1. Fetch current balance to ensure we have the latest
        const { data: account, error: fetchError } = await supabaseClient
            .from('accounts')
            .select('balance')
            .eq('id', accountId)
            .single();

        if (fetchError) throw fetchError;

        const newBalance = (account.balance || 0) + amountChange;

        // 2. Update with new balance
        const { error: updateError } = await supabaseClient
            .from('accounts')
            .update({ balance: newBalance })
            .eq('id', accountId);

        if (updateError) throw updateError;

    } catch (error) {
        console.error('Error updating account balance:', error);
        throw error; // Re-throw to be handled by caller
    }
};

/**
 * Renders the Accounts view.
 */
export const renderAccounts = () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>Accounts</h3>
                <button class="btn btn-primary btn-sm" id="open-account-modal-btn">
                    <i class="fa-solid fa-plus"></i> Add Account
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
                ${state.accounts.map(a => `
                    <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <h4 style="margin: 0; color: var(--text-primary);">${a.name}</h4>
                                <small style="color: var(--text-secondary); text-transform: capitalize;">${a.type}</small>
                            </div>
                            <button class="btn-icon delete-account-btn" data-id="${a.id}">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                        <div style="margin-top: 1rem; font-size: 1.5rem; font-weight: 600; color: var(--accent-primary);">
                            ${formatCurrency(a.balance)}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Add Account Modal -->
        <div id="account-modal" class="modal">
            <div class="modal-content">
                <span class="close-modal" id="close-account-modal-btn">&times;</span>
                <h2>Add Account</h2>
                <form id="add-account-form">
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

    // Attach Event Listeners
    document.getElementById('open-account-modal-btn').addEventListener('click', () => {
        document.getElementById('account-modal').style.display = 'flex';
    });

    document.getElementById('close-account-modal-btn').addEventListener('click', () => {
        document.getElementById('account-modal').style.display = 'none';
    });

    document.getElementById('add-account-form').addEventListener('submit', handleAccountSubmit);

    document.querySelectorAll('.delete-account-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteAccount(btn.dataset.id));
    });
};

/**
 * Handles the submission of the account form.
 * @param {Event} e - The submit event.
 */
export const handleAccountSubmit = async (e) => {
    e.preventDefault();
    const name = sanitizeInput(document.getElementById('acc-name').value);
    const type = document.getElementById('acc-type').value;
    const balance = parseFloat(document.getElementById('acc-balance').value);

    try {
        const { error } = await supabaseClient
            .from('accounts')
            .insert([{
                user_id: state.user.id,
                name,
                type,
                balance
            }]);

        if (error) throw error;

        document.getElementById('account-modal').style.display = 'none';
        document.getElementById('add-account-form').reset();
        loadData();
    } catch (err) {
        alert('Error adding account: ' + err.message);
    }
    return false;
};

/**
 * Deletes an account by ID.
 * @param {string} id - The account ID.
 */
export const deleteAccount = async (id) => {
    if (!confirm('Delete this account? Transactions linked to it will remain but lose the link.')) return;
    try {
        const { error } = await supabaseClient
            .from('accounts')
            .delete()
            .eq('id', id);

        if (error) throw error;
        loadData();
    } catch (err) {
        alert('Error deleting account: ' + err.message);
    }
};
