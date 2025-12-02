// Chart Rendering Logic

window.renderSpendingChart = (transactions) => {
    const ctx = document.getElementById('spendingChart').getContext('2d');

    // Group expenses by category (Exclude Transfers)
    const expensesByCategory = {};
    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            const cat = t.category || 'Uncategorized';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
        });

    const labels = Object.keys(expensesByCategory);
    const data = Object.values(expensesByCategory);
    const colors = labels.map(l => window.getCategoryColor(l));

    if (labels.length === 0) {
        // Show empty state if no data
        return;
    }

    // Destroy existing chart instance if it exists
    if (window.spendingChartInstance) {
        window.spendingChartInstance.destroy();
    }

    window.spendingChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8' }
                }
            }
        }
    });
};

window.renderAnalyticsCategoryChart = (transactions) => {
    const ctx = document.getElementById('analyticsCategoryChart').getContext('2d');

    const expensesByCategory = {};
    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            const cat = t.category || 'Uncategorized';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
        });

    const labels = Object.keys(expensesByCategory);
    const data = Object.values(expensesByCategory);
    const colors = labels.map(l => window.getCategoryColor(l));

    if (window.analyticsCategoryChartInstance) window.analyticsCategoryChartInstance.destroy();

    window.analyticsCategoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right', labels: { color: '#94a3b8' } }
            }
        }
    });
};

window.renderAnalyticsTrendChart = (transactions) => {
    const ctx = document.getElementById('analyticsTrendChart').getContext('2d');

    // Group by Month (Last 6 Months)
    const months = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        months[key] = { income: 0, expense: 0 };
    }

    transactions.forEach(t => {
        if (t.type === 'transfer') return; // Exclude transfers
        const d = new Date(t.date);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (months[key]) {
            if (t.type === 'income') months[key].income += t.amount;
            else if (t.type === 'expense') months[key].expense += t.amount;
        }
    });

    const labels = Object.keys(months);
    const incomeData = Object.values(months).map(m => m.income);
    const expenseData = Object.values(months).map(m => m.expense);

    if (window.analyticsTrendChartInstance) window.analyticsTrendChartInstance.destroy();

    window.analyticsTrendChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                },
                {
                    label: 'Expense',
                    data: expenseData,
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { labels: { color: '#94a3b8' } }
            }
        }
    });
};

window.renderAnalyticsDailyChart = (transactions) => {
    const ctx = document.getElementById('analyticsDailyChart').getContext('2d');

    // Daily spending for current month
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const dailyData = new Array(daysInMonth).fill(0);

    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            const d = new Date(t.date);
            if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
                dailyData[d.getDate() - 1] += t.amount;
            }
        });

    if (window.analyticsDailyChartInstance) window.analyticsDailyChartInstance.destroy();

    window.analyticsDailyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Daily Spending',
                data: dailyData,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
};
