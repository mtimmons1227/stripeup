# RLS Implementation Guide for StripeUp

## Overview
This guide covers implementing Row Level Security (RLS) policies for the StripeUp database to ensure proper data isolation between organizations and secure access control.

## Files
- `rls-policies.sql` - SQL commands to enable RLS and create policies
- `rls-testing.sql` - Test queries to verify RLS functionality
- Updated `self-schedule.html` - Modified to pass authentication tokens

## Implementation Steps

### 1. Backup Your Database
Before enabling RLS, create a backup of your Supabase database in case you need to rollback.

### 2. Run the RLS Policies
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `rls-policies.sql`
4. Execute the script

This will:
- Enable RLS on all tables
- Create helper functions
- Define policies for assigners and officials

### 3. Test the Implementation
1. Run the test queries from `rls-testing.sql` in SQL Editor
2. Verify that:
   - RLS is enabled on all tables
   - Anonymous queries return no data
   - Service key queries work (for Netlify functions)

### 4. Test User Flows
1. **Assigner Dashboard**: Login and verify you only see your org's data
2. **Self-Scheduling**: Use an invite token link and verify access works
3. **Netlify Functions**: Test sending invites and other server operations

### 5. Update CLAUDE.md
After successful testing, update the project memory:
- Change "RLS disabled — re-enable before public launch ⚠️" to "RLS policies implemented ✅ April 2, 2026"

## Key Changes Made

### Database Policies
- **Assigners**: Can only access data for their `org_id` (from JWT)
- **Officials**: Can only access tournaments with valid, unused tokens
- **Anonymous**: No direct database access
- **Service Key**: Bypasses RLS (for server-side operations)

### Client Code Updates
- `self-schedule.html`: Now passes invite tokens in Authorization header for RLS authentication
- Maintains backward compatibility with legacy signup codes

## Security Model

### Assigner Access
- JWT contains `org_id` claim
- Can manage tournaments, officials, and blocks for their organization
- Can view all claims and invite tokens for their org

### Official Access
- Uses invite tokens for authentication
- Can only view/access tournaments they were invited to
- Can only create claims for themselves
- Tokens expire and can only be used once

### Server-Side Access
- Netlify functions use service key (bypasses RLS)
- Maintains full administrative access for backend operations

## Troubleshooting

### If Access is Blocked
1. Check that JWT contains correct claims (`org_id` for assigners, `token` for officials)
2. Verify token validity (not used, not expired)
3. Check Supabase logs for policy violations

### To Temporarily Disable RLS
If you need to rollback:
```sql
ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE officials DISABLE ROW LEVEL SECURITY;
-- Repeat for all tables
```

### Common Issues
- **No data visible**: Check authentication context and JWT claims
- **Token access fails**: Verify token exists and is valid
- **Server functions fail**: Ensure service key is correct

## Next Steps After RLS
1. Test all user flows thoroughly
2. Monitor Supabase logs for any policy violations
3. Consider implementing additional security measures (rate limiting, etc.)
4. Plan for production deployment with RLS enabled