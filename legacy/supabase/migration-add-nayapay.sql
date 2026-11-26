-- Migration: add NayaPay as a fourth manual wallet payment method.
-- Run this ONCE in the Supabase SQL Editor on the live project
-- (mohsin-futuretech). Fresh projects already get 'nayapay' from
-- schema.sql, so they do not need this file.
-- Manual verification only — same as EasyPaisa / JazzCash: the customer
-- pays in their own NayaPay app, then submits Transaction ID + receipt
-- screenshot; an admin approves it. No automatic gateway.
alter type public.payment_method add value 'nayapay';
