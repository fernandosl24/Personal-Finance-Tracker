import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';

/**
 * Loads all application data from Supabase.
 */
export const loadData = async () => {
    if (!state.user) return;

    let hasErrors = false;
    const errors = [];

    // 1. Fetch Categories
    try {
        const { data: categories, error: catError } = await supabaseClient
            .from('categories')
            .select('*')
            .eq('user_id', state.user.id);

        if (catError) {
            console.error('Error fetching categories:', catError);
            errors.push('categories');
            hasErrors = true;
        }
        state.categories = categories || [];
    } catch (e) {
        console.error('Exception fetching categories:', e);
        errors.push('categories');
        hasErrors = true;
    }

    // 2. Fetch Accounts
    try {
        const { data: accounts, error: accError } = await supabaseClient
            .from('accounts')
            .select('*')
            .eq('user_id', state.user.id);

        if (accError) {
            console.error('Error fetching accounts:', accError);
            errors.push('accounts');
            hasErrors = true;
        }
        state.accounts = accounts || [];
    } catch (e) {
        console.error('Exception fetching accounts:', e);
        errors.push('accounts');
        hasErrors = true;
    }

    // 3. Fetch Transactions
    try {
        const { data: transactions, error: txError } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', state.user.id)
            .order('date', { ascending: false });

        if (txError) {
            console.error('Error fetching transactions:', txError);
            errors.push('transactions');
            hasErrors = true;
        }
        state.transactions = transactions || [];
    } catch (e) {
        console.error('Exception fetching transactions:', e);
        errors.push('transactions');
        hasErrors = true;
    }

    // 4. Fetch Goals
    try {
        const { data: goals, error: goalsError } = await supabaseClient
            .from('goals')
            .select('*')
            .eq('user_id', state.user.id);

        if (goalsError) {
            console.error('Error fetching goals:', goalsError);
            errors.push('goals');
            hasErrors = true;
        }
        state.goals = goals || [];
    } catch (e) {
        console.error('Exception fetching goals:', e);
        errors.push('goals');
        hasErrors = true;
    }

    // 5. Fetch Budgets
    try {
        const { data: budgets, error: budgetsError } = await supabaseClient
            .from('budgets')
            .select('*')
            .eq('user_id', state.user.id);

        if (budgetsError) {
            console.error('Error fetching budgets:', budgetsError);
            errors.push('budgets');
            hasErrors = true;
        }
        state.budgets = budgets || [];
    } catch (e) {
        console.error('Exception fetching budgets:', e);
        errors.push('budgets');
        hasErrors = true;
    }

    // Issue #23 fix: Show user notification on load failures
    if (hasErrors) {
        // Dynamically import showNotification to avoid circular dependency
        try {
            const { showNotification } = await import('./notifications.js');
            showNotification(
                `⚠️ Failed to load some data: ${errors.join(', ')}. Please refresh the page.`,
                'warning',
                8000
            );
        } catch (err) {
            console.error('Could not show notification:', err);
        }
    }
};
