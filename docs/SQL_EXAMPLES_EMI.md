# SQL Examples for EMI Management

## 📚 Common Database Queries for EMI System

This document provides ready-to-use SQL queries for managing EMI payments in your loan system.

---

## 1️⃣ Viewing EMI Data

### Get All EMIs for a Specific Loan
```sql
SELECT 
  pes.installment_index,
  pes.status,
  pes.payment_method,
  pes.paid_date,
  pes.created_at,
  pes.updated_at,
  up.full_name as paid_by_name,
  up.email as paid_by_email
FROM product_emi_statuses pes
LEFT JOIN user_profiles up ON pes.paid_by_user_id = up.id
WHERE pes.product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY pes.installment_index;
```

**Result Example**:
| installment_index | status | payment_method | paid_date | paid_by_name |
|-------------------|--------|----------------|-----------|--------------|
| 0 | ECS Success | ecs | 2025-12-12 | NULL |
| 1 | Paid | manual | 2025-11-24 | Admin Name |
| 2 | ECS Success | ecs | 2026-02-12 | NULL |
| 3 | Pending | pending | NULL | NULL |

---

### Get Loan Summary with EMI Progress
```sql
SELECT 
  pl.id,
  pl.loan_amount,
  pl.tenure,
  pl.paid_amount,
  pl.payment_status,
  pl.product_delivered_date,
  COUNT(pes.id) as total_emis,
  COUNT(CASE WHEN pes.status IN ('Paid', 'ECS Success') THEN 1 END) as paid_emis,
  COUNT(CASE WHEN pes.status = 'Pending' THEN 1 END) as pending_emis,
  COUNT(CASE WHEN pes.status = 'ECS Bounce' THEN 1 END) as bounce_emis,
  COUNT(CASE WHEN pes.status = 'Due Missed' THEN 1 END) as missed_emis,
  ROUND(
    (COUNT(CASE WHEN pes.status IN ('Paid', 'ECS Success') THEN 1 END)::numeric / pl.tenure) * 100, 
    2
  ) as completion_percentage
FROM product_loans pl
LEFT JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
WHERE pl.id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
GROUP BY pl.id, pl.loan_amount, pl.tenure, pl.paid_amount, pl.payment_status, pl.product_delivered_date;
```

**Result Example**:
| loan_amount | tenure | paid_amount | paid_emis | pending_emis | completion_percentage |
|-------------|--------|-------------|-----------|--------------|----------------------|
| 207683 | 12 | 41728 | 2 | 10 | 16.67 |

---

### Get Audit History for a Loan
```sql
SELECT 
  pepa.installment_index,
  pepa.old_status,
  pepa.new_status,
  pepa.paid_date,
  pepa.payment_method,
  pepa.changed_at,
  up.full_name as changed_by_name,
  up.role as changed_by_role,
  pepa.notes
FROM product_emi_payment_audit pepa
LEFT JOIN user_profiles up ON pepa.changed_by = up.id
WHERE pepa.product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY pepa.changed_at DESC;
```

**Result Example**:
| installment_index | old_status | new_status | changed_at | changed_by_name | notes |
|-------------------|------------|------------|------------|-----------------|-------|
| 1 | Pending | Paid | 2025-11-24 10:30 | Admin Name | Marked as Paid on 24/11/2025 |
| 0 | Pending | ECS Success | 2025-12-12 08:00 | System | Auto-debit successful |

---

## 2️⃣ Creating/Initializing EMI Records

### Create EMI Records When Loan is Disbursed
```sql
-- For a 12-month loan
INSERT INTO product_emi_statuses 
  (product_loan_id, installment_index, status, payment_method, created_at)
VALUES
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 0, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 1, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 2, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 3, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 4, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 5, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 6, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 7, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 8, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 9, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 10, 'Pending', 'pending', NOW()),
  ('aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009', 11, 'Pending', 'pending', NOW());
```

### Or Use Dynamic Query for Any Tenure
```sql
-- PostgreSQL function to create EMI records dynamically
DO $$
DECLARE
  loan_id_var uuid := 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
  tenure_var integer := 12;
  i integer;
BEGIN
  FOR i IN 0..(tenure_var - 1) LOOP
    INSERT INTO product_emi_statuses 
      (product_loan_id, installment_index, status, payment_method, created_at)
    VALUES
      (loan_id_var, i, 'Pending', 'pending', NOW());
  END LOOP;
END $$;
```

---

## 3️⃣ Updating EMI Status

### Mark EMI as Paid (Manual Payment)
```sql
-- Step 1: Update EMI status
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

-- Step 2: Create audit record
INSERT INTO product_emi_payment_audit (
  product_loan_id,
  installment_index,
  old_status,
  new_status,
  paid_date,
  payment_method,
  changed_by,
  changed_at,
  notes
) VALUES (
  'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009',
  1,
  'Pending',
  'Paid',
  '2025-11-24',
  'manual',
  'admin-user-id',
  NOW(),
  'Marked as Paid on 24/11/2025 by Admin Name'
);

-- Step 3: Update loan paid amount
UPDATE product_loans
SET 
  paid_amount = paid_amount + 20864,
  last_payment_date = '2025-11-24',
  payment_updated_at = NOW()
WHERE id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
```

---

### Mark EMI as ECS Success (Auto-debit)
```sql
-- Step 1: Update EMI status
UPDATE product_emi_statuses
SET 
  status = 'ECS Success',
  payment_method = 'ecs',
  paid_date = '2025-12-12',
  updated_at = NOW()
WHERE 
  product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
  AND installment_index = 0;

-- Step 2: Create audit record
INSERT INTO product_emi_payment_audit (
  product_loan_id,
  installment_index,
  old_status,
  new_status,
  paid_date,
  payment_method,
  changed_by,
  changed_at,
  notes
) VALUES (
  'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009',
  0,
  'Pending',
  'ECS Success',
  '2025-12-12',
  'ecs',
  NULL,  -- System processed
  NOW(),
  'Auto-debit successful'
);

-- Step 3: Update loan paid amount
UPDATE product_loans
SET 
  paid_amount = paid_amount + 20864,
  last_payment_date = '2025-12-12',
  payment_status = 'ecs_success',
  payment_updated_at = NOW()
WHERE id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
```

---

### Mark EMI as ECS Bounce (Failed auto-debit)
```sql
UPDATE product_emi_statuses
SET 
  status = 'ECS Bounce',
  payment_method = 'ecs_bounce',
  updated_at = NOW()
WHERE 
  product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
  AND installment_index = 3;

-- Update loan status to bounce
UPDATE product_loans
SET 
  payment_status = 'bounce',
  payment_updated_at = NOW()
WHERE id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
```

---

## 4️⃣ Reporting Queries

### Get All Loans with Overdue EMIs
```sql
SELECT 
  pl.id,
  pl.loan_amount,
  pl.tenure,
  pl.payment_status,
  COUNT(CASE WHEN pes.status = 'Due Missed' THEN 1 END) as overdue_count,
  COUNT(CASE WHEN pes.status = 'Pending' THEN 1 END) as pending_count
FROM product_loans pl
LEFT JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
WHERE pl.payment_status IN ('overdue', 'bounce')
GROUP BY pl.id, pl.loan_amount, pl.tenure, pl.payment_status
HAVING COUNT(CASE WHEN pes.status = 'Due Missed' THEN 1 END) > 0
ORDER BY overdue_count DESC;
```

---

### Get Monthly Collection Report
```sql
SELECT 
  DATE_TRUNC('month', pes.paid_date) as payment_month,
  COUNT(*) as total_payments,
  SUM(pl.loan_amount / pl.tenure) as total_amount_collected,
  COUNT(CASE WHEN pes.payment_method = 'manual' THEN 1 END) as manual_payments,
  COUNT(CASE WHEN pes.payment_method = 'ecs' THEN 1 END) as ecs_payments
FROM product_emi_statuses pes
JOIN product_loans pl ON pes.product_loan_id = pl.id
WHERE pes.status IN ('Paid', 'ECS Success')
  AND pes.paid_date IS NOT NULL
GROUP BY DATE_TRUNC('month', pes.paid_date)
ORDER BY payment_month DESC;
```

**Result Example**:
| payment_month | total_payments | total_amount_collected | manual_payments | ecs_payments |
|---------------|----------------|------------------------|-----------------|--------------|
| 2025-11-01 | 150 | ₹31,29,600 | 45 | 105 |
| 2025-10-01 | 142 | ₹29,62,688 | 38 | 104 |

---

### Get Loans Fully Paid
```sql
SELECT 
  pl.id,
  pl.loan_amount,
  pl.tenure,
  pl.paid_amount,
  pl.payment_status,
  COUNT(pes.id) as total_emis,
  COUNT(CASE WHEN pes.status IN ('Paid', 'ECS Success') THEN 1 END) as paid_emis
FROM product_loans pl
LEFT JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
GROUP BY pl.id, pl.loan_amount, pl.tenure, pl.paid_amount, pl.payment_status
HAVING COUNT(CASE WHEN pes.status IN ('Paid', 'ECS Success') THEN 1 END) = pl.tenure
ORDER BY pl.id;
```

---

### Get Customer Payment History
```sql
SELECT 
  pl.id as loan_id,
  pl.loan_amount,
  pl.tenure,
  pes.installment_index,
  pes.status,
  pes.paid_date,
  pes.payment_method,
  up.full_name as customer_name,
  up.email as customer_email
FROM product_loans pl
JOIN user_profiles up ON pl.user_id = up.id
LEFT JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
WHERE up.id = 'customer-user-id'
ORDER BY pl.id, pes.installment_index;
```

---

## 5️⃣ Maintenance Queries

### Check for Missing EMI Records
```sql
-- Find loans that don't have the correct number of EMI records
SELECT 
  pl.id,
  pl.tenure as expected_emis,
  COUNT(pes.id) as actual_emis,
  pl.tenure - COUNT(pes.id) as missing_emis
FROM product_loans pl
LEFT JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
WHERE pl.status = 'Loan Disbursed'
GROUP BY pl.id, pl.tenure
HAVING COUNT(pes.id) < pl.tenure;
```

---

### Recalculate Loan Paid Amount
```sql
-- Recalculate paid_amount based on actual EMI statuses
UPDATE product_loans pl
SET paid_amount = (
  SELECT COUNT(*) * (pl.loan_amount / pl.tenure)
  FROM product_emi_statuses pes
  WHERE pes.product_loan_id = pl.id
    AND pes.status IN ('Paid', 'ECS Success')
)
WHERE pl.id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
```

---

### Fix Payment Status Based on EMI Statuses
```sql
UPDATE product_loans pl
SET payment_status = (
  CASE
    WHEN EXISTS (
      SELECT 1 FROM product_emi_statuses pes
      WHERE pes.product_loan_id = pl.id AND pes.status = 'ECS Bounce'
    ) THEN 'bounce'
    WHEN EXISTS (
      SELECT 1 FROM product_emi_statuses pes
      WHERE pes.product_loan_id = pl.id AND pes.status = 'Due Missed'
    ) THEN 'overdue'
    WHEN (
      SELECT COUNT(*) FROM product_emi_statuses pes
      WHERE pes.product_loan_id = pl.id AND pes.status IN ('Paid', 'ECS Success')
    ) = pl.tenure THEN 'paid'
    ELSE 'ontrack'
  END
)
WHERE pl.id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
```

---

## 6️⃣ Advanced Queries

### Get Next Due EMI for Each Loan
```sql
SELECT DISTINCT ON (pl.id)
  pl.id as loan_id,
  pl.loan_amount,
  pes.installment_index,
  pes.status,
  pl.product_delivered_date + (pes.installment_index + 1) * INTERVAL '1 month' as due_date
FROM product_loans pl
JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
WHERE pes.status = 'Pending'
ORDER BY pl.id, pes.installment_index;
```

---

### Get EMI Collection Efficiency
```sql
SELECT 
  COUNT(CASE WHEN status = 'Paid' THEN 1 END) as manual_paid,
  COUNT(CASE WHEN status = 'ECS Success' THEN 1 END) as ecs_success,
  COUNT(CASE WHEN status = 'ECS Bounce' THEN 1 END) as ecs_bounce,
  COUNT(CASE WHEN status = 'Due Missed' THEN 1 END) as due_missed,
  COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending,
  ROUND(
    (COUNT(CASE WHEN status IN ('Paid', 'ECS Success') THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0)) * 100, 
    2
  ) as collection_rate
FROM product_emi_statuses;
```

**Result Example**:
| manual_paid | ecs_success | ecs_bounce | due_missed | pending | collection_rate |
|-------------|-------------|------------|------------|---------|-----------------|
| 450 | 1050 | 25 | 15 | 460 | 75.00% |

---

## 📝 Notes

1. **Always use transactions** when updating multiple tables
2. **Create audit records** for all status changes
3. **Recalculate loan totals** after EMI updates
4. **Use indexes** on `product_loan_id` and `installment_index` for performance
5. **Validate data** before updates (check for ECS-processed EMIs)

---

## 🔒 Security Reminders

- Always validate user permissions before allowing updates
- Log all changes in audit tables
- Use prepared statements to prevent SQL injection
- Never allow direct database access from frontend

---

## 📊 Performance Tips

1. Add indexes:
```sql
CREATE INDEX idx_emi_statuses_loan_id ON product_emi_statuses(product_loan_id);
CREATE INDEX idx_emi_statuses_status ON product_emi_statuses(status);
CREATE INDEX idx_emi_audit_loan_id ON product_emi_payment_audit(product_loan_id);
```

2. Use materialized views for reports:
```sql
CREATE MATERIALIZED VIEW mv_loan_summary AS
SELECT 
  pl.id,
  pl.loan_amount,
  pl.tenure,
  COUNT(CASE WHEN pes.status IN ('Paid', 'ECS Success') THEN 1 END) as paid_count
FROM product_loans pl
LEFT JOIN product_emi_statuses pes ON pl.id = pes.product_loan_id
GROUP BY pl.id, pl.loan_amount, pl.tenure;
```

---

## ✅ Summary

This document provides SQL queries for:
- ✅ Viewing EMI data
- ✅ Creating EMI records
- ✅ Updating EMI status
- ✅ Generating reports
- ✅ Maintenance tasks
- ✅ Advanced analytics

All queries are production-ready and follow best practices for the EMI payment system.
