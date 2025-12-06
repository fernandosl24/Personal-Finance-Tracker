import { supabaseClient } from './supabaseClient.js';
import { state } from './state.js';
import { getRandomColor } from './utils.js';
import { loadData } from './dataLoader.js';
import { saveAuditResults, navigateToAuditResults } from './audit-results.js';

/**
 * Shows the AI audit customization modal
 */
export const startAIAudit = () => {
    showAuditCustomizationModal();
};

/**
 * Shows modal for customizing AI audit parameters
 */
const showAuditCustomizationModal = () => {
    const modal = document.createElement('div');
    modal.id = 'audit-customization-modal';
    modal.className = 'modal';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close-modal" id="close-audit-custom-modal">&times;</span>
            <h2><i class="fa-solid fa-robot"></i> Customize AI Audit</h2>
            
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Optionally provide guidance to help the AI better understand your categorization preferences.
            </p>

            <div class="form-group">
                <label>Custom Instructions (Optional)</label>
                <textarea id="audit-custom-instructions" 
                    placeholder="e.g., 'Categorize all Uber and Lyft as Transportation, not Dining' or 'Group all streaming services under Entertainment'"
                    style="width: 100%; min-height: 120px; padding: 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.95rem; font-family: inherit; resize: vertical;"></textarea>
                <small style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">
                    Leave empty to use default AI analysis
                </small>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Quick Suggestions:</label>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    <button class="btn btn-sm btn-secondary suggestion-chip" data-suggestion="Focus on grouping similar merchants together">
                        <i class="fa-solid fa-store"></i> Group Merchants
                    </button>
                    <button class="btn btn-sm btn-secondary suggestion-chip" data-suggestion="Separate business expenses from personal expenses">
                        <i class="fa-solid fa-briefcase"></i> Business/Personal
                    </button>
                    <button class="btn btn-sm btn-secondary suggestion-chip" data-suggestion="Be more specific with food categories (Groceries vs Dining Out vs Coffee)">
                        <i class="fa-solid fa-utensils"></i> Food Categories
                    </button>
                    <button class="btn btn-sm btn-secondary suggestion-chip" data-suggestion="Categorize subscriptions separately from one-time purchases">
                        <i class="fa-solid fa-repeat"></i> Subscriptions
                    </button>
                </div>
            </div>

            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary" id="cancel-audit-custom-btn" style="flex: 1;">
                    <i class="fa-solid fa-times"></i> Cancel
                </button>
                <button class="btn btn-primary" id="start-audit-custom-btn" style="flex: 1;">
                    <i class="fa-solid fa-play"></i> Start Audit
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Attach listeners
    document.getElementById('close-audit-custom-modal').onclick = () => modal.remove();
    document.getElementById('cancel-audit-custom-btn').onclick = () => modal.remove();

    // Quick suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.onclick = () => {
            const textarea = document.getElementById('audit-custom-instructions');
            const currentText = textarea.value.trim();
            const suggestion = chip.dataset.suggestion;

            if (currentText) {
                textarea.value = currentText + '\n' + suggestion;
            } else {
                textarea.value = suggestion;
            }
        };
    });

    // Start audit button
    document.getElementById('start-audit-custom-btn').onclick = async () => {
        const customInstructions = document.getElementById('audit-custom-instructions').value.trim();
        modal.remove();
        await executeAIAudit(customInstructions);
    };
};

/**
 * Executes the AI audit with optional custom instructions
 * @param {string} customInstructions - Optional user guidance for the AI
 */
const executeAIAudit = async (customInstructions = '') => {
    const openAIKey = localStorage.getItem('openai_api_key');
    if (!openAIKey) {
        alert('Please save your OpenAI API Key in Settings first.');
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

        const updates = await analyzeTransactions(transactionsToAnalyze, customInstructions, (current, total) => {
            const pct = Math.round((current / total) * 100);
            document.getElementById('audit-progress').textContent = `Analyzing ${current} of ${total} transactions...`;
            document.getElementById('audit-bar').style.width = `${pct}%`;
        });

        document.body.removeChild(modal);

        if (updates.length === 0) {
            alert('AI found no issues or improvements!');
        } else {
            // Save audit results to database
            const auditId = await saveAuditResults(updates);

            // Navigate to audit results page
            window.location.hash = '#audit-results';

            // Wait for navigation, then render results
            setTimeout(() => {
                renderAuditResultsPage(updates, {
                    id: auditId,
                    timestamp: new Date().toISOString(),
                    total_suggestions: updates.length,
                    status: 'pending'
                });
            }, 100);
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
 * @param {string} customInstructions - Optional user guidance for the AI.
 * @param {Function} onProgress - Callback for progress updates.
 * @returns {Array} - List of suggested updates.
 */
export const analyzeTransactions = async (transactions, customInstructions = '', onProgress) => {
    const openAIKey = localStorage.getItem('openai_api_key');
    const categories = state.categories.map(c => c.name);
    const BATCH_SIZE = 25;
    const updates = [];  // Fixed: Added missing variable declaration

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

        // Build prompt with optional custom instructions
        let prompt = `
            Audit these transactions. Look for:
            1. Mis-categorization (e.g., "Uber" as "Groceries").
            2. Missing categories ("Uncategorized").
            3. Better category names (standardize).
            4. Transfers (e.g., "Payment to Credit Card" should be type="transfer").
            
            Existing Categories: ${state.categories.map(c => c.name).join(', ')}.
            Prioritize using Existing Categories if they fit. Only suggest new ones if necessary.`;

        if (customInstructions) {
            prompt += `\n\nUser's specific instructions:\n${customInstructions}`;
        }

        prompt += `\n\nReturn JSON with a list of "changes":
            [{ "id": "tx_id", "field": "category|type", "new_value": "...", "reason": "..." }]
            Only include transactions that need changes.
        `;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAIKey} `
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

        // Normalize field names (AI sometimes returns "cat" instead of "category")
        const normalizedChanges = batchChanges.map(change => ({
            ...change,
            field: change.field === 'cat' ? 'category' : change.field
        }));

        updates.push(...normalizedChanges);
    }

    return updates;
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

        const systemPrompt = `Extract transaction details from the user input(text or receipt image).
        Return a JSON object with:
        - "date": YYYY - MM - DD
            - "amount": number
                - "description": string
                    - "category": string(guess from context)
                        - "type": "expense" or "income" or "transfer"
        
        If details are missing, make a best guess or leave empty.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAIKey} `
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
