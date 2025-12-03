import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { getRandomColor } from './utils.js';
import { loadData } from './dataLoader.js';

/**
 * Starts the AI Audit process for transactions.
 */
export const startAIAudit = async () => {
    const openAIKey = localStorage.getItem('openai_api_key');
    if (!openAIKey) {
        alert('Please save your OpenAI API Key first.');
        return;
    }

    const scope = document.getElementById('audit-scope').value;
    let transactionsToAnalyze = state.transactions;

    if (scope !== 'all') {
        transactionsToAnalyze = transactionsToAnalyze.slice(0, parseInt(scope));
    }

    if (transactionsToAnalyze.length === 0) {
        alert('No transactions to audit.');
        return;
    }

    // Find button by text content or ID if possible, but here we rely on the caller or generic selector
    // Since we are removing onclick="startAIAudit()", we assume the button has an ID or we pass it.
    // For now, let's assume the button is passed or we find it.
    // Actually, let's just find the button that triggered this.
    // But since this is an async function called by an event listener, we don't have 'this'.
    // We'll look for the specific button in the settings page.
    const btn = document.getElementById('start-audit-btn');
    const originalText = btn ? btn.innerHTML : 'Start AI Audit';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Auditing...';
    }

    try {
        // Show progress modal
        const modal = document.createElement('div');
        modal.id = 'audit-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>AI Audit in Progress</h2>
                <div id="audit-progress" style="margin: 1rem 0; color: var(--text-secondary);">Starting...</div>
                <div style="width: 100%; background: var(--bg-body); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div id="audit-bar" style="width: 0%; height: 100%; background: var(--accent-primary); transition: width 0.3s;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';

        const updates = await analyzeTransactions(transactionsToAnalyze, (current, total) => {
            const pct = Math.round((current / total) * 100);
            document.getElementById('audit-progress').textContent = `Analyzing ${current} of ${total} transactions...`;
            document.getElementById('audit-bar').style.width = `${pct}%`;
        });

        document.body.removeChild(modal);

        if (updates.length === 0) {
            alert('AI found no issues or improvements!');
        } else {
            showAuditResults(updates);
        }

    } catch (error) {
        console.error('Audit Error:', error);
        alert('Audit failed: ' + error.message);
        if (document.getElementById('audit-modal')) document.body.removeChild(document.getElementById('audit-modal'));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

/**
 * Analyzes a list of transactions using OpenAI.
 * @param {Array} transactions - List of transactions.
 * @param {Function} onProgress - Callback for progress updates.
 * @returns {Array} - List of suggested updates.
 */
export const analyzeTransactions = async (transactions, onProgress) => {
    const BATCH_SIZE = 25;
    const updates = [];
    const openAIKey = localStorage.getItem('openai_api_key');

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        if (onProgress) onProgress(i + 1, transactions.length);

        // Prepare payload (minimal data to save tokens)
        const payload = batch.map(t => ({
            id: t.id,
            date: t.date,
            desc: t.description,
            amount: t.amount,
            cat: t.category,
            type: t.type,
            acc: state.accounts.find(a => a.id == t.account_id)?.name || 'Unknown'
        }));

        const prompt = `
            Audit these transactions. Look for:
            1. Mis-categorization (e.g., "Uber" as "Groceries").
            2. Missing categories ("Uncategorized").
            3. Better category names (standardize).
            4. Transfers (e.g., "Payment to Credit Card" should be type="transfer").
            
            Existing Categories: ${state.categories.map(c => c.name).join(', ')}.
            Prioritize using Existing Categories if they fit. Only suggest new ones if necessary.

            Return JSON with a list of "changes":
            [{ "id": "tx_id", "field": "category|type", "new_value": "...", "reason": "..." }]
            Only include transactions that need changes.
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
                    { role: "system", content: "You are a strict financial auditor. Respond in JSON." },
                    { role: "user", content: prompt + "\nData: " + JSON.stringify(payload) }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) throw new Error('OpenAI API Error');
        const data = await response.json();
        const batchChanges = JSON.parse(data.choices[0].message.content).changes || [];
        updates.push(...batchChanges);
    }

    return updates;
};

/**
 * Shows the audit results in a modal.
 * @param {Array} updates - List of suggested updates.
 */
export const showAuditResults = (updates) => {
    const modal = document.createElement('div');
    modal.id = 'audit-results-modal';
    modal.className = 'modal';

    const rows = updates.map(u => {
        const tx = state.transactions.find(t => t.id === u.id);
        if (!tx) return '';
        return `
            <tr>
                <td>${tx.description}</td>
                <td>${u.field}</td>
                <td style="color: var(--danger); text-decoration: line-through;">${u.field === 'category' ? tx.category : tx.type}</td>
                <td style="color: var(--success); font-weight: 500;">${u.new_value}</td>
                <td><small>${u.reason}</small></td>
                <td style="text-align: center;">
                    <input type="checkbox" class="audit-check" checked data-id="${u.id}" data-field="${u.field}" data-value="${u.new_value}">
                </td>
            </tr>
        `;
    }).join('');

    const modalId = 'audit-results-modal';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <span class="close-modal" id="close-audit-modal">&times;</span>
            <h2>Audit Results</h2>
            <p>Found ${updates.length} suggested improvements.</p>
            <div style="max-height: 400px; overflow-y: auto; margin-bottom: 1rem;">
                <table class="transaction-table">
                    <thead>
                        <tr>
                            <th>Transaction</th>
                            <th>Field</th>
                            <th>Old</th>
                            <th>New</th>
                            <th>Reason</th>
                            <th>Apply</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <button class="btn btn-primary btn-block" id="apply-audit-btn">Apply Selected Changes</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Attach listeners
    document.getElementById('close-audit-modal').onclick = () => document.getElementById(modalId).remove();
    document.getElementById('apply-audit-btn').onclick = applyAuditChanges;
};

/**
 * Applies the selected audit changes.
 */
export const applyAuditChanges = async () => {
    const checks = document.querySelectorAll('.audit-check:checked');
    const changes = Array.from(checks).map(c => ({
        id: c.dataset.id,
        field: c.dataset.field,
        value: c.dataset.value
    }));

    if (changes.length === 0) return;

    const btn = document.querySelector('#audit-results-modal .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Applying...';

    try {
        // 1. Check for new categories to create
        const newCategories = new Set();
        changes.forEach(c => {
            if (c.field === 'category') {
                const exists = state.categories.some(cat => cat.name.toLowerCase() === c.value.toLowerCase());
                if (!exists) newCategories.add(c.value);
            }
        });

        for (const catName of newCategories) {
            await supabaseClient.from('categories').insert([{
                user_id: state.user.id,
                name: catName,
                type: 'expense',
                color_code: getRandomColor()
            }]);
        }

        // 2. Apply updates
        for (const change of changes) {
            const update = {};
            update[change.field] = change.value;

            await supabaseClient
                .from('transactions')
                .update(update)
                .eq('id', change.id);
        }

        alert(`Applied ${changes.length} changes!`);
        document.getElementById('audit-results-modal').remove();
        loadData();

    } catch (error) {
        console.error('Apply Error:', error);
        alert('Error applying changes: ' + error.message);
    }
};

/**
 * Processes the Smart Import (Text/Image) using AI.
 */
export const processSmartImport = async () => {
    const openAIKey = localStorage.getItem('openai_api_key');
    if (!openAIKey) {
        alert('Please save your OpenAI API Key first in Settings.');
        return;
    }

    const textInput = document.getElementById('ai-text-input').value;
    const imageInput = document.getElementById('ai-image-input').files[0];

    if (!textInput && !imageInput) {
        alert('Please provide text or an image.');
        return;
    }

    const btn = document.getElementById('smart-import-btn');
    const originalText = btn ? btn.innerHTML : 'Analyze';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';
    }

    try {
        let userContent = [];

        if (textInput) {
            userContent.push({ type: "text", text: textInput });
        }

        if (imageInput) {
            const base64Image = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageInput);
            });
            userContent.push({
                type: "image_url",
                image_url: {
                    url: base64Image
                }
            });
        }

        const systemPrompt = `Extract transaction details from the user input (text or receipt image).
        Return a JSON object with:
        - "date": YYYY-MM-DD
        - "amount": number
        - "description": string
        - "category": string (guess from context)
        - "type": "expense" or "income" or "transfer"
        
        If details are missing, make a best guess or leave empty.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAIKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) throw new Error('OpenAI API Error');
        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);

        // Pre-fill Modal
        document.getElementById('smart-import-modal').style.display = 'none';
        document.getElementById('transaction-modal').style.display = 'flex';

        if (result.date) document.getElementById('t-date').value = result.date;
        if (result.amount) document.getElementById('t-amount').value = result.amount;
        if (result.description) document.getElementById('t-desc').value = result.description;
        if (result.type) document.getElementById('t-type').value = result.type.toLowerCase();
        if (result.category) document.getElementById('t-category').value = result.category;

        // Auto-select category if exists, else add to dropdown temporarily
        // (For now, we just set value, user might need to add it if it's new)

    } catch (error) {
        console.error('Smart Import Error:', error);
        alert('Smart Import failed: ' + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};
