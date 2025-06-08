-- clear_data.sql
-- Deletes all data from the specified tables in your D1 database.
-- WARNING: This action is irreversible.

DELETE FROM result_items;
DELETE FROM aggregated_results;
DELETE FROM user_preferences;
DELETE FROM search_history;

-- The following line will delete your search engine seed data (Google, Brave, Serper).
-- If you want to keep this seed data, leave this line commented out or remove it.
-- DELETE FROM search_engines;

-- Vacuum the database to reclaim space (optional, but good practice after large deletes)
-- VACUUM; 