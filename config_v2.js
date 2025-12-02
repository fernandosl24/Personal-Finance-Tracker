const SUPABASE_URL = 'https://riqdvzhyrmipurkolrsq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpcWR2emh5cm1pcHVya29scnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTQwNTUsImV4cCI6MjA4MDE5MDA1NX0.0zUqM02xHmOVHCKGiKh9rzkq3VZUt1bFUAqUW7QOWSU';

function initSupabase() {
    if (typeof supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized successfully.');
        // If app.js loaded before us and is waiting, we might need to kickstart it?
        // But app.js waits for DOMContentLoaded usually.
        return true;
    }
    return false;
}

if (!initSupabase()) {
    console.log('Supabase not ready, polling...');
    const checkInterval = setInterval(() => {
        if (initSupabase()) {
            clearInterval(checkInterval);
        }
    }, 100);

    // Safety timeout
    setTimeout(() => clearInterval(checkInterval), 10000);
}
