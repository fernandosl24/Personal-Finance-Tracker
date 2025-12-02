# Personal Finance Tracker

A modern, AI-powered personal finance tracking application built with vanilla JavaScript and Supabase.

## Features

### 💰 Core Finance Management
- **Transactions**: Track Income, Expenses, and Transfers.
- **Accounts**: Manage multiple accounts (Checking, Savings, Credit Card) with real-time balance updates.
- **Budgets**: Set monthly spending limits per category.
- **Goals**: Track progress towards financial goals (e.g., "New Laptop").
- **Dashboard**: Real-time overview of Net Worth, Cash Flow, and Spending Habits.

### 🤖 AI Integration (OpenAI GPT-4o)
- **Smart Import**: Paste text (e.g., "Spent $15 at Starbucks") or upload a receipt image to auto-fill transaction details.
- **AI Audit**: Scan your recent transactions to identify missed transfers or miscategorized items.
- **Configurable**: Choose how many transactions to audit (50, 100, All).

### 📊 Analytics
- **Visual Charts**: Doughnut charts for spending by category.
- **Trends**: Track monthly income vs. expenses.
- **Filters**: Filter by Date Range and Account.

### 🛠️ Data Management
- **CSV Import**: Bulk import transactions from your bank.
- **Export**: Download your data as CSV.
- **Category Management**: Create, Edit, and Delete custom categories.
- **Security**: All data is stored securely in Supabase with Row Level Security (RLS). API keys are stored locally on your device.

## Tech Stack

- **Frontend**: HTML5, CSS3 (Glassmorphism UI), Vanilla JavaScript.
- **Backend**: Supabase (PostgreSQL, Auth, Realtime).
- **AI**: OpenAI API (GPT-4o).
- **Libraries**: Chart.js (Visualization), FontAwesome (Icons).

## Setup & Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/fernandosl24/Personal-Finance-Tracker.git
    cd Personal-Finance-Tracker
    ```

2.  **Supabase Setup**:
    - Create a new project on [Supabase](https://supabase.com/).
    - Run the SQL script found in `supabase_schema.sql` in your Supabase SQL Editor to set up the database tables and security policies.
    - Copy your **Project URL** and **Anon Key**.

3.  **Configuration**:
    - Open `app.js` and replace the placeholder Supabase credentials with your own:
      ```javascript
      const supabaseUrl = 'YOUR_SUPABASE_URL';
      const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
      ```

4.  **Run Locally**:
    - You can use any static file server. For example, with Python:
      ```bash
      python3 -m http.server 8080
      ```
    - Open `http://localhost:8080` in your browser.

5.  **AI Setup**:
    - Go to **Settings** in the app.
    - Enter your **OpenAI API Key** (stored locally).

## Usage Guide

- **Adding Transactions**: Click the "+" button or use "Smart Import" for AI assistance.
- **Editing**: Click the "Pen" icon on any transaction row.
- **Auditing**: Go to Settings -> Start AI Audit to clean up your data.
- **Reset**: Use the "Danger Zone" in Settings to clear all data if needed.

## License

MIT
