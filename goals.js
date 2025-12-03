/**
 * Renders the Goals view.
 */
export const renderGoals = () => {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem;">
            <div style="font-size: 3rem; color: var(--accent-primary); margin-bottom: 1rem;">
                <i class="fa-solid fa-bullseye"></i>
            </div>
            <h3>Savings Goals</h3>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Set targets for your savings and track your progress.
            </p>
            <div class="badge" style="font-size: 1rem; padding: 0.5rem 1rem; background: rgba(99, 102, 241, 0.1); color: var(--accent-primary);">
                Coming Soon
            </div>
        </div>
    `;
};
