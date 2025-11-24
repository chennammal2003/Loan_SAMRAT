# Database Storage Summary - EMI Payment System

## Overview
This document explains **where and how** EMI payment data is stored in your database based on the schema and current implementation.

---

## 📊 Primary Tables Used

### 1. **`product_loans`** - Main Loan Application Table
**Location**: `public.product_loans`

**Purpose**: Stores the main loan application details and overall payment status

**Key Fields for EMI Tracking**:
```sql
- id (uuid) - Primary key, used as product_loan_id in other tables
- user_id (text) - Customer who applied for loan
- loan_amount (numeric) - Total loan amount (e.g., ₹2,07,683)
- tenure (integer) - Number of months (e.g., 12)
- processing_fee (numeric)
- status (text) - 'Pending', 'Accepted', 'Loan Disbursed', etc.
- product_delivery_status (text) - 'Pending', 'Product Delivered', 'Loan Disbursed'
- product_delivered_date (date) - When product was delivered (EMI starts from this date)
- paid_amount (numeric) - Total amount paid so far (updated when EMI is marked paid)
- payment_status (text) - 'ontrack', 'overdue', 'paid', 'bounce', 'ecs_success'
- last_payment_date (date) - Date of last payment
- payment_updated_at (timestamp) - When payment was last updated
```

**Example Record**:
```json
{
  "id": "aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009",
  "user_id": "user-123",
  "loan_amount": 207683,
  "tenure": 12,
  "product_delivery_status": "Product Delivered",
  "product_delivered_date": "2025-11-12",
  "paid_amount": 41728,
  "payment_status": "ontrack",
  "last_payment_date": "2025-11-24"
}
```

---

### 2. **`product_emi_statuses`** - Individual EMI Installment Tracking
**Location**: `public.product_emi_statuses`

**Purpose**: Stores the status of each individual EMI installment

**Key Fields**:
```sql
- id (uuid) - Primary key
- product_loan_id (uuid) - Foreign key to product_loans.id
- installment_index (integer) - 0-based index (0=first EMI, 1=second EMI, etc.)
- status (text) - 'Pending', 'Paid', 'ECS Success', 'ECS Bounce', 'Due Missed'
- payment_method (text) - 'manual', 'ecs', 'ecs_bounce', 'missed', 'pending'
- paid_date (date) - Actual date when payment was made
- paid_by_user_id (uuid) - Admin/user who marked it as paid
- created_at (timestamp)
- updated_at (timestamp)
```

**Example Records** (for the loan shown in your image):
```json
[
  {
    "id": "emi-1",
    "product_loan_id": "aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009",
    "installment_index": 0,
    "status": "ECS Success",
    "payment_method": "ecs",
    "paid_date": "2025-12-12",
    "paid_by_user_id": null
  },
  {
    "id": "emi-2",
    "product_loan_id": "aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009",
    "installment_index": 1,
    "status": "Paid",
    "payment_method": "manual",
    "paid_date": "2025-11-24",
    "paid_by_user_id": "admin-user-id"
  },
  {
    "id": "emi-3",
    "product_loan_id": "aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009",
    "installment_index": 2,
    "status": "ECS Success",
    "payment_method": "ecs",
    "paid_date": "2026-02-12",
    "paid_by_user_id": null
  }
  // ... continues for all 12 months
]
```

**Installment Index Mapping**:
- `installment_index: 0` = December (1st EMI)
- `installment_index: 1` = January (2nd EMI)
- `installment_index: 2` = February (3rd EMI)
- ... and so on

---

### 3. **`product_emi_payment_audit`** - Audit Trail
**Location**: `public.product_emi_payment_audit`

**Purpose**: Maintains a complete audit trail of all EMI status changes for compliance and tracking

**Key Fields**:
```sql
- id (uuid) - Primary key
- product_loan_id (uuid) - Foreign key to product_loans.id
- installment_index (integer) - Which EMI was changed
- old_status (text) - Previous status before change
- new_status (text) - New status after change
- paid_date (date) - Payment date
- payment_method (text) - How it was paid
- changed_by (uuid) - User who made the change
- changed_at (timestamp) - When the change was made
- notes (text) - Additional notes about the change
```

**Example Audit Record**:
```json
{
  "id": "audit-1",
  "product_loan_id": "aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009",
  "installment_index": 1,
  "old_status": "Pending",
  "new_status": "Paid",
  "paid_date": "2025-11-24",
  "payment_method": "manual",
  "changed_by": "admin-user-id",
  "changed_at": "2025-11-24T10:30:00Z",
  "notes": "Marked as Paid on 24/11/2025 by Admin Name"
}
```

