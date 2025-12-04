import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { sanitizeInput, formatCurrency } from './utils.js';

/**
 * Handles the submission of the goal form (Add/Edit).
 */
const handleGoalSubmit = async (e) => {
    e.preventDefault();

    const id = document.getElementById('goal-id').value;
    const name = document.getElementById('goal-name').value.trim();
    const targetAmount = parseFloat(document.getElementById('goal-target').value);
    const currentAmount = parseFloat(document.getElementById('goal-current').value) || 0;
    const deadline = document.getElementById('goal-deadline').value || null;

    if (!name || targetAmount <= 0) {
        alert('Please enter a valid goal name and target amount.');
        return;
    }

    const goalData = {
        user_id: state.user.id,
        name,
        target_amount: targetAmount,
        current_amount: currentAmount,
        deadline
    };

    try {
        if (id) {
            // Update existing goal
            const { error } = await supabaseClient
                .from('goals')
                .update(goalData)
                .eq('id', id);

            if (error) throw error;
        } else {
            // Create new goal
            const { error } = await supabaseClient
                .from('goals')
                .insert([goalData]);

            if (error) throw error;
        }

        // Reload goals and re-render
        await loadGoals();
        renderGoals();

        // Close modal
        document.getElementById('goal-modal').style.display = 'none';
        document.getElementById('goal-form').reset();
    } catch (error) {
        console.error('Error saving goal:', error);
        alert('Failed to save goal. Please try again.');
    }
};

/**
 * Deletes a goal after confirmation.
 */
const deleteGoal = async (id) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
        const { error } = await supabaseClient
            .from('goals')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Reload goals and re-render
        await loadGoals();
        renderGoals();
    } catch (error) {
        console.error('Error deleting goal:', error);
        alert('Failed to delete goal. Please try again.');
    }
};

/**
 * Opens modal to contribute to a goal.
 */
const contributeToGoal = (id) => {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;

    const amount = prompt(`How much would you like to contribute to "${goal.name}"?`);
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return;

    updateGoalAmount(id, parseFloat(amount));
};

/**
 * Updates the current amount of a goal.
 */
const updateGoalAmount = async (id, additionalAmount) => {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;

    const newAmount = goal.current_amount + additionalAmount;

    try {
        const { error } = await supabaseClient
            .from('goals')
            .update({ current_amount: newAmount })
            .eq('id', id);

        if (error) throw error;

        // Reload goals and re-render
        await loadGoals();
        renderGoals();
    } catch (error) {
        console.error('Error updating goal:', error);
        alert('Failed to update goal. Please try again.');
    }
};

/**
 * Loads goals from Supabase.
 */
const loadGoals = async () => {
    if (!state.user) return;

    try {
        const { data: goals, error } = await supabaseClient
            .from('goals')
            .select('*')
            .eq('user_id', state.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        state.goals = goals || [];
    } catch (error) {
        console.error('Error loading goals:', error);
    }
};

/**
 * Opens the edit modal for a goal.
 */
const editGoal = (id) => {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;

    document.getElementById('goal-id').value = goal.id;
    document.getElementById('goal-name').value = goal.name;
    document.getElementById('goal-target').value = goal.target_amount;
    document.getElementById('goal-current').value = goal.current_amount || 0;
    document.getElementById('goal-deadline').value = goal.deadline || '';

    document.getElementById('goal-submit-btn').textContent = 'Update Goal';
    document.getElementById('goal-modal').style.display = 'flex';
};

/**
 * Renders the Goals view.
 */
export const renderGoals = () => {
    const contentArea = document.getElementById('content-area');

    const goalsHTML = state.goals.length > 0
        ? state.goals.map(g => {
            const progress = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
            const progressCapped = Math.min(progress, 100);

            return `
                <div class="goal-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 0.5rem 0;">${sanitizeInput(g.name)}</h4>
                            <small style="color: var(--text-secondary);">Target: ${formatCurrency(g.target_amount)}</small>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn-icon edit-goal-btn" data-id="${g.id}" title="Edit">
                                <i class="fa-solid fa-edit"></i>
                            </button>
                            <button class="btn-icon delete-goal-btn" data-id="${g.id}" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressCapped}%"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.9rem;">
                        <span>${formatCurrency(g.current_amount)}</span>
                        <span style="color: var(--accent-primary); font-weight: 600;">${progressCapped.toFixed(0)}%</span>
                    </div>

                    ${g.deadline ? `<small style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">Deadline: ${new Date(g.deadline).toLocaleDateString()}</small>` : ''}

                    <button class="btn btn-sm contribute-goal-btn" data-id="${g.id}" style="margin-top: 1rem; width: 100%;">
                        <i class="fa-solid fa-plus"></i> Contribute
                    </button>
                </div>
            `;
        }).join('')
        : '<div class="empty-state"><i class="fa-solid fa-bullseye"></i><p>No goals yet. Create your first savings goal!</p></div>';

    contentArea.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3>Financial Goals</h3>
                <button class="btn btn-primary btn-sm" id="open-goal-modal-btn">
                    <i class="fa-solid fa-plus"></i> Add Goal
                </button>
            </div>

            <div class="goals-grid">
                ${goalsHTML}
            </div>
        </div>
    `;

    // Attach event listeners using event delegation
    const goalsGrid = document.querySelector('.goals-grid');
    if (goalsGrid) {
        goalsGrid.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-goal-btn');
            const editBtn = e.target.closest('.edit-goal-btn');
            const contributeBtn = e.target.closest('.contribute-goal-btn');

            if (deleteBtn) {
                deleteGoal(deleteBtn.dataset.id);
            } else if (editBtn) {
                editGoal(editBtn.dataset.id);
            } else if (contributeBtn) {
                contributeToGoal(contributeBtn.dataset.id);
            }
        });
    }

    // Open goal modal button
    const openModalBtn = document.getElementById('open-goal-modal-btn');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            document.getElementById('goal-form').reset();
            document.getElementById('goal-id').value = '';
            document.getElementById('goal-submit-btn').textContent = 'Add Goal';
            document.getElementById('goal-modal').style.display = 'flex';
        });
    }

    // Attach form submit listener
    const goalForm = document.getElementById('goal-form');
    if (goalForm) {
        goalForm.removeEventListener('submit', handleGoalSubmit);
        goalForm.addEventListener('submit', handleGoalSubmit);
    }

    // Close modal button
    const closeModalBtn = document.getElementById('close-goal-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('goal-modal').style.display = 'none';
        });
    }
};
