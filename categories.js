import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { sanitizeInput, validateCategory, getRandomColor } from './utils.js';
import { loadData } from './dataLoader.js';

/**
 * Handles the submission of the category form (Add/Edit).
 * @param {Event} e - The submit event.
 */
export const handleCategorySubmit = async (e, fromSettings = false) => {
    if (e && e.preventDefault) e.preventDefault();

    // If called from Settings page, show a prompt modal
    if (fromSettings) {
        const name = prompt('Enter category name:');
        if (!name) return;

        const type = prompt('Enter type (income/expense/transfer):', 'expense');
        if (!type || !['income', 'expense', 'transfer'].includes(type)) {
            alert('Invalid type. Please use: income, expense, or transfer');
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('categories')
                .insert([{
                    user_id: state.user.id,
                    name: name.trim(),
                    type: type,
                    color_code: getRandomColor()
                }]);

            if (error) throw error;
            alert('Category added!');
            loadData();
        } catch (err) {
            console.error('Category Error:', err);
            alert('Error saving category: ' + err.message);
        }
        return;
    }

    const btn = document.getElementById('cat-submit-btn');
    if (!btn) return;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const id = document.getElementById('cat-id').value;
    const name = sanitizeInput(document.getElementById('cat-name').value.trim());
    const type = document.getElementById('cat-type').value;
    const color = document.getElementById('cat-color').value;

    // Validation
    const validationError = validateCategory({ name });
    if (validationError) {
        alert(validationError);
        btn.disabled = false;
        btn.textContent = originalText;
        return false;
    }

    try {
        if (id) {
            // UPDATE existing category
            const oldCategory = state.categories.find(c => c.id === id);

            const { error } = await supabaseClient
                .from('categories')
                .update({ name, type, color_code: color })
                .eq('id', id);

            if (error) throw error;

            // Cascading Update: If name changed, update transactions
            if (oldCategory && oldCategory.name && oldCategory.name !== name) {
                const { error: cascadeError } = await supabaseClient
                    .from('transactions')
                    .update({ category: name })
                    .eq('category', oldCategory.name);

                if (cascadeError) {
                    console.error('Cascade Update Failed:', cascadeError);
                    alert('Warning: Category updated, but failed to update associated transactions. Please refresh and check your data.');
                }
            }

            alert('Category updated!');
        } else {
            // INSERT new category
            const { error } = await supabaseClient
                .from('categories')
                .insert([{
                    user_id: state.user.id,
                    name,
                    type,
                    color_code: color
                }]);

            if (error) throw error;
            alert('Category added!');
        }

        document.getElementById('category-modal').style.display = 'none';
        document.getElementById('add-category-form').reset();
        document.getElementById('cat-id').value = ''; // Clear ID
        loadData(); // Refresh UI
    } catch (err) {
        console.error('Category Error:', err);
        alert('Error saving category: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
    return false;
};

/**
 * Deletes a category by ID.
 * @param {string} id - The category ID.
 */
export const deleteCategory = async (id) => {
    try {
        // 1. Get Category
        const category = state.categories.find(c => c.id === id);
        if (!category) return;

        // 2. Count affected transactions
        const affectedCount = state.transactions.filter(t => t.category === category.name).length;

        if (affectedCount === 0) {
            // No transactions affected, just delete
            if (!confirm(`Delete category "${category.name}"?`)) return;

            const { error } = await supabaseClient
                .from('categories')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadData();
            return;
        }

        // 3. Show reassignment modal
        showCategoryReassignmentModal(category, affectedCount);

    } catch (err) {
        console.error('Delete Error:', err);
        alert('Error deleting category: ' + err.message);
    }
};

/**
 * Shows modal to reassign transactions before deleting category
 * @param {Object} category - Category to delete
 * @param {number} affectedCount - Number of transactions affected
 */
const showCategoryReassignmentModal = (category, affectedCount) => {
    const modal = document.createElement('div');
    modal.id = 'reassign-modal';
    modal.className = 'modal';

    // Get all other categories plus "Uncategorized" option
    const otherCategories = state.categories
        .filter(c => c.id !== category.id)
        .map(c => c.name)
        .sort();

    const categoryOptions = ['Uncategorized', ...otherCategories];

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <span class="close-modal" id="close-reassign-modal">&times;</span>
            <h2><i class="fa-solid fa-triangle-exclamation" style="color: var(--warning);"></i> Delete Category</h2>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                You are about to delete <strong style="color: var(--text-primary);">"${category.name}"</strong>.
                <br><br>
                This category is used by <strong style="color: var(--accent-primary);">${affectedCount} transaction(s)</strong>.
                <br><br>
                Please select a category to reassign these transactions to:
            </p>
            
            <div class="form-group">
                <label>Reassign transactions to:</label>
                <select id="reassign-category-select" style="width: 100%; padding: 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 1rem;">
                    ${categoryOptions.map(cat => `
                        <option value="${cat}" ${cat === 'Uncategorized' ? 'selected' : ''}>${cat}</option>
                    `).join('')}
                </select>
                <small style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">
                    All ${affectedCount} transaction(s) will be moved to the selected category.
                </small>
            </div>

            <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                <button class="btn btn-secondary" id="cancel-delete-btn" style="flex: 1;">
                    Cancel
                </button>
                <button class="btn btn-danger" id="confirm-delete-btn" style="flex: 1;">
                    <i class="fa-solid fa-trash"></i> Delete Category
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Attach listeners
    document.getElementById('close-reassign-modal').onclick = () => modal.remove();
    document.getElementById('cancel-delete-btn').onclick = () => modal.remove();
    document.getElementById('confirm-delete-btn').onclick = async () => {
        const newCategory = document.getElementById('reassign-category-select').value;
        await executeDeleteCategory(category.id, category.name, newCategory, modal);
    };
};

/**
 * Executes the category deletion with reassignment
 * @param {string} categoryId - Category ID to delete
 * @param {string} categoryName - Category name
 * @param {string} newCategory - Category to reassign transactions to
 * @param {HTMLElement} modal - Modal element to close
 */
const executeDeleteCategory = async (categoryId, categoryName, newCategory, modal) => {
    const btn = document.getElementById('confirm-delete-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Deleting...';

    try {
        // 1. Update Transactions to new category
        const { error: updateError } = await supabaseClient
            .from('transactions')
            .update({ category: newCategory })
            .eq('category', categoryName);

        if (updateError) throw updateError;

        // 2. Delete Category
        const { error } = await supabaseClient
            .from('categories')
            .delete()
            .eq('id', categoryId);

        if (error) throw error;

        modal.remove();
        loadData();

        // Refresh categories list if on settings page
        if (typeof renderCategoriesList === 'function') {
            setTimeout(() => renderCategoriesList(), 500);
        }

    } catch (err) {
        console.error('Delete Error:', err);
        alert('Error deleting category: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

/**
 * Opens the edit modal for a category.
 * @param {string} id - The category ID.
 */
export const editCategory = (id) => {
    const c = state.categories.find(cat => cat.id === id);
    if (!c) return;

    document.getElementById('cat-id').value = c.id;
    document.getElementById('cat-name').value = c.name;
    document.getElementById('cat-type').value = c.type;
    document.getElementById('cat-color').value = c.color_code;

    document.getElementById('cat-submit-btn').textContent = 'Update Category';
    document.getElementById('category-modal').style.display = 'flex';
};

/**
 * Syncs categories from transactions to the categories table.
 */
export const syncCategories = async () => {
    const btn = document.getElementById('sync-categories-btn') || document.getElementById('sync-cat-btn');
    if (!btn) {
        alert('Button not found');
        return;
    }
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Syncing...';

    try {
        // 1. Get all unique categories from transactions
        const txCategories = [...new Set(state.transactions.map(t => t.category))];
        const existingCategories = state.categories.map(c => c.name);

        // 2. Find missing ones
        const missing = txCategories.filter(c => c && c !== 'Uncategorized' && !existingCategories.includes(c));

        if (missing.length === 0) {
            alert('All categories are already synced!');
            return;
        }

        // 3. Insert missing
        const newCats = missing.map(name => ({
            user_id: state.user.id,
            name: name,
            type: 'expense', // Default
            color_code: getRandomColor()
        }));

        const { error } = await supabaseClient
            .from('categories')
            .insert(newCats);

        if (error) throw error;

        alert(`Synced ${missing.length} categories!`);
        loadData();

    } catch (err) {
        console.error('Sync Error:', err);
        alert('Error syncing categories: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

/**
 * Optimizes categories by finding duplicates and synonyms using AI.
 */
export const optimizeCategories = async () => {
    try {
        const openAIKey = localStorage.getItem('openai_api_key');
        if (!openAIKey) throw new Error('Please save your OpenAI API Key first in Settings.');

        // 1. Local Deduplication
        const uniqueNames = new Set();
        const duplicates = [];

        state.categories.forEach(c => {
            const name = c.name.trim();
            const lowerName = name.toLowerCase();
            if (uniqueNames.has(lowerName)) {
                // Found a duplicate!
                duplicates.push({
                    old_name: name,
                    new_name: name, // Merge into itself (deduplicate)
                    reason: 'Duplicate'
                });
            } else {
                uniqueNames.add(lowerName);
            }
        });

        // 2. AI Analysis for Synonyms
        const categories = Array.from(uniqueNames); // Send only unique names to AI
        if (categories.length < 2 && duplicates.length === 0) {
            alert('Your categories are already optimized!');
            return;
        }

        let aiMerges = [];
        if (categories.length >= 2) {
            const prompt = `Analyze this list of categories:
            ${JSON.stringify(categories)}

            Goal: Simplify and group synonyms.
            Examples: 
            - "Uber", "Lyft", "Taxi" -> "Transportation"
            - "Bank Fee", "Bank Charges" -> "Fees"
            - "Groceries", "Supermarket" -> "Groceries"

            Return a JSON object with a key "merges" containing a list of objects:
            { "old_name": "Bank Fee", "new_name": "Fees" }

            Only include categories that should be CHANGED. If a category is fine, do not include it.
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
                        { role: "system", content: "You are a data cleaner. Respond in JSON." },
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
            aiMerges = JSON.parse(data.choices[0].message.content).merges || [];
        }

        const allMerges = [...duplicates, ...aiMerges];

        if (allMerges.length === 0) {
            alert('Your categories are already optimized!');
        } else {
            showMergeReviewModal(allMerges);
        }

    } catch (error) {
        console.error('Optimization Error:', error);
        alert('Optimization failed: ' + error.message);
    }
};

const showMergeReviewModal = (merges) => {
    const modal = document.createElement('div');
    modal.id = 'merge-modal';
    modal.className = 'modal';

    const rows = merges.map((m, i) => `
        <tr>
            <td style="text-align: center;">
                <input type="checkbox" class="merge-check" checked data-old="${sanitizeInput(m.old_name)}" data-new="${sanitizeInput(m.new_name)}">
            </td>
            <td>${sanitizeInput(m.old_name)}</td>
            <td><i class="fa-solid fa-arrow-right" style="color: var(--text-secondary);"></i></td>
            <td style="font-weight: 500; color: var(--accent-primary);">${sanitizeInput(m.new_name)}</td>
        </tr>
    `).join('');

    const modalId = 'merge-modal';

    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" id="close-merge-modal">&times;</span>
            <h2><i class="fa-solid fa-broom"></i> Review Category Merges</h2>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Select the merges you want to apply. This will update all transactions and delete the old categories.
            </p>
            <div style="max-height: 400px; overflow-y: auto; margin-bottom: 1rem;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; color: var(--text-secondary); font-size: 0.9rem;">
                            <th style="padding: 0.5rem;">Apply</th>
                            <th style="padding: 0.5rem;">Old Name</th>
                            <th></th>
                            <th style="padding: 0.5rem;">New Name</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <button class="btn btn-primary btn-block" id="apply-merge-btn">
                Merge Selected
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Attach listeners
    document.getElementById('close-merge-modal').onclick = () => document.getElementById(modalId).remove();
    document.getElementById('apply-merge-btn').onclick = applyCategoryMerges;
};

const applyCategoryMerges = async () => {
    const checks = document.querySelectorAll('.merge-check:checked');
    const mergesToApply = Array.from(checks).map(c => ({
        old_name: c.dataset.old,
        new_name: c.dataset.new
    }));

    if (mergesToApply.length === 0) return;

    const btn = document.querySelector('#merge-modal .btn-primary');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Merging...';

    try {
        let updatedCount = 0;

        for (const merge of mergesToApply) {
            const newName = merge.new_name.trim();
            const oldName = merge.old_name.trim();

            // 1. Ensure New Category Exists (Case-Insensitive Check)
            let newCat = state.categories.find(c => c.name.toLowerCase() === newName.toLowerCase());

            if (!newCat) {
                // Determine type/color from old category or default
                const oldCat = state.categories.find(c => c.name === oldName);

                // Double check DB to avoid race conditions/duplicates
                const { data: existing, error: searchError } = await supabaseClient
                    .from('categories')
                    .select('*')
                    .ilike('name', newName)
                    .eq('user_id', state.user.id);

                if (existing && existing.length > 0) {
                    newCat = existing[0];
                } else {
                    // Insert new
                    const { data, error } = await supabaseClient
                        .from('categories')
                        .insert([{
                            user_id: state.user.id,
                            name: newName,
                            type: oldCat ? oldCat.type : 'expense',
                            color_code: oldCat ? oldCat.color_code : '#94a3b8'
                        }])
                        .select();

                    if (error) throw error;
                    newCat = data[0];
                }
            }

            // 2. Update Transactions
            const { error: txError } = await supabaseClient
                .from('transactions')
                .update({ category: newName })
                .eq('category', oldName);

            if (txError) throw txError;

            // 3. Delete Old Category
            const oldCat = state.categories.find(c => c.name === oldName);
            if (oldCat) {
                await supabaseClient
                    .from('categories')
                    .delete()
                    .eq('id', oldCat.id);
            }

            updatedCount++;
        }

        alert(`Successfully merged ${updatedCount} categories!`);
        document.getElementById('merge-modal').remove();
        window.loadData();

    } catch (error) {
        console.error('Merge Error:', error);
        alert('Error merging categories: ' + error.message);
    } finally {
        if (document.getElementById('merge-modal')) {
            // If modal still exists (error case)
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};
