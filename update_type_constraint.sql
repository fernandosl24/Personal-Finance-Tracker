-- Drop the existing check constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add the updated check constraint including 'transfer'
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('income', 'expense', 'transfer'));
