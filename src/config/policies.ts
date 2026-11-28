/**
 * Customer-facing policies — the ONE place to edit their wording.
 *
 * DRAFT: these are sensible defaults for a Pakistani clothing store, written
 * by the developer. The store owner must confirm or change them before
 * launch, then set `draft: false` (which removes the "draft" notice shown on
 * the pages). Amounts and contact details come from Admin → Settings.
 */
export const policies = {
  draft: true,
  businessHours: "Monday to Saturday, 11 am – 8 pm",
  returnDays: 7,
  shipping: [
    "We deliver across Pakistan through trusted courier partners.",
    "Orders are usually dispatched within 1–2 working days and arrive in 3–5 working days (major cities are often faster).",
    "Cash on Delivery orders may receive a confirmation call or WhatsApp message before dispatch.",
    "EasyPaisa / JazzCash orders are dispatched after we verify your payment.",
  ],
  returns: [
    "Unworn items with their original tags can be exchanged or returned within {days} days of delivery.",
    "Sale items can be exchanged for a different size only (subject to stock).",
    "To start an exchange or return, message us on WhatsApp with your order number and a photo of the item.",
    "If an item arrives damaged or wrong, tell us within 48 hours and we will replace it at no cost.",
    "Refunds for prepaid orders are sent to the same EasyPaisa / JazzCash account within 5–7 working days after we receive the item.",
  ],
  privacy: [
    {
      title: "What we collect",
      body: "Your name, mobile number, email (optional), delivery address and order details; for EasyPaisa / JazzCash orders, the Transaction ID and receipt image you upload. If you create an account, your saved addresses and wishlist.",
    },
    {
      title: "How we use it",
      body: "Only to process and deliver your orders, verify payments, contact you about your order and provide customer support. We do not sell your data.",
    },
    {
      title: "Who can see it",
      body: "Store staff with admin access, and our courier partner (name, phone and address only, to deliver your parcel). Payment receipts are kept in private storage and are visible to store staff only.",
    },
    {
      title: "How we protect it",
      body: "The website uses HTTPS. Passwords are handled by our authentication provider and are never visible to us. Access to orders and receipts is restricted to authorised staff.",
    },
    {
      title: "Your choices",
      body: "You can update your profile and addresses in My Account. To have your account or data removed, contact us on WhatsApp or by email.",
    },
  ],
  terms: [
    {
      title: "Orders",
      body: "An order is confirmed once our team accepts it. For EasyPaisa / JazzCash orders this happens after the payment is verified. We may cancel an order if an item is out of stock or a payment cannot be verified; any payment received is then refunded.",
    },
    {
      title: "Prices",
      body: "Prices are in Pakistani Rupees (PKR). The price, delivery charge and any discount shown at checkout are the amounts you pay.",
    },
    {
      title: "Payments",
      body: "We accept Cash on Delivery, EasyPaisa and JazzCash. For wallet payments, send the exact amount to the account shown on your order page and submit the Transaction ID and receipt. We never ask for your PIN or OTP.",
    },
    {
      title: "Coupons",
      body: "Coupons have their own conditions (minimum order, validity, number of uses) and cannot be exchanged for cash.",
    },
    {
      title: "Product images",
      body: "Colours may look slightly different on different screens.",
    },
  ],
} as const;
