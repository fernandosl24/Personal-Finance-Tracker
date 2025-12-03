import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { sanitizeInput, validateCategory, getRandomColor } from './utils.js';
import { loadData } from './dataLoader.js';

/**
 * Handles the submission of the category form (Add/Edit).
 * @param {Event} e - The submit event.
 */
export const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('cat-submit-btn');
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
            const oldCategory = state.categories.find(c => c.id == id);

            const { error } = await supabaseClient
                .from('categories')
                .update({ name, type, color_code: color })
                .eq('id', id);

            if (error) throw error;

            // Cascading Update: If name changed, update transactions
            if (oldCategory && oldCategory.name !== name) {
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
    if (!confirm('Delete this category? Associated transactions will be marked as "Uncategorized".')) return;

    try {
        // 1. Get Category Name
        const category = state.categories.find(c => c.id == id);
        if (!category) return;

        // 2. Update Transactions to 'Uncategorized'
        const { error: updateError } = await supabaseClient
            .from('transactions')
            .update({ category: 'Uncategorized' })
            .eq('category', category.name);

        if (updateError) throw updateError;

        // 3. Delete Category
        const { error } = await supabaseClient
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
        loadData();
    } catch (err) {
        console.error('Delete Error:', err);
        alert('Error deleting category: ' + err.message);
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
    const btn = document.getElementById('sync-cat-btn');
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
                <input type="checkbox" class="merge-check" checked data-old="${m.old_name}" data-new="${m.new_name}">
            </td>
            <td>${m.old_name}</td>
            <td><i class="fa-solid fa-arrow-right" style="color: var(--text-secondary);"></i></td>
            <td style="font-weight: 500; color: var(--accent-primary);">${m.new_name}</td>
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