---

### 4. **`product_delivery_audit`** - Product Delivery Tracking
**Location**: `public.product_delivery_audit`

**Purpose**: Tracks when product delivery status changes (important because EMI starts from delivery date)

**Key Fields**:
```sql
- id (uuid)
- loan_id (uuid) - References product_loans.id
- old_status (text)
- new_status (text) - 'Pending', 'Product Delivered', 'Loan Disbursed'
- delivered_date (date)
- changed_by (uuid)
- changed_at (timestamp)
- notes (text)
```

---

## 🔄 Data Flow: How EMI Data is Saved

### When a Loan is Created:
1. **Insert into `product_loans`**:
   ```sql
   INSERT INTO product_loans (
     user_id, loan_amount, tenure, status, ...
   ) VALUES (
     'user-123', 207683, 12, 'Pending', ...
   );
   ```

### When Loan is Disbursed & Product Delivered:
1. **Update `product_loans`**:
   ```sql
   UPDATE product_loans 
   SET 
     status = 'Loan Disbursed',
     product_delivery_status = 'Product Delivered',
     product_delivered_date = '2025-11-12'
   WHERE id = 'loan-id';
   ```

2. **Create EMI records in `product_emi_statuses`**:
   ```sql
   INSERT INTO product_emi_statuses 
     (product_loan_id, installment_index, status, payment_method)
   VALUES
     ('loan-id', 0, 'Pending', 'pending'),  -- Dec
     ('loan-id', 1, 'Pending', 'pending'),  -- Jan
     ('loan-id', 2, 'Pending', 'pending'),  -- Feb
     -- ... for all 12 months
     ('loan-id', 11, 'Pending', 'pending'); -- Nov
   ```

### When Admin Marks EMI as Paid:
1. **Update `product_emi_statuses`**:
   ```sql
   UPDATE product_emi_statuses
   SET 
     status = 'Paid',
     payment_method = 'manual',
     paid_date = '2025-11-24',
     paid_by_user_id = 'admin-user-id',
     updated_at = NOW()
   WHERE 
     product_loan_id = 'loan-id'
     AND installment_index = 1;
   ```

2. **Insert audit record into `product_emi_payment_audit`**:
   ```sql
   INSERT INTO product_emi_payment_audit (
     product_loan_id, installment_index, 
     old_status, new_status, 
     paid_date, payment_method, 
     changed_by, notes
   ) VALUES (
     'loan-id', 1,
     'Pending', 'Paid',
     '2025-11-24', 'manual',
     'admin-user-id', 'Marked as Paid on 24/11/2025 by Admin'
   );
   ```

3. **Update total paid amount in `product_loans`**:
   ```sql
   UPDATE product_loans
   SET 
     paid_amount = paid_amount + 20864,  -- Add EMI amount
     last_payment_date = '2025-11-24',
     payment_updated_at = NOW()
   WHERE id = 'loan-id';
   ```

4. **Update loan payment status**:
   ```sql
   UPDATE product_loans
   SET 
     payment_status = 'ontrack',  -- or 'paid' if all EMIs done
     payment_updated_at = NOW()
   WHERE id = 'loan-id';
   ```

---

## 📍 Where Your Image Data is Stored

Based on the image you uploaded showing loan `aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009`:

### Main Loan Record (`product_loans` table):
```sql
SELECT * FROM product_loans 
WHERE id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
```

**Returns**:
- Loan Amount: ₹2,07,683
- Tenure: 12 months
- Product Delivered: 12/11/2025
- Loan Disbursed: 19/11/2025
- Paid Amount: ₹41,728 (2 EMIs paid)
- Payment Status: ontrack

### Individual EMI Records (`product_emi_statuses` table):
```sql
SELECT * FROM product_emi_statuses 
WHERE product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY installment_index;
```

**Returns 12 records**:
| installment_index | status | paid_date | payment_method | amount |
|-------------------|--------|-----------|----------------|--------|
| 0 | ECS Success | 2025-12-12 | ecs | ₹20,864 |
| 1 | Paid | 2025-11-24 | manual | ₹20,864 |
| 2 | ECS Success | 2026-02-12 | ecs | ₹20,864 |
| 3 | ECS Success | 2026-03-12 | ecs | ₹20,864 |
| 4 | ECS Success | 2026-04-12 | ecs | ₹20,864 |
| 5 | ECS Success | 2026-05-12 | ecs | ₹20,864 |
| 6 | Pending | NULL | pending | ₹20,864 |
| ... | ... | ... | ... | ... |

