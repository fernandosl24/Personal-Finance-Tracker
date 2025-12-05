import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';

/**
 * Loads all application data from Supabase.
 */
export const loadData = async () => {
    if (!state.user) return;

    // 1. Fetch Categories
    try {
        const { data: categories, error: catError } = await supabaseClient
            .from('categories')
            .select('*')
            .eq('user_id', state.user.id);

        if (catError) console.error('Error fetching categories:', catError);
        state.categories = categories || [];
    } catch (e) { console.error('Exception fetching categories:', e); }

    // 2. Fetch Accounts
    try {
        const { data: accounts, error: accError } = await supabaseClient
            .from('accounts')
            .select('*')
            .eq('user_id', state.user.id);

        if (accError) console.error('Error fetching accounts:', accError);
        state.accounts = accounts || [];
    } catch (e) { console.error('Exception fetching accounts:', e); }

    // 3. Fetch Transactions
    try {
        const { data: transactions, error: txError } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', state.user.id)
            .order('date', { ascending: false });

        if (txError) console.error('Error fetching transactions:', txError);
        state.transactions = transactions || [];
    } catch (e) { console.error('Exception fetching transactions:', e); }

    // 4. Fetch Goals
    try {
        const { data: goals, error: goalsError } = await supabaseClient
            .from('goals')
            .select('*')
            .eq('user_id', state.user.id);

        if (goalsError) console.error('Error fetching goals:', goalsError);
        state.goals = goals || [];
    } catch (e) { console.error('Exception fetching goals:', e); }

    // 5. Fetch Budgets
    try {
        const { data: budgets, error: budgetsError } = await supabaseClient
            .from('budgets')
            .select('*')
            .eq('user_id', state.user.id);

        if (budgetsError) console.error('Error fetching budgets:', budgetsError);
        state.budgets = budgets || [];
    } catch (e) { console.error('Exception fetching budgets:', e); }
};
