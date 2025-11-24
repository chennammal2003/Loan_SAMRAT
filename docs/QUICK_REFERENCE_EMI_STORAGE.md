# Quick Reference: EMI Database Storage

## 🎯 Where is EMI Data Saved?

### Main Tables (in order of importance):

#### 1️⃣ **`product_loans`** - The Master Record
```
Location: public.product_loans
Purpose: Stores overall loan information and totals
```

**Key Fields You Need**:
- `id` - Unique loan identifier
- `loan_amount` - Total loan amount (e.g., ₹2,07,683)
- `tenure` - Number of months (e.g., 12)
- `paid_amount` - Total paid so far (updated when EMI is marked paid)
- `payment_status` - Overall status: 'ontrack', 'overdue', 'paid', 'bounce'
- `product_delivered_date` - **IMPORTANT**: EMI starts from this date!

---

#### 2️⃣ **`product_emi_statuses`** - Individual EMI Tracking
```
Location: public.product_emi_statuses
Purpose: Tracks each monthly EMI installment
```

**Key Fields You Need**:
- `product_loan_id` - Links to product_loans.id
- `installment_index` - Which EMI (0=first, 1=second, etc.)
- `status` - 'Pending', 'Paid', 'ECS Success', 'ECS Bounce', 'Due Missed'
- `payment_method` - 'manual', 'ecs', 'ecs_bounce', 'missed', 'pending'
- `paid_date` - When it was paid
- `paid_by_user_id` - Who marked it paid

**Example**:
```json
{
  "product_loan_id": "aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009",
  "installment_index": 0,  // December (1st EMI)
  "status": "ECS Success",
  "payment_method": "ecs",
  "paid_date": "2025-12-12"
}
```

---

#### 3️⃣ **`product_emi_payment_audit`** - Change History
```
Location: public.product_emi_payment_audit
Purpose: Logs every change made to EMI status
```

**Key Fields You Need**:
- `product_loan_id` - Which loan
- `installment_index` - Which EMI
- `old_status` - Status before change
- `new_status` - Status after change
- `changed_by` - Who made the change
- `changed_at` - When it was changed
- `notes` - Description of change

---

## 📊 Your Image Data Breakdown

Based on loan ID: `aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009`

### In `product_loans` table:
```sql
{
  "id": "aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009",
  "loan_amount": 207683,
  "tenure": 12,
  "product_delivered_date": "2025-11-12",
  "paid_amount": 41728,  // 2 EMIs paid (2 × ₹20,864)
  "payment_status": "ontrack"
}
```

### In `product_emi_statuses` table (12 records):
```sql
-- December (index 0)
{ "installment_index": 0, "status": "ECS Success", "paid_date": "2025-12-12" }

-- January (index 1)
{ "installment_index": 1, "status": "Paid", "paid_date": "2025-11-24" }

-- February (index 2)
{ "installment_index": 2, "status": "ECS Success", "paid_date": "2026-02-12" }

-- March through November (index 3-11)
{ "installment_index": 3-11, "status": "ECS Success" or "Pending" }
```

---

## 🔄 How Data Flows

### When Admin Marks EMI as Paid:

1. **Update** `product_emi_statuses`:
   ```sql
   UPDATE product_emi_statuses
   SET status = 'Paid', paid_date = '2025-11-24'
   WHERE product_loan_id = 'loan-id' AND installment_index = 1;
   ```

2. **Insert** into `product_emi_payment_audit`:
   ```sql
   INSERT INTO product_emi_payment_audit (
     product_loan_id, installment_index, 
     old_status, new_status, changed_by
   ) VALUES (
     'loan-id', 1, 'Pending', 'Paid', 'admin-id'
   );
   ```

3. **Update** `product_loans`:
   ```sql
   UPDATE product_loans
   SET paid_amount = paid_amount + 20864
   WHERE id = 'loan-id';
   ```

---

## 🎨 Visual Mapping

```
product_loans (1 record)
    ↓
    ├─→ product_emi_statuses (12 records for 12-month tenure)
    │       ├─ installment_index: 0 (Dec)
    │       ├─ installment_index: 1 (Jan)
    │       ├─ installment_index: 2 (Feb)
    │       └─ ... (up to 11 for 12 months)
    │
    └─→ product_emi_payment_audit (N records, one per change)
            ├─ Change 1: Pending → ECS Success
            ├─ Change 2: Pending → Paid
            └─ Change 3: ...
```

---

## 📝 Status Values Cheat Sheet

### EMI Status Options:
| Status | Meaning | Color in UI |
|--------|---------|-------------|
| **Pending** | Not yet paid | Amber/Yellow |
| **Paid** | Manually marked paid | Green |
| **ECS Success** | Auto-debit successful | Emerald |
| **ECS Bounce** | Auto-debit failed | Red |
| **Due Missed** | Payment overdue | Orange |

### Payment Method Options:
| Method | Meaning |
|--------|---------|
| **pending** | Not yet paid |
| **manual** | Admin marked as paid |
| **ecs** | Auto-debit successful |
| **ecs_bounce** | Auto-debit failed |
| **missed** | Payment was missed |

---

## 🔍 Quick Queries

### Get all EMIs for a loan:
```sql
SELECT * FROM product_emi_statuses 
WHERE product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY installment_index;
```

### Get loan summary:
```sql
SELECT 
  loan_amount,
  tenure,
  paid_amount,
  payment_status,
  product_delivered_date
FROM product_loans 
WHERE id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
```

### Get audit history:
```sql
SELECT * FROM product_emi_payment_audit 
WHERE product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009'
ORDER BY changed_at DESC;
```

### Count paid EMIs:
```sql
SELECT 
  COUNT(*) FILTER (WHERE status IN ('Paid', 'ECS Success')) as paid_count,
  COUNT(*) as total_count
FROM product_emi_statuses 
WHERE product_loan_id = 'aa2d7fb6-1b15-4ebb-8456-4cdaf1b49009';
```

---

## 💡 Important Notes

1. **Installment Index is 0-based**: First EMI = 0, Second EMI = 1, etc.
2. **EMI Start Date**: Uses `product_delivered_date`, NOT disbursement date
3. **EMI Amount Calculation**: `loan_amount ÷ tenure` (e.g., ₹207,683 ÷ 12 = ₹20,864)
4. **Real-time Updates**: Frontend auto-refreshes when database changes
5. **Audit Trail**: Every change is logged with who, when, and what changed

---

## 🚀 Frontend Implementation

**File**: `src/components/PaymentDetailsModal.tsx`

**Key Functions**:
- `fetchPayments()` - Loads EMI data from database
- `handleSavePaidDate()` - Marks EMI as paid and updates all tables
- Real-time subscription to `product_emi_statuses` table

---

## ✅ Summary

**Your EMI data is stored in 3 main tables**:

1. **`product_loans`** → Overall loan info and totals
2. **`product_emi_statuses`** → Individual EMI tracking (12 records for 12 months)
3. **`product_emi_payment_audit`** → Complete change history

**Each table serves a specific purpose**:
- `product_loans` = Master record
- `product_emi_statuses` = Individual installments
- `product_emi_payment_audit` = Audit trail

**All managed through**: `PaymentDetailsModal.tsx` component with full audit logging and real-time sync.