### Audit Trail (`product_emi_payment_audit` table):
```sql
SELECT * FROM product_emi_payment_audit 
WHERE product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY changed_at DESC;
```

**Returns all status changes** made to this loan's EMIs.

---

## 🔍 Current Implementation Location

### Frontend Component:
**File**: `src/components/PaymentDetailsModal.tsx`

**Key Functions**:
1. **`fetchPayments()`** (Lines 95-200):
   - Fetches EMI data from `product_emi_statuses` table
   - Falls back to legacy `emi_statuses` table if needed
   - Sets up real-time subscription for changes

2. **`handleSavePaidDate()`** (Lines 238-536):
   - Updates EMI status in `product_emi_statuses`
   - Creates audit record in `product_emi_payment_audit`
   - Updates total paid amount in `product_loans`
   - Recalculates loan payment status

### Database Tables:
- **Primary**: `product_emi_statuses`, `product_loans`
- **Audit**: `product_emi_payment_audit`, `product_delivery_audit`
- **Legacy Fallback**: `emi_statuses`, `emi_payment_audit`, `loans`

---

## 📝 Status Values Reference

### EMI Status (`product_emi_statuses.status`):
- **Pending**: EMI not yet paid
- **Paid**: Manually marked as paid by admin
- **ECS Success**: Auto-debit successful
- **ECS Bounce**: Auto-debit failed
- **Due Missed**: Payment overdue

### Payment Method (`product_emi_statuses.payment_method`):
- **pending**: Not yet paid
- **manual**: Manually marked as paid
- **ecs**: Auto-debit successful
- **ecs_bounce**: Auto-debit failed
- **missed**: Payment missed/overdue

### Loan Payment Status (`product_loans.payment_status`):
- **ontrack**: Some EMIs paid, no issues
- **overdue**: Has missed payments
- **paid**: All EMIs completed
- **bounce**: Has ECS bounces
- **ecs_success**: Last payment was ECS success

---

## 🎯 Key Points

1. **EMI Start Date**: EMIs start counting from `product_delivered_date`, NOT from loan disbursement date
2. **Installment Index**: 0-based (0 = first EMI, 11 = twelfth EMI for 12-month tenure)
3. **Real-time Updates**: Frontend subscribes to database changes via Supabase real-time
4. **Audit Trail**: Every EMI status change is logged in `product_emi_payment_audit`
5. **Backward Compatibility**: System falls back to legacy tables (`emi_statuses`, `loans`) if new tables don't exist

---

## 🔐 Security & Permissions

- Only **admins** can mark EMIs as paid
- **ECS-processed EMIs** cannot be manually overridden
- All changes are **audited** with user ID and timestamp
- **Real-time sync** ensures data consistency across sessions

---

## 📊 Sample Queries

### Get all EMI details for a loan:
```sql
SELECT 
  pes.installment_index,
  pes.status,
  pes.payment_method,
  pes.paid_date,
  up.full_name as paid_by
FROM product_emi_statuses pes
LEFT JOIN user_profiles up ON pes.paid_by_user_id = up.id
WHERE pes.product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY pes.installment_index;
```

### Get loan summary with EMI progress:
```sql
SELECT 
  pl.id,
  pl.loan_amount,
  pl.tenure,
  pl.paid_amount,
  pl.payment_status,
  COUNT(CASE WHEN pes.status IN ('Paid', 'ECS Success') THEN 1 END) as paid_emis,
  COUNT(*) as total_emis
FROM product_loans pl
LEFT JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
WHERE pl.id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
GROUP BY pl.id;
```

### Get audit history:
```sql
SELECT 
  pepa.installment_index,
  pepa.old_status,
  pepa.new_status,
  pepa.paid_date,
  pepa.changed_at,
  up.full_name as changed_by,
  pepa.notes
FROM product_emi_payment_audit pepa
LEFT JOIN user_profiles up ON pepa.changed_by = up.id
WHERE pepa.product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY pepa.changed_at DESC;
```

---

## ✅ Summary

**Your EMI payment data is stored in**:
1. **`product_loans`** - Main loan record with totals
2. **`product_emi_statuses`** - Individual EMI installment tracking
3. **`product_emi_payment_audit`** - Complete audit trail
4. **`product_delivery_audit`** - Product delivery tracking

All data is managed through the `PaymentDetailsModal.tsx` component with full audit logging and real-time synchronization.
