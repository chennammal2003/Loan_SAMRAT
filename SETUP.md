# Merchant and Admin Loan Application System - Setup Guide

## Overview
A complete full-stack loan application system built with React, TypeScript, Supabase, and Tailwind CSS. Features role-based access for merchants and admins with comprehensive loan management capabilities.

## Features

### Authentication
- Email/password sign-in and sign-up
- Role-based access (Merchant/Admin)
- Password reset functionality
- Secure session management

### Merchant Features
- Apply for loans with 6-step form
- View all loan applications and their status
- Product information display
- Dashboard with charts and statistics

### Admin Features
- Manage all loan applications
- Accept/reject loans with confirmation
- View accepted loans separately
- View merchant details
- Comprehensive dashboard with analytics

### Technical Features
- Multi-step loan application with validation
- File uploads to Supabase Storage
- Light/Dark theme toggle
- Responsive design
- Real-time status updates
- Charts and visualizations (Pie chart, Bar chart)

## Prerequisites
- Node.js 18+ installed
- A Supabase account
- Git (optional)

## Setup Instructions

### 1. Database Setup

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `database-setup.sql`
4. Paste and run the SQL script

This will create:
- `user_profiles` table
- `loans` table
- `loan_documents` table
- All necessary RLS policies
- Indexes for performance

### 2. Storage Setup

1. Go to Supabase Dashboard > Storage
2. Click "New Bucket"
3. Create a bucket named: `loan_documents`
4. Settings:
   - Public: **No** (Private)
   - File size limit: 5MB
   - Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`

5. Add Storage Policies:
   Go to Storage > loan_documents > Policies

   **SELECT Policy:**
   ```sql
   CREATE POLICY "Users can view own documents"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (
     bucket_id = 'loan_documents' AND
     (
       auth.uid()::text = (storage.foldername(name))[1] OR
       EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
     )
   );
   ```

   **INSERT Policy:**
   ```sql
   CREATE POLICY "Users can upload own documents"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'loan_documents' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

### 3. Environment Variables

Your `.env` file is already configured:
```
VITE_SUPABASE_URL=https://avgukfundhsvkzwqteqm.supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Usage Guide

### Creating Users

#### Merchant Account
1. Go to Sign Up page
2. Enter:
   - Username (e.g., "john_merchant")
   - Email
   - Password
   - Select Role: **Merchant**
3. Sign up and login

#### Admin Account
1. Go to Sign Up page
2. Enter:
   - Username (e.g., "admin_user")
   - Email
   - Password
   - Select Role: **Admin**
3. Sign up and login

### Merchant Workflow

1. **Apply for Loan**
   - Click "Apply Loan" in sidebar
   - Complete 6 steps:
     1. Loan Details (amount, tenure, scheme)
     2. Personal Details (name, DOB, ID proofs)
     3. Contact & Address
     4. References (2 required)
     5. Documents (upload 6 documents)
     6. Declaration (accept and submit)

2. **View Loans**
   - Click "Loan Details" to see all applications
   - Check status (Pending/Accepted/Rejected)
   - Click "View Details" for full information

3. **Dashboard**
   - View statistics
   - See charts (Pie chart for status, Bar chart for monthly trends)

### Admin Workflow

1. **Manage Loans**
   - View all loan applications
   - Click "View" to see full details
   - Accept or Reject pending applications
   - Confirm action in popup dialog

2. **Accepted Loans**
   - View all approved loans
   - Check loan details anytime

3. **Merchant Details**
   - View all registered merchants
   - See registration dates and contact info

4. **Dashboard**
   - System-wide statistics
   - Charts showing all loans across system

## Validation Rules

### Personal Details
- Aadhaar: 12 digits
- PAN: Format ABCDE1234F
- Mobile: 10 digits starting with 6-9
- PIN Code: 6 digits

### Loan Details
- Amounts: ₹60,000 / ₹65,000 / ₹70,000
- Tenure: 3, 6, 9, or 12 months
- Processing Fee: Auto-calculated (3% + GST)

### Documents
- All documents required
- Max file size: 5MB
- Formats: PDF, JPG, PNG

### Unique Constraint
- Each merchant can only submit one loan per First Name + Last Name combination

## Theme Toggle

Click the sun/moon icon in the top right to switch between light and dark themes. Theme preference is saved to local storage.

## Troubleshooting

### Database Errors
- Ensure all SQL scripts ran successfully
- Check RLS policies are enabled
- Verify foreign key relationships

### Storage Errors
- Confirm bucket `loan_documents` exists
- Check storage policies are set correctly
- Verify file size limits

### Build Errors
```bash
npm run build
```
Should complete without errors

### Type Errors
```bash
npm run typecheck
```
Should pass without errors

## Project Structure

```
src/
├── components/          # React components
│   ├── loan-steps/     # 6-step loan form
│   ├── AdminDashboard.tsx
│   ├── MerchantDashboard.tsx
│   └── ...
├── contexts/           # React contexts
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── lib/                # Utilities
│   └── supabase.ts
├── pages/              # Auth pages
│   ├── SignIn.tsx
│   ├── SignUp.tsx
│   ├── ForgotPassword.tsx
│   └── ResetPassword.tsx
└── App.tsx             # Main app with routing
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, Dark mode support
- **Backend:** Supabase (Auth, Database, Storage)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Routing:** React Router v6

## Security Features

- Row Level Security (RLS) on all tables
- Private storage bucket
- Role-based access control
- Secure authentication
- Input validation
- File type and size restrictions

## Support

For issues or questions about setup, check:
1. Supabase Dashboard logs
2. Browser console for errors
3. Network tab for API calls
4. Database table constraints
