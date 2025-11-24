# EMI Payment Database Implementation Guide

## Overview
This document explains how EMI payment data is stored and managed in the database based on the schema.

## Database Tables Used

### 1. `product_loans` Table
**Purpose**: Main loan application record

**Key Fields**:
```sql
- id (uuid) - Primary key
- user_id (text) - Customer ID
- loan_amount (numeric) - Total loan amount (₹2,07,683)
- tenure (integer) - Number of months (12)
- processing_fee (numeric)
- status (text) - 'Pending', 'Accepted', 'Loan Disbursed', etc.
- product_delivery_status (text) - 'Pending', 'Product Delivered', 'Loan Disbursed'
- product_delivered_date (date) - When product was delivered
- paid_amount (numeric) - Total amount paid so far
- payment_status (text) - 'ontrack', 'overdue', 'paid', 'bounce', 'ecs_success'
- created_at (timestamp)
```

### 2. `product_emi_statuses` Table
**Purpose**: Track each individual EMI installment

**Key Fields**:
```sql
- id (uuid) - Primary key
- product_loan_id (uuid) - Foreign key to product_loans
- installment_index (integer) - 0-based index (0=first month, 1=second month, etc.)
- status (text) - 'Pending', 'Paid', 'ECS Success', 'ECS Bounce', 'Due Missed'
- payment_method (text) - 'manual', 'ecs', 'ecs_bounce', 'missed', 'pending'
- paid_date (date) - Actual payment date
- paid_by_user_id (uuid) - Admin/user who marked it paid
- created_at (timestamp)
- updated_at (timestamp)
```

### 3. `product_emi_payment_audit` Table
**Purpose**: Audit trail for EMI payment changes

**Key Fields**:
```sql
- id (uuid)
- product_loan_id (uuid)
- installment_index (integer)
- old_status (text)
- new_status (text)
- paid_date (date)
- payment_method (text)
- changed_by (uuid) - User who made the change
- changed_at (timestamp)
- notes (text)
```

### 4. `product_delivery_audit` Table
**Purpose**: Track product delivery status changes

**Key Fields**:
```sql
- id (uuid)
- loan_id (uuid) - References product_loans.id
- old_status (text)
- new_status (text)
- delivered_date (date)
- changed_by (uuid)
- changed_at (timestamp)
- notes (text)
```

## Data Flow Example

### When a Loan is Disbursed:

```sql
-- 1. Update product_loans table
UPDATE product_loans 
SET 
  status = 'Loan Disbursed',
  product_delivery_status = 'Product Delivered',
  product_delivered_date = '2025-11-12'
WHERE id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';

-- 2. Create EMI records for each month (12 months in this case)
INSERT INTO product_emi_statuses 
  (product_loan_id, installment_index, status, payment_method)
VALUES
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 0, 'Pending', 'pending'),  -- Dec
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 1, 'Pending', 'pending'),  -- Jan
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 2, 'Pending', 'pending'),  -- Feb
  -- ... continue for all 12 months
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 11, 'Pending', 'pending'); -- Nov
```

### When an EMI is Paid (e.g., December via ECS):

```sql
-- 1. Update EMI status
UPDATE product_emi_statuses
SET 
  status = 'ECS Success',
  payment_method = 'ecs',
  paid_date = '2025-12-12',
  paid_by_user_id = 'admin-user-id',
  updated_at = NOW()
WHERE 
  product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
  AND installment_index = 0;

-- 2. Create audit record
INSERT INTO product_emi_payment_audit
  (product_loan_id, installment_index, old_status, new_status, 
   paid_date, payment_method, changed_by, notes)
VALUES
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 0, 'Pending', 'ECS Success',
   '2025-12-12', 'ecs', 'admin-user-id', 'Auto-debit successful');

-- 3. Update total paid amount in product_loans
UPDATE product_loans
SET 
  paid_amount = paid_amount + 20864,
  last_payment_date = '2025-12-12',
  payment_updated_at = NOW()
WHERE id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
```

### When an EMI is Manually Marked as Paid (e.g., January):

```sql
-- 1. Update EMI status
UPDATE product_emi_statuses
SET 
  status = 'Paid',
  payment_method = 'manual',
  paid_date = '2025-11-24',
  paid_by_user_id = 'admin-user-id',
  updated_at = NOW()
WHERE 
  product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
  AND installment_index = 1;

-- 2. Create audit record
INSERT INTO product_emi_payment_audit
  (product_loan_id, installment_index, old_status, new_status, 
   paid_date, payment_method, changed_by, notes)
VALUES
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 1, 'Pending', 'Paid',
   '2025-11-24', 'manual', 'admin-user-id', 'Manually marked as paid by admin');
```

## Query Examples

### Get All EMI Details for a Loan:

```sql
SELECT 
  pl.id as loan_id,
  pl.loan_amount,
  pl.tenure,
  pl.paid_amount,
  pl.product_delivery_status,
  pl.product_delivered_date,
  pes.installment_index,
  pes.status,
  pes.payment_method,
  pes.paid_date,
  up.full_name as paid_by
FROM product_loans pl
LEFT JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
LEFT JOIN user_profiles up ON pes.paid_by_user_id = up.id
WHERE pl.id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY pes.installment_index;
```

### Calculate EMI Progress:

```sql
SELECT 
  pl.id,
  pl.tenure as total_emis,
  COUNT(CASE WHEN pes.status IN ('Paid', 'ECS Success') THEN 1 END) as paid_emis,
  ROUND(
    (COUNT(CASE WHEN pes.status IN ('Paid', 'ECS Success') THEN 1 END)::numeric / pl.tenure) * 100, 
    2
  ) as completion_percentage
FROM product_loans pl
LEFT JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
WHERE pl.id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
GROUP BY pl.id, pl.tenure;
```

### Get Audit Trail for an EMI:

```sql
SELECT 
  pepa.installment_index,
  pepa.old_status,
  pepa.new_status,
  pepa.paid_date,
  pepa.payment_method,
  pepa.changed_at,
  up.full_name as changed_by_name,
  pepa.notes
FROM product_emi_payment_audit pepa
LEFT JOIN user_profiles up ON pepa.changed_by = up.id
WHERE pepa.product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY pepa.changed_at DESC;
```

## Status Mapping

### EMI Status Values:
- **Pending**: EMI not yet paid, due date not reached
- **Paid**: Manually marked as paid
- **ECS Success**: Auto-debit successful
- **ECS Bounce**: Auto-debit failed
- **Due Missed**: Payment overdue

### Payment Method Values:
- **pending**: Not yet paid
- **manual**: Manually marked as paid by admin
- **ecs**: Auto-debit successful
- **ecs_bounce**: Auto-debit failed
- **missed**: Payment was missed/overdue

### Product Delivery Status:
- **Pending**: Product not yet delivered
- **Product Delivered**: Product delivered to customer
- **Loan Disbursed**: Loan amount disbursed

## Important Notes

1. **installment_index** is 0-based (0 = first month, 11 = twelfth month for 12-month tenure)
2. Always create audit records when updating EMI status
3. Update `paid_amount` in `product_loans` table when marking EMI as paid
4. The EMI amount is calculated as: `loan_amount / tenure`
5. For the example: ₹2,07,683 / 12 = ₹20,864 per month

## API Endpoint Suggestions

### 1. Mark EMI as Paid
```
POST /api/product-loans/:loanId/emis/:installmentIndex/mark-paid
Body: {
  "paymentMethod": "manual" | "ecs",
  "paidDate": "2025-11-24",
  "notes": "Payment received via UPI"
}
```

### 2. Get Loan EMI Details
```
GET /api/product-loans/:loanId/emis
Response: {
  "loanId": "...",
  "totalAmount": 207683,
  "tenure": 12,
  "emiAmount": 20864,
  "paidAmount": 41728,
  "emis": [...]
}
```

### 3. Get EMI Audit Trail
```
GET /api/product-loans/:loanId/emis/:installmentIndex/audit
```
