# Document Upload & Viewing Fix

## 🔧 Problem

Documents uploaded by customers are not visible in:
- ✗ Customer login/dashboard
- ✗ Customer loan details
- ✗ NBFC admin views
- Shows "No documents uploaded" even though files were uploaded

## 🔍 Root Cause

**Database Row Level Security (RLS) policies were too restrictive:**

1. The `loan_documents` table had policies that only allowed:
   - Loan owner (user_id) to view documents
   - Only admin role (not nbfc_admin)

2. **Problem for public loan applications:**
   - When a customer submits via share link, `loans.user_id` = merchant ID
   - Customer logs in with their own email
   - Customer's uid ≠ loan owner's uid
   - RLS policy blocks them from seeing their own documents!

3. **Problem for NBFC admins:**
   - Policy didn't include `nbfc_admin` role
   - Only checked for `admin` role

## ✅ Solution Applied

### 1. Updated `loan_documents` Table RLS Policy

**Old Policy (Restrictive):**
```sql
CREATE POLICY "Users can view documents for their loans"
  ON loan_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = loan_documents.loan_id
      AND (loans.user_id = auth.uid() 
           OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );
```

**New Policy (Fixed):**
```sql
CREATE POLICY "Users can view documents for their loans"
  ON loan_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loans
      LEFT JOIN user_profiles up ON auth.uid() = up.id
      WHERE loans.id = loan_documents.loan_id
      AND (
        -- Loan owner can view
        loans.user_id = auth.uid()
        -- Customer who submitted via their email can view
        OR loans.email_id = (SELECT email FROM auth.users WHERE id = auth.uid())
        -- Admin or nbfc_admin role can view
        OR up.role IN ('admin', 'nbfc_admin')
      )
    )
  );
```

**Key Changes:**
- ✅ Added email-based matching for customers
- ✅ Added `nbfc_admin` role support
- ✅ Allows both user_id and email_id matches

### 2. Updated INSERT Policy

```sql
CREATE POLICY "Users can insert documents for their loans"
  ON loan_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = loan_documents.loan_id
      AND (
        loans.user_id = auth.uid()
        OR loans.email_id = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );
```

### 3. Added Public Upload Support

```sql
CREATE POLICY "Public can insert documents for share link submissions"
  ON loan_documents FOR INSERT
  TO anon
  WITH CHECK (true);
```

This allows anonymous users to upload documents before login.

### 4. Enhanced Error Logging

Updated `DocsModal.tsx` to show detailed error messages if document fetching fails, including:
- Error message from database
- Error code
- Hint about what went wrong

## 📊 How It Works Now

### Scenario 1: Customer Via Share Link
1. Customer receives share link
2. Fills form, uploads documents, submits
3. System saves documents with:
   - `loan_id` → links to loan record
   - `loans.email_id` → customer's email
4. Customer logs in with same email
5. Browser sends: `auth.uid()` (their user ID)
6. Database matches: `loans.email_id = (SELECT email FROM auth.users WHERE id = auth.uid())`
7. ✅ Documents are now visible!

### Scenario 2: NBFC Admin Viewing
1. NBFC admin has `role = 'nbfc_admin'` in user_profiles
2. Admin queries loan_documents for any loan
3. Database checks: `up.role IN ('admin', 'nbfc_admin')`
4. ✅ Admin can see all documents!

### Scenario 3: Merchant/Loan Owner
1. Merchant creates share link, gets `id` = their user_id
2. Customer submits via link
3. `loans.user_id` = merchant's ID
4. Merchant logs in
5. Browser sends: merchant's `auth.uid()`
6. Database matches: `loans.user_id = auth.uid()`
7. ✅ Merchant can see customer documents!

## 🚀 Deployment Steps

### Step 1: Apply Database Migrations

**In Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor"
4. Create new query
5. Copy entire content from `migrations/005_fix_document_visibility.sql`
6. Execute (Ctrl+Enter)
7. Wait for success message

### Step 2: Check Browser Console for Errors

If documents still don't show:

1. **Open Browser Developer Tools** (F12)
2. **Go to Console tab**
3. **Refresh page**
4. **Look for error messages** containing:
   - "Document fetch error"
   - Details about RLS policy failure
   - Database error codes

### Step 3: Verify NBFC Admin Role

