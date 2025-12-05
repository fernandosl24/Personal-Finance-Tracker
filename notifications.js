/**
 * Smart Notifications System
 * Provides budget warnings, goal milestones, and unusual spending alerts
 */

import { state } from './state.js';
import { formatCurrency } from './utils.js';

/**
 * Shows a notification to the user
 */
const showNotification = (message, type = 'info', duration = 5000) => {
    // Remove existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const icons = {
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        danger: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    notification.innerHTML = `
        <div class="notification-content">
            <i class="fa-solid ${icons[type]}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">&times;</button>
    `;

    document.body.appendChild(notification);

    // Close button handler
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.add('notification-fade-out');
        setTimeout(() => notification.remove(), 300);
    });

    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('notification-fade-out');
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
};

/**
 * Checks for budget warnings
 */
export const checkBudgetWarnings = () => {
    if (!state.budgets || state.budgets.length === 0) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    state.budgets.forEach(budget => {
        const spent = state.transactions
            .filter(t =>
                t.category === budget.category &&
                t.type === 'expense' &&
                new Date(t.date) >= startOfMonth
            )
            .reduce((sum, t) => sum + t.amount, 0);

        const percentage = (spent / budget.amount) * 100;

        // Alert if exceeded
        if (percentage >= 100) {
            showNotification(
                `⚠️ Budget Alert: You've exceeded your ${budget.category} budget by ${formatCurrency(spent - budget.amount)}!`,
                'danger',
                7000
            );
        }
        // Warning if approaching limit
        else if (percentage >= 80 && percentage < 100) {
            showNotification(
                `⚠️ Budget Warning: You've used ${percentage.toFixed(0)}% of your ${budget.category} budget.`,
                'warning',
                6000
            );
        }
    });
};

/**
 * Checks for goal milestones
 */
export const checkGoalMilestones = () => {
    if (!state.goals || state.goals.length === 0) return;

    state.goals.forEach(goal => {
        const percentage = (goal.current_amount / goal.target_amount) * 100;

        // Celebrate milestones
        if (percentage >= 100) {
            showNotification(
                `🎉 Congratulations! You've reached your "${goal.name}" goal of ${formatCurrency(goal.target_amount)}!`,
                'success',
                8000
            );
        } else if (percentage >= 75 && percentage < 76) {
            showNotification(
                `🎯 Great progress! You're 75% of the way to your "${goal.name}" goal!`,
                'success',
                6000
            );
        } else if (percentage >= 50 && percentage < 51) {
            showNotification(
                `🎯 Halfway there! You've reached 50% of your "${goal.name}" goal!`,
                'success',
                6000
            );
        } else if (percentage >= 25 && percentage < 26) {
            showNotification(
                `🎯 Good start! You're 25% of the way to your "${goal.name}" goal!`,
                'info',
                5000
            );
        }
    });
};

/**
 * Checks for unusual spending patterns
 */
export const checkUnusualSpending = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calculate this month's spending
    const thisMonthSpending = state.transactions
        .filter(t =>
            t.type === 'expense' &&
            new Date(t.date) >= startOfMonth
        )
        .reduce((sum, t) => sum + t.amount, 0);

    // Calculate last month's spending
    const lastMonthSpending = state.transactions
        .filter(t =>
            t.type === 'expense' &&
            new Date(t.date) >= lastMonth &&
            new Date(t.date) <= endOfLastMonth
        )
        .reduce((sum, t) => sum + t.amount, 0);

    // Alert if spending is significantly higher (50% or more)
    if (lastMonthSpending > 0) {
        const increase = ((thisMonthSpending - lastMonthSpending) / lastMonthSpending) * 100;

        if (increase >= 50) {
            showNotification(
                `📊 Spending Alert: Your spending this month is ${increase.toFixed(0)}% higher than last month!`,
                'warning',
                7000
            );
        }
    }

    // Check for large single transactions (over $500)
    const recentLargeTransactions = state.transactions
        .filter(t =>
            t.type === 'expense' &&
            t.amount >= 500 &&
            new Date(t.date) >= startOfMonth
        );

    if (recentLargeTransactions.length > 0) {
        const total = recentLargeTransactions.reduce((sum, t) => sum + t.amount, 0);
        if (recentLargeTransactions.length === 1) {
            showNotification(
                `💰 Large Transaction: ${formatCurrency(total)} expense recorded this month.`,
                'info',
                5000
            );
        } else {
            showNotification(
                `💰 Large Transactions: ${recentLargeTransactions.length} expenses totaling ${formatCurrency(total)} this month.`,
                'info',
                6000
            );
        }
    }
};

/**
 * Runs all notification checks
 */
export const runNotificationChecks = () => {
    checkBudgetWarnings();
    checkGoalMilestones();
    checkUnusualSpending();
};

// Export showNotification for use in other modules
export { showNotification };
