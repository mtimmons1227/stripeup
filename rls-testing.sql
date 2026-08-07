-- RLS Testing Script for StripeUp
-- Run these queries in Supabase SQL Editor to test RLS policies
-- Date: April 2, 2026

-- =====================================================
-- TEST SETUP: Create test data if needed
-- =====================================================

-- Note: These tests assume you have test data in your database
-- Adjust IDs and tokens as needed for your actual data

-- =====================================================
-- TEST 1: Verify RLS is enabled
-- =====================================================

SELECT
  tablename,
  rowsecurity as rls_enabled,
  COUNT(p.policyname) as policies_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN ('tournaments', 'officials', 'available_blocks', 'claims', 'invite_tokens', 'availability')
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- Expected: All tables should show rls_enabled = true and policies_count > 0

-- =====================================================
-- TEST 2: Test helper functions
-- =====================================================

-- Test token validation (replace with real token and tournament ID)
-- SELECT is_valid_token('your-test-token-here', 'your-tournament-uuid-here');

-- Test org assigner check (requires JWT context)
-- SELECT is_assigner_for_org('your-org-uuid-here');

-- =====================================================
-- TEST 3: Test anonymous access (should fail)
-- =====================================================

-- These should return no rows when run without auth context
SELECT COUNT(*) as tournaments_visible FROM tournaments;
SELECT COUNT(*) as officials_visible FROM officials;
SELECT COUNT(*) as blocks_visible FROM available_blocks;
SELECT COUNT(*) as claims_visible FROM claims;
SELECT COUNT(*) as tokens_visible FROM invite_tokens;

-- Expected: All counts should be 0 (no anonymous access)

-- =====================================================
-- TEST 4: Test with service key (admin access)
-- =====================================================

-- When using service key (like in Netlify functions), should see all data
-- This tests that service key bypasses RLS (as intended for server-side operations)

-- =====================================================
-- TEST 5: Simulate assigner access
-- =====================================================

-- To test assigner policies, you would need to:
-- 1. Create a test user with JWT containing org_id
-- 2. Run queries with that auth context
-- 3. Verify only org-specific data is visible

-- Example test queries (run with proper JWT):
-- SELECT * FROM tournaments; -- Should only show org's tournaments
-- SELECT * FROM officials; -- Should only show org's officials
-- SELECT * FROM claims c JOIN tournaments t ON c.tournament_id = t.id; -- Should only show org's claims

-- =====================================================
-- TEST 6: Simulate official access
-- =====================================================

-- To test official policies, you would need to:
-- 1. Create a test user with JWT containing token
-- 2. Run queries with that auth context
-- 3. Verify only token-valid data is visible

-- Example test queries (run with proper JWT):
-- SELECT * FROM tournaments; -- Should only show invited tournaments
-- SELECT * FROM available_blocks; -- Should only show blocks for invited tournaments
-- SELECT * FROM claims; -- Should only show user's own claims

-- =====================================================
-- TEST 7: Integration test checklist
-- =====================================================

-- After implementing RLS, test these user flows:

-- 1. Assigner login and dashboard access
--    - Should see only their org's tournaments and officials
--    - Should be able to create/manage tournaments and officials

-- 2. Official self-scheduling via token
--    - Should only access tournaments with valid, unused tokens
--    - Should only see available blocks for that tournament
--    - Should only create claims for themselves

-- 3. Netlify functions (send-invites, supabase-proxy)
--    - Should work with service key (bypasses RLS)
--    - Should maintain existing functionality

-- 4. Token expiration
--    - Expired tokens should not grant access
--    - Used tokens should not allow duplicate access

-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================

-- If RLS breaks something, you can disable it temporarily:
-- ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE officials DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE available_blocks DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE claims DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE invite_tokens DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE availability DISABLE ROW LEVEL SECURITY;

-- Then drop policies:
-- DROP POLICY IF EXISTS "assigners_manage_own_tournaments" ON tournaments;
-- DROP POLICY IF EXISTS "officials_view_invited_tournaments" ON tournaments;
-- (repeat for all policies...)