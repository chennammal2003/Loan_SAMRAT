-- Migration: Add product_loans creation to submit_loan_via_share_link RPC
-- This ensures that when loans are submitted via share links with selected products,
-- they automatically appear in the merchant's Product Loans dashboard

-- Recreate the RPC function with product_loans creation logic
CREATE OR REPLACE FUNCTION submit_loan_via_share_link(
  p_link_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
  v_loan_id uuid;
  v_product_item record;
BEGIN
  SELECT created_by INTO v_creator
  FROM loan_share_links
  WHERE link_id = p_link_id AND is_active = true AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive link';
  END IF;

  -- Create the main loan record
  INSERT INTO loans (
    user_id,
    first_name,
    last_name,
    father_mother_spouse_name,
    date_of_birth,
    aadhaar_number,
    pan_number,
    gender,
    marital_status,
    occupation,
    introduced_by,
    email_id,
    address,
    pin_code,
    landmark,
    permanent_address,
    mobile_primary,
    mobile_alternative,
    reference1_name,
    reference1_address,
    reference1_contact,
    reference1_relationship,
    reference2_name,
    reference2_address,
    reference2_contact,
    reference2_relationship,
    interest_scheme,
    gold_price_lock_date,
    down_payment_details,
    loan_amount,
    tenure,
    processing_fee,
    status,
    declaration_accepted,
    share_link_id
  ) VALUES (
    v_creator,
    p_payload->>'first_name',
    p_payload->>'last_name',
    p_payload->>'father_mother_spouse_name',
    (p_payload->>'date_of_birth')::date,
    p_payload->>'aadhaar_number',
    p_payload->>'pan_number',
    p_payload->>'gender',
    p_payload->>'marital_status',
    p_payload->>'occupation',
    p_payload->>'introduced_by',
    p_payload->>'email_id',
    p_payload->>'address',
    p_payload->>'pin_code',
    p_payload->>'landmark',
    COALESCE(p_payload->>'permanent_address', p_payload->>'address'),
    p_payload->>'mobile_primary',
    p_payload->>'mobile_alternative',
    p_payload->>'reference1_name',
    p_payload->>'reference1_address',
    p_payload->>'reference1_contact',
    p_payload->>'reference1_relationship',
    p_payload->>'reference2_name',
    p_payload->>'reference2_address',
    p_payload->>'reference2_contact',
    p_payload->>'reference2_relationship',
    p_payload->>'interest_scheme',
    (p_payload->>'gold_price_lock_date')::date,
    p_payload->>'down_payment_details',
    (p_payload->>'loan_amount')::numeric,
    (p_payload->>'tenure')::integer,
    (p_payload->>'processing_fee')::numeric,
    'Pending',
    (p_payload->>'declaration_accepted')::boolean,
    (SELECT id FROM loan_share_links WHERE link_id = p_link_id)
  ) RETURNING id INTO v_loan_id;

  -- Create product_loans entries for each selected product
  -- These will appear in the merchant's Product Loans dashboard
  IF p_payload->'selected_products' IS NOT NULL AND jsonb_array_length(p_payload->'selected_products') > 0 THEN
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
        mobile_alternative,
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
        v_creator,
        v_creator,
        p_payload->>'first_name',
        p_payload->>'last_name',
        p_payload->>'email_id',
        p_payload->>'mobile_primary',
        p_payload->>'mobile_alternative',
        p_payload->>'address',
        (p_payload->>'loan_amount')::numeric,
        (p_payload->>'tenure')::integer,
        (p_payload->>'processing_fee')::numeric,
        v_product_item.item->>'id',
        v_product_item.item->>'name',
        (v_product_item.item->>'price')::numeric,
        'Pending',
        now(),
        now()
      );
    END LOOP;
  END IF;

  -- Increment submissions count on the link
  UPDATE loan_share_links
  SET submissions_count = submissions_count + 1
  WHERE link_id = p_link_id;

  RETURN v_loan_id;
END;
$$;

-- Ensure the function can be executed by anon and authenticated users
GRANT EXECUTE ON FUNCTION submit_loan_via_share_link(uuid, jsonb) TO anon, authenticated;

-- Note: This migration ensures that loan applications submitted via share links
-- with selected products will now automatically create product_loans entries
-- that are visible in the merchant's Product Loans dashboard at localhost:5175/dashboard
