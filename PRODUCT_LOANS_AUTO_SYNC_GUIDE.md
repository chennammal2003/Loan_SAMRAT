# Product Loans Auto-Sync from Share Link Submissions

## ✅ Problem Solved

When customers submit loan applications via share links with selected products, those loans now **automatically appear in the merchant's Product Loans dashboard** (`/dashboard`).

## 🔧 What Changed

### Updated RPC Function: `submit_loan_via_share_link`

**Before:** Only created a `loans` entry (visible to admin only)
**After:** Creates both:
1. Main `loans` entry (for admin tracking)
2. **NEW**: `product_loans` entries (for merchant dashboard) ← **This is the key fix!**

### How It Works

When a public customer fills out and submits a loan application via a share link with selected products:

```
Customer fills form → Selects products → Clicks Submit
                          ↓
                    RPC Function Executes
                          ↓
              ┌─────────────────────────┐
              │  Creates loans entry    │
              │  (Admin Dashboard)      │
              └─────────────────────────┘
                          ↓
              ┌─────────────────────────┐
              │ Creates product_loans   │
              │ entries for EACH        │
              │ selected product        │ ← NEW!
              │ (Merchant Dashboard)    │
              └─────────────────────────┘
                          ↓
          Merchant sees it in Product Loans page
          at localhost:5175/dashboard
```

## 📊 Database Changes

### New Logic in `submit_loan_via_share_link()` RPC

```sql
-- After creating the main loan...

-- Create product_loans entries for each selected product
IF p_payload->'selected_products' IS NOT NULL 
   AND jsonb_array_length(p_payload->'selected_products') > 0 THEN
  FOR v_product_item IN 
    SELECT jsonb_array_elements(p_payload->'selected_products') AS item
  LOOP
    INSERT INTO product_loans (
      loan_id,
      merchant_id,
      user_id,
      first_name,
      last_name,
      email_id,
      mobile_primary,
      address,
      loan_amount,
      tenure,
      processing_fee,
      product_id,
      product_name,
      product_price,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_loan_id,
      v_creator,  ← Merchant ID from share link creator
      v_creator,
      ...data from payload...
      'Pending',  ← Initial status
      now(),
      now()
    );
  END LOOP;
END IF;
```

## 🚀 How to Deploy

### Step 1: Apply Migration to Supabase

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Click on "SQL Editor" in the sidebar

2. **Create New Query**
   - Click "+ New Query"
   - Copy the entire content from `migrations/004_add_product_loans_to_share_link_submissions.sql`
   - Paste it into the SQL editor

3. **Execute**
   - Click "Run" button (or Ctrl+Enter)
   - Wait for success message

4. **Verify Success**
   - You should see: "Query successful"
   - No error messages

### Step 2: Restart Dev Server

```bash
npm run dev
```

This is already running on localhost:5175

### Step 3: Test the Flow

**Test Scenario:**

1. **Create a Share Link** (if you don't have one)
   - Go to: http://localhost:5175/dashboard
   - Click on "Share Link Panel" or similar
   - Create a new active share link
   - Copy the link

2. **Submit Application via Link**
   - Open a new browser or incognito window
   - Paste the share link (should be: `http://localhost:5175/apply-loan/{linkId}`)
   - Fill out all fields on the 6-step form
   - **Most Important**: On Step 1 "Loan Details", **select some products** from the product list
   - Complete all 6 steps
   - Click "Submit"
   - You should see: "Loan has been submitted..."

3. **Check Product Loans Dashboard**
   - Log in to the merchant account (the one who created the share link)
   - Go to: http://localhost:5175/dashboard
   - Click on "Product Loans" tab
   - **NEW**: You should see the submitted loan with the selected products!

### Step 4: Verify Data Saved

In the Product Loans dashboard, the loan should show:
- ✅ Customer name
- ✅ Email address
- ✅ Mobile number
- ✅ Loan amount
- ✅ Tenure
- ✅ **Product name** (from selected products)
- ✅ **Product price**
- ✅ Status: "Pending"
- ✅ Creation date

You can then:
- ✅ Click "Mark Delivered" to set delivery date
- ✅ Mark EMI payments
- ✅ View full loan details

## 📝 Files Modified

1. **database-setup.sql** - Updated RPC function to create product_loans entries
2. **migrations/004_add_product_loans_to_share_link_submissions.sql** - New migration file

## 🔍 Technical Details

### What Gets Passed to product_loans

When a customer submits with products:

```javascript
// From PublicApplyLoanPage.tsx
const selectedProductsPayload = (formData.selectedProducts || []).map(p => ({ 
  id: p.id,        // Product ID
  name: p.name,    // Product name (e.g., "Gold Pendant")
  price: p.price   // Product price (e.g., 25000)
}));
```

### RPC Processes Each Product

For each selected product, it creates a `product_loans` row:

```sql
INSERT INTO product_loans (
  loan_id,              -- Links to the main loan
  merchant_id,          -- Who created the share link
  product_id,           -- From selected products
  product_name,         -- From selected products
  product_price,        -- From selected products
  status,               -- 'Pending'
  ...other_fields...
)
```

### Merchant Can Then

1. **View** - In Product Loans dashboard
2. **Track** - See delivery status and mark as delivered
3. **Manage** - Track EMI payments
4. **Audit** - See all product loan history

## ✨ Benefits

✅ **Automatic Sync** - No manual entry needed
✅ **Real-time** - Appears instantly after submission
✅ **Multi-Product** - Creates separate rows for each selected product
✅ **Linked** - Ties back to main loan via loan_id
✅ **Trackable** - Merchant can track delivery and payments

## ❌ Troubleshooting

### Problem: Loan appears in admin but NOT in Product Loans dashboard

**Cause**: Migration not applied to Supabase

**Solution**:
1. Go to Supabase Dashboard
2. SQL Editor
3. Copy-paste and run the migration SQL again
4. Restart dev server (`npm run dev`)

### Problem: Migration fails with error

**Common Errors**:

```
"syntax error at or near 'CREATE'"
→ Solution: Make sure all previous statements end with semicolon
```

```
"function submit_loan_via_share_link already exists"
→ This is normal - it's just replacing the old function
```

### Problem: Selected products not showing in product_loans

**Cause**: `selected_products` not being passed to RPC

**Solution**: Check PublicApplyLoanPage.tsx line ~215:
```typescript
// Make sure this exists:
const selectedProductsPayload = (formData.selectedProducts || []).map(p => ({ 
  id: p.id, 
  name: p.name, 
  price: p.price 
}));

// And passed in the RPC call:
selected_products: selectedProductsPayload,  ← Check this
```

## 📞 Support

If you have questions about:
- **Product Loans data flow** → Check MerchantProductLoans.tsx
- **Form submission** → Check PublicApplyLoanPage.tsx
- **Database logic** → Check database-setup.sql
- **Payments** → Check PaymentDetailsModal.tsx
- **Delivery tracking** → Check MerchantProductLoans.tsx handleSaveDeliveryDate()

## Next Steps

1. ✅ Apply the migration to Supabase
2. ✅ Test with a share link submission
3. ✅ Verify loans appear in Product Loans dashboard
4. ✅ Test delivery date marking
5. ✅ Test EMI payment tracking

You're all set! The loans submitted via share links will now sync automatically to the Product Loans dashboard.