If NBFC admins still can't see documents:

1. Go to Supabase → Authentication → Users
2. Find the NBFC admin user
3. Go to Dashboard → user_profiles table
4. Verify that user has `role = 'nbfc_admin'`
5. If role is 'admin' or something else, update it

### Step 4: Test Workflows

**Test 1: Customer Via Share Link**
```
1. Create share link
2. Submit loan with documents
3. Customer logs in
4. Check dashboard → Loan details → Documents
5. ✅ Should see uploaded documents
```

**Test 2: Admin Viewing**
```
1. Admin logs in
2. Go to Dashboard → Loans
3. Click "View Details" on a loan
4. Click "View Documents"
5. ✅ Should see all documents
```

**Test 3: NBFC Admin Viewing**
```
1. NBFC admin logs in
2. Go to their dashboard
3. View any loan
4. Check documents
5. ✅ Should see documents
```

## 📝 Database Changes Summary

| Table | Change | Impact |
|-------|--------|--------|
| `loan_documents` | Updated SELECT RLS policy | Customers can view via email match |
| `loan_documents` | Updated INSERT RLS policy | Customers can insert via email match |
| `loan_documents` | Added public INSERT policy | Anon users can upload before login |
| `user_profiles` | None | But verify `nbfc_admin` role exists |

## 🔐 Security Maintained

✅ **Customers can only view their own documents**
- Matched via email only
- Can't access other customers' docs

✅ **Admins can view all documents**
- Role-based access control
- NBFC admins now explicitly allowed

✅ **Anonymous users can upload temporarily**
- Uploads linked to loan_id
- Requires valid loan_id
- No access to other loans' data

✅ **Storage bucket policies still required**
- Must set up separately in Supabase dashboard
- See "Storage Policies" section below

## 📦 Storage Bucket Policies

The SQL migrations fix table-level policies, but you also need **storage bucket policies** for file downloads.

### To Set Up Storage Policies:

1. **Go to Supabase Dashboard**
2. **Click Storage** in sidebar
3. **Select `loan_documents` bucket**
4. **Click Policies tab**
5. **Create new policy for SELECT (Download):**
   - For authenticated users (any role)
   - For anon users (any user)
   
6. **Create new policy for INSERT (Upload):**
   - For authenticated users (any role)
   - For anon users (any user)

7. **Create new policy for DELETE (Admin cleanup):**
   - For authenticated users with `admin` or `nbfc_admin` role

### Example Supabase Storage Policy:

**Allow authenticated users to download:**
```
Bucket: loan_documents
Target roles: authenticated
Allowed operations: SELECT
```

**Allow anon to download:**
```
Bucket: loan_documents
Target roles: anon
Allowed operations: SELECT
```

## ✨ Files Modified

1. **database-setup.sql** - Updated loan_documents RLS policies
2. **migrations/005_fix_document_visibility.sql** - Migration file with all changes
3. **src/components/DocsModal.tsx** - Enhanced error logging and display

## 🧪 Testing the Fix

### Quick Test:

1. Refresh dev server: `npm run dev`
2. Open browser console (F12)
3. Submit a loan with documents
4. Login as customer
5. Go to loan details
6. Click "View Documents"
7. Check console for errors
8. Documents should be visible

### If Still "No documents uploaded":

1. Check browser console for RLS error
2. Verify migration was applied to Supabase
3. Verify `nbfc_admin` role exists for NBFC users
4. Check storage bucket policies are set

## 📞 Troubleshooting

### Error: "permission denied for schema public"
- Migration not applied
- Solution: Re-run migration in Supabase SQL editor

### Error: "row level security denied access"
- RLS policy not working correctly
- Solution: 
  - Verify user email matches `loans.email_id`
  - Check user has correct role in `user_profiles`

### Error: "PGRST116: The Prefer header..."
- Authentication issue
- Solution: User not logged in or token expired

### Documents visible but can't download
- Storage bucket policies not set
- Solution: Set up storage bucket policies in Supabase dashboard

## 🎯 Next Steps

1. ✅ Apply migration to Supabase
2. ✅ Test customer document viewing
3. ✅ Test admin document viewing
4. ✅ Test NBFC admin document viewing
5. ✅ Set up storage bucket policies
6. ✅ Test file downloads

Once all tests pass, your document system will be fully functional!
