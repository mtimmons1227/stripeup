-- RLS Policies Implementation for StripeUp
-- Run these commands in Supabase SQL Editor in order
-- Date: April 2, 2026

-- =====================================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- =====================================================

-- Enable RLS on all tables (currently disabled)
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE officials ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: HELPER FUNCTIONS
-- =====================================================

-- Function to validate invite tokens
CREATE OR REPLACE FUNCTION is_valid_token(token_param text, tournament_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM invite_tokens
    WHERE token = token_param
      AND tournament_id = tournament_id_param
      AND used = false
      AND expires_at > now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is assigner for org
CREATE OR REPLACE FUNCTION is_assigner_for_org(org_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() ->> 'org_id') = org_id_param::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 3: POLICIES FOR TOURNAMENTS TABLE
-- =====================================================

-- Assigners can manage their org's tournaments
CREATE POLICY "assigners_manage_own_tournaments" ON tournaments
  FOR ALL USING (
    auth.jwt() ->> 'org_id' = org_id::text
  );

-- Officials can view tournaments they have valid tokens for
CREATE POLICY "officials_view_invited_tournaments" ON tournaments
  FOR SELECT USING (
    is_valid_token(auth.jwt() ->> 'token', id)
  );

-- Allow access to tournaments by signup_code (for legacy links)
CREATE POLICY "allow_signup_code_access" ON tournaments
  FOR SELECT USING (
    signup_code IS NOT NULL AND scheduling_mode = 'self'
  );

-- =====================================================
-- STEP 4: POLICIES FOR OFFICIALS TABLE
-- =====================================================

-- Assigners can manage officials in their org
CREATE POLICY "assigners_manage_org_officials" ON officials
  FOR ALL USING (
    auth.jwt() ->> 'org_id' = org_id::text
  );

-- Officials can view and update their own profile
CREATE POLICY "officials_manage_self" ON officials
  FOR ALL USING (
    auth.uid()::text = id::text
  );

-- =====================================================
-- STEP 5: POLICIES FOR AVAILABLE_BLOCKS TABLE
-- =====================================================

-- Assigners can manage blocks for their org's tournaments
CREATE POLICY "assigners_manage_blocks" ON available_blocks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = available_blocks.tournament_id
        AND tournaments.org_id::text = auth.jwt() ->> 'org_id'
    )
  );

-- Officials can view and update blocks for tournaments they have valid tokens for
CREATE POLICY "officials_access_blocks_via_token" ON available_blocks
  FOR ALL USING (
    is_valid_token(auth.jwt() ->> 'token', tournament_id)
  );

-- Allow access to blocks for tournaments with signup codes
CREATE POLICY "allow_blocks_signup_code_access" ON available_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = available_blocks.tournament_id
        AND tournaments.signup_code IS NOT NULL
        AND tournaments.scheduling_mode = 'self'
    )
  );

-- =====================================================
-- STEP 6: POLICIES FOR CLAIMS TABLE
-- =====================================================

-- Assigners can view/manage all claims for their org's tournaments
CREATE POLICY "assigners_manage_claims" ON claims
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = claims.tournament_id
        AND tournaments.org_id::text = auth.jwt() ->> 'org_id'
    )
  );

-- Officials can manage their own claims for valid tokens
CREATE POLICY "officials_manage_own_claims" ON claims
  FOR ALL USING (
    official_id::text = auth.uid()::text
    AND is_valid_token(auth.jwt() ->> 'token', tournament_id)
  );

-- =====================================================
-- STEP 7: POLICIES FOR INVITE_TOKENS TABLE
-- =====================================================

-- Assigners can manage tokens for their org's officials
CREATE POLICY "assigners_manage_tokens" ON invite_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM officials
      WHERE officials.id = invite_tokens.official_id
        AND officials.org_id::text = auth.jwt() ->> 'org_id'
    )
  );

-- Officials can view and update their own tokens
CREATE POLICY "officials_access_own_tokens" ON invite_tokens
  FOR ALL USING (
    official_id::text = auth.uid()::text
  );

-- =====================================================
-- STEP 8: POLICIES FOR AVAILABILITY TABLE
-- =====================================================

-- Assigners can view availability for their org's officials
CREATE POLICY "assigners_view_org_availability" ON availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM officials
      WHERE officials.id = availability.official_id
        AND officials.org_id::text = auth.jwt() ->> 'org_id'
    )
  );

-- Officials can manage their own availability
CREATE POLICY "officials_manage_own_availability" ON availability
  FOR ALL USING (
    official_id::text = auth.uid()::text
  );

-- =====================================================
-- STEP 9: VERIFICATION QUERIES
-- =====================================================

-- Test queries to verify policies work (run after implementation)
-- These should return appropriate restricted results based on auth context

-- Check RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tournaments', 'officials', 'available_blocks', 'claims', 'invite_tokens', 'availability')
ORDER BY tablename;

-- Count policies per table
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tournaments', 'officials', 'available_blocks', 'claims', 'invite_tokens', 'availability')
GROUP BY schemaname, tablename
ORDER BY tablename;