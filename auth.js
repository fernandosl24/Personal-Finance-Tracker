// Authentication Logic

/**
 * Handles user sign up.
 * @param {Event} e - The submit event.
 */
window.handleSignUp = async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value;

    // Validation
    const validationError = window.validatePassword(password);
    if (validationError) {
        alert(validationError);
        return;
    }

    try {
        // 1. Sign Up
        const { data, error } = await window.supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { full_name: name }
            }
        });

        if (error) throw error;

        // 2. Create User Profile in 'users' table
        if (data.user) {
            const { error: profileError } = await window.supabaseClient
                .from('users')
                .insert([{
                    id: data.user.id,
                    email: email,
                    full_name: name,
                    currency_preference: 'USD'
                }]);

            if (profileError) console.error('Profile creation error:', profileError);
        }

        alert('Sign up successful! Please check your email to verify your account.');
        window.navigateTo('login');
    } catch (error) {
        alert('Error signing up: ' + error.message);
    }
};

/**
 * Handles user login.
 * @param {Event} e - The submit event.
 */
window.handleLogin = async (e) => {
    console.log('handleLogin called');
    if (e) {
        e.preventDefault();
        console.log('Default prevented');
    }
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    console.log('Credentials retrieved:', email, '***');

    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // State will be updated by onAuthStateChange listener in app.js
        window.navigateTo('dashboard');
    } catch (error) {
        alert('Error logging in: ' + error.message);
    }
};

/**
 * Handles user logout.
 */
window.handleLogout = async () => {
    try {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;
        window.navigateTo('login');
    } catch (error) {
        alert('Error logging out: ' + error.message);
    }
};
