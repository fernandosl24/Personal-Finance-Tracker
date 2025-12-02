-- 1. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- 2. Constraints for Data Integrity
ALTER TABLE transactions
ADD CONSTRAINT check_amount_positive CHECK (amount > 0);

-- 3. Triggers for Automatic Balance Updates

-- Function to handle balance updates
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Case 1: INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.account_id IS NOT NULL THEN
            UPDATE accounts
            SET balance = balance + (
                CASE 
                    WHEN NEW.type = 'income' THEN NEW.amount
                    ELSE -NEW.amount -- Expense or Transfer Out
                END
            )
            WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;

    -- Case 2: DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.account_id IS NOT NULL THEN
            UPDATE accounts
            SET balance = balance - (
                CASE 
                    WHEN OLD.type = 'income' THEN OLD.amount
                    ELSE -OLD.amount -- Reverse the effect
                END
            )
            WHERE id = OLD.account_id;
        END IF;
        RETURN OLD;

    -- Case 3: UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Revert OLD effect
        IF OLD.account_id IS NOT NULL THEN
            UPDATE accounts
            SET balance = balance - (
                CASE 
                    WHEN OLD.type = 'income' THEN OLD.amount
                    ELSE -OLD.amount
                END
            )
            WHERE id = OLD.account_id;
        END IF;

        -- Apply NEW effect
        IF NEW.account_id IS NOT NULL THEN
            UPDATE accounts
            SET balance = balance + (
                CASE 
                    WHEN NEW.type = 'income' THEN NEW.amount
                    ELSE -NEW.amount
                END
            )
            WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create Triggers
DROP TRIGGER IF EXISTS trigger_update_balance ON transactions;

CREATE TRIGGER trigger_update_balance
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_account_balance();
