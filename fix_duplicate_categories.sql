-- 1. Standardize names (trim whitespace)
UPDATE categories SET name = TRIM(name);

-- 2. Identify and Merge Duplicates
-- This is a complex operation in SQL. We'll do it in steps.

-- Create a temporary table to map old IDs to new IDs (the one we keep)
CREATE TEMP TABLE category_merges AS
SELECT 
    c1.id as old_id,
    (
        SELECT c2.id 
        FROM categories c2 
        WHERE LOWER(c2.name) = LOWER(c1.name) 
          AND c2.user_id = c1.user_id 
        ORDER BY c2.id ASC 
        LIMIT 1
    ) as new_id
FROM categories c1;

-- Update transactions to point to the 'kept' category name (since we store name, not ID in transactions currently, but we should ensure consistency)
-- Actually, the current app stores category NAME in transactions, not ID. 
-- So the issue is just multiple rows in 'categories' table with same name.

-- Delete duplicates from categories table, keeping the one with the lowest ID
DELETE FROM categories
WHERE id NOT IN (
    SELECT MIN(id)
    FROM categories
    GROUP BY user_id, LOWER(name)
);

-- 3. Add Unique Constraint
ALTER TABLE categories ADD CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name);
