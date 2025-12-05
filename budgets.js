import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { sanitizeInput, formatCurrency } from './utils.js';
import { checkBudgetWarnings } from './notifications.js';

/**
 * Loads budgets from Supabase
 */
const loadBudgets = async () => {
    if (!state.user) return;

    try {
        const { data: budgets, error } = await supabaseClient
            .from('budgets')
            .select('*')
            .eq('user_id', state.user.id);

        if (error) throw error;
        state.budgets = budgets || [];
    } catch (error) {
        console.error('Error loading budgets:', error);
    }
};

/**
 * Calculates spending for a category in current month
 */
const getCategorySpending = (category) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return state.transactions
        .filter(t =>
            t.category === category &&
            t.type === 'expense' &&
            new Date(t.date) >= startOfMonth &&
            new Date(t.date) <= endOfMonth
        )
        .reduce((sum, t) => sum + t.amount, 0);
};

/**
 * Handles budget form submission
 */
const handleBudgetSubmit = async (e) => {
    e.preventDefault();

    const id = document.getElementById('budget-id').value;
    const category = document.getElementById('budget-category').value.trim();
    const amount = parseFloat(document.getElementById('budget-amount').value);

    if (!category || amount <= 0) {
        alert('Please enter a valid category and amount.');
        return;
    }

    const budgetData = {
        user_id: state.user.id,
        category,
        amount,
        period: 'monthly'
    };

    try {
        if (id) {
            const { error } = await supabaseClient
                .from('budgets')
                .update(budgetData)
                .eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('budgets')
                .insert([budgetData]);
            if (error) throw error;
        }

        await loadBudgets();
        renderBudgets();
        document.getElementById('budget-modal').style.display = 'none';
    } catch (error) {
        console.error('Error saving budget:', error);
        alert('Failed to save budget. Please try again.');
    }
};

/**
 * Deletes a budget
 */
const deleteBudget = async (id) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;

    try {
        const { error } = await supabaseClient
            .from('budgets')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadBudgets();
        renderBudgets();
    } catch (error) {
        console.error('Error deleting budget:', error);
        alert('Failed to delete budget.');
    }
};

/**
 * Opens edit modal for a budget
 */
const editBudget = (id) => {
    const budget = state.budgets.find(b => b.id === id);
    if (!budget) return;

    document.getElementById('budget-id').value = budget.id;
    document.getElementById('budget-category').value = budget.category;
    document.getElementById('budget-amount').value = budget.amount;

    document.getElementById('budget-submit-btn').textContent = 'Update Budget';
    document.getElementById('budget-modal').style.display = 'flex';
};

/**
 * Renders the Budgets view
 */
export const renderBudgets = () => {
    const contentArea = document.getElementById('content-area');

    // Calculate budget status for each category
    const budgetData = state.budgets.map(b => {
        const spent = getCategorySpending(b.category);
        const percentage = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        const remaining = b.amount - spent;

        let status = 'good';
        if (percentage >= 100) status = 'exceeded';
        else if (percentage >= 80) status = 'warning';

        return { ...b, spent, percentage, remaining, status };
    });

    const budgetsHTML = budgetData.length > 0
        ? budgetData.map(b => `
            <div class="budget-card budget-${b.status}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div>
                        <h4 style="margin: 0 0 0.5rem 0;">${sanitizeInput(b.category)}</h4>
                        <small style="color: var(--text-secondary);">
                            ${formatCurrency(b.spent)} / ${formatCurrency(b.amount)}
                        </small>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon edit-budget-btn" data-id="${b.id}" title="Edit">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-budget-btn" data-id="${b.id}" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="progress-bar">
                    <div class="progress-fill progress-${b.status}" style="width: ${Math.min(b.percentage, 100)}%"></div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.9rem;">
                    <span style="color: ${b.remaining >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${b.remaining >= 0 ? 'Remaining' : 'Over'}: ${formatCurrency(Math.abs(b.remaining))}
                    </span>
                    <span style="color: var(--text-secondary);">${b.percentage.toFixed(0)}%</span>
                </div>
            </div>
        `).join('')
        : '<div class="empty-state"><i class="fa-solid fa-wallet"></i><p>No budgets set. Create your first budget!</p></div>';

    contentArea.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>Monthly Budgets</h3>
                <button class="btn btn-primary btn-sm" id="open-budget-modal-btn">
                    <i class="fa-solid fa-plus"></i> Add Budget
                </button>
            </div>

            <div class="budgets-grid">
                ${budgetsHTML}
            </div>
        </div>
    `;

    // Event delegation for buttons
    attachBudgetEventListeners();

    // Check for budget warnings
    setTimeout(() => checkBudgetWarnings(), 500);
};

/**
 * Attaches event listeners using event delegation
 */
const attachBudgetEventListeners = () => {
    const budgetsGrid = document.querySelector('.budgets-grid');
    if (budgetsGrid) {
        budgetsGrid.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-budget-btn');
            const editBtn = e.target.closest('.edit-budget-btn');

            if (deleteBtn) deleteBudget(deleteBtn.dataset.id);
            else if (editBtn) editBudget(editBtn.dataset.id);
        });
    }

    const openModalBtn = document.getElementById('open-budget-modal-btn');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            document.getElementById('budget-form').reset();
            document.getElementById('budget-id').value = '';
            document.getElementById('budget-submit-btn').textContent = 'Add Budget';
            document.getElementById('budget-modal').style.display = 'flex';
        });
    }

    // Form submit listener (Issue #8 fix - prevent memory leak)
    const budgetForm = document.getElementById('budget-form');
    if (budgetForm) {
        // Clone form to remove all existing event listeners
        const newForm = budgetForm.cloneNode(true);
        budgetForm.parentNode.replaceChild(newForm, budgetForm);

        // Add fresh listener
        newForm.addEventListener('submit', handleBudgetSubmit);
    }

    // Close modal listener
    const closeModalBtn = document.getElementById('close-budget-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('budget-modal').style.display = 'none';
        });
    }
};

// Export loadBudgets for use in dataLoader
export { loadBudgets };
