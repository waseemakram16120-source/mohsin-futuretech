-- ============================================================================
-- Mohsin FutureTech — store details for the PRODUCTION project (run ONCE,
-- after all migrations, in Supabase → SQL Editor).
--
-- Provided by the client (owner: Muhammad Waseem). Everything here can be
-- changed later in Admin → Settings without a developer.
--
-- Before running: confirm with the owner that both wallet accounts are
-- registered in the name "Muhammad Waseem" — customers see this name next
-- to the number when they pay.
-- ============================================================================

update public.store_settings set
  store_name               = 'Mohsin FutureTech',
  support_phone            = '+92 308 2340478',
  support_email            = 'mwbusiness.com12@gmail.com',
  whatsapp_number          = '923082340478',           -- wa.me format (92 + number without the 0)
  store_address            = 'Korangi Industrial Area, Karachi, Pakistan',
  easypaisa_account_name   = 'Muhammad Waseem',
  easypaisa_account_number = '0308 2340478',
  jazzcash_account_name    = 'Muhammad Waseem',
  jazzcash_account_number  = '0308 2340478'
where id = 1;

-- Check:
select store_name, support_phone, support_email, whatsapp_number, store_address,
       easypaisa_account_name, easypaisa_account_number,
       jazzcash_account_name, jazzcash_account_number
  from public.store_settings where id = 1;
