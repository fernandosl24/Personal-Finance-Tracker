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
// ... existing code ...
