# Admin guide — Mohsin FutureTech

For the store owner and staff. Everything is done in the browser at
**`https://your-domain/admin`** — on a computer or a phone.

*Roman Urdu khulasa is guide ke aakhir mein hai.*

---

## 1. Signing in

1. Open the site → **Sign in** (person icon) with your admin email and password.
2. Go to **`/admin`**, or My Account → **Store admin**.
3. Forgot your password? Use **Forgot password?** on the sign-in page.

Only accounts made admin by the developer can open the admin area. Never share
your password; each staff member should have their own account.

## 2. Your daily routine (10–15 minutes)

1. **Dashboard** — the yellow **"Needs your attention"** box lists what to do:
   payments to verify, orders to confirm, delivered COD orders to mark paid.
   The numbers next to **Orders**, **Payments** and **Inventory** in the menu
   show the same.
2. **Messages** → answer customer chats (section 4a).
3. **Payments** → verify EasyPaisa / JazzCash payments (section 3).
4. **Orders** → confirm new COD orders, pack, ship, deliver (section 4).
5. **Inventory** → restock anything marked low (section 6).

## 3. Verifying EasyPaisa / JazzCash payments

When a customer pays by EasyPaisa or JazzCash, they send money to the store's
account and upload the **Transaction ID** and a **screenshot**. The payment
shows as **Pending Verification** until you check it.

**Admin → Payments** shows each submission with the order number, customer,
amount, Transaction ID and the screenshot (tap it to enlarge).

**Always check in your own EasyPaisa / JazzCash app, not only the screenshot.**
Screenshots can be edited. In your wallet app confirm that:

- a payment with **that Transaction ID** arrived,
- for **exactly** the order amount shown,
- recently (around the time submitted).

Then:

- **Approve payment** → the payment becomes *Approved* and a pending order is
  automatically *Confirmed*.
- **Reject…** → write the reason the customer will see (e.g. "Amount received
  is Rs 500 less than the order total" or "Transaction ID not found"). The
  customer can then upload corrected details from their order page.

The same Transaction ID can't be used for two orders — the site blocks it.

## 4. Orders

**Admin → Orders**: search by order number, customer name or phone; filter by
status, payment status or method. Tap an order to open it.

The order page shows the customer, delivery address (tap the phone number to
call, or **WhatsApp**), items with sizes/colours/SKU, totals, payment details
and the full history (who changed what and when).

### Order steps (proposal §7)

| Status | What it means | What you do |
|---|---|---|
| **Pending** | New order | COD: call/WhatsApp to confirm, then **Confirm order**. Wallet: approve the payment first (Confirm stays grey until then). |
| **Confirmed** | Accepted | **Start processing** when you begin packing |
| **Processing** | Being packed | **Mark as shipped** — put the courier name and tracking number in the **Note** box |
| **Shipped** | With the courier | **Mark as delivered** when it arrives |
| **Delivered** | Received | COD: collect the cash, then mark paid (below) |
| **Cancelled** / **Returned** | Closed | Stock is added back automatically |

Notes are saved in the order history. Customers see the progress (not your
notes) on their order page, in My Account and on **Track your order**.

### Cash on Delivery

After the rider hands over the cash: **Payments → Cash on Delivery to collect**
→ **Mark as paid** (or from the order page).

## 4a. Messages (live chat)

Customers can chat with the store from the round **chat button** at the
bottom-right of every page (not on checkout). They give their name, and
optionally their mobile number and order number. Signed-in customers' chats
follow their account.

**Admin → Messages**:

- **Open** chats are listed newest first; a red number shows unread
  messages. The **Messages** item in the menu and the Dashboard show how many
  chats are waiting. New messages appear by themselves every few seconds —
  keep this page open while you are available.
- Open a chat to see the conversation, the customer's phone (call or
  **WhatsApp**), email and order number (tap to open the order).
- Type a reply and press **Enter** (Shift + Enter for a new line). The
  customer sees it within a few seconds.
- **Close chat** when the question is answered. If the customer writes again
  they start a new chat; replying to a closed chat reopens it.

Good to know:
- There is **no alert on your phone** when a chat arrives — check Messages
  regularly during business hours (the hours shown to customers are in
  `src/config/policies.ts`). Customers who need you urgently can still use
  WhatsApp.
- Never ask for or accept a customer's PIN, OTP or card number in chat.

## 5. Products

**Admin → Products → Add product**

1. **Basics**: name (the web address fills in automatically), category,
   department (Men / Women / Unisex), description, details (one per line:
   fabric, fit, care).
2. **Price**: the selling price. For a sale, put the old price in **Was price**
   — the shop shows the discount and a Sale badge.
3. **Show in shop / Featured on homepage / New arrival** tick boxes.
4. **Sizes, colours & stock**: one row per size + colour, with its opening
   stock. The SKU fills in automatically (you can type your own). Use
   **Different price** only if one size costs more.
5. **Create product**, then **add photos** on the next screen.

**Photos**: portrait (3:4), for example 1200 × 1600 px, JPG, under 1 MB looks
best; up to 8 per product. The first photo is the main one; use ← Earlier /
Later → to reorder. Write a short description of each photo (helps blind
customers and Google).

**Editing**: change anything and **Save product**. Stock of existing sizes is
changed in **Inventory** (so every change is recorded). To stop selling one
size, untick **On sale in the shop** — sizes are never deleted, so old orders
keep their details.

**Archive vs delete**: **Archive product** hides it from the shop but keeps it
for reports and old orders. **Delete permanently** only appears for products
that were never ordered.

## 6. Inventory (stock)

**Admin → Inventory** lists every size/colour with its stock. Tabs: **All**,
**Low stock** (at or below the level in Settings) and **Sold out**.

- New stock arrived: enter the quantity → reason *New stock received* → **+ Add**.
- Damaged/lost/count correction: quantity → reason → **− Remove**.
- Orders reduce stock automatically; cancelled/returned orders put it back.

**Recent stock changes** shows every change, why, who did it and which order.

## 7. Categories

**Admin → Categories**: add a category, set its **position** in the menu
(lower numbers first), upload a **photo**, or untick **Visible in the shop**
to hide it. A category can only be deleted when it has no products.

## 8. Coupons

**Admin → Coupons → Add coupon**: code (e.g. `EID25`), percentage or fixed
amount, minimum order, maximum number of uses, start/end dates. Untick
**Active** to switch a code off. The list shows how many times each code was used.

## 9. Customers

**Admin → Customers**: search by name, email or phone; see the number of
orders and total spent. Open a customer for their contact details, saved
addresses and order history. (Guests who checked out without an account
appear under **Orders** only.)

## 10. Reports

**Admin → Reports**: choose **Today, Last 7 days, Last 30 days, This month,
Last month, This year** or your own dates, and **Daily** or **Monthly**.

- **Sales** — orders placed in the period, not cancelled/returned
- **Payments received** — of those, approved or paid
- Orders placed, average order, items sold, customers
- Sales chart (tap a bar for details), daily/monthly table, **best sellers**,
  payment methods
- **Download CSV** opens in Excel

All dates are Pakistan time.

## 11. Settings

**Admin → Settings** — changes show on the site immediately:

- Store name, WhatsApp number (chat button), phone, email, shop address
- Delivery charge and the order amount for **free delivery**
- **Low-stock warning** level
- **EasyPaisa and JazzCash account name and number** — customers send money
  exactly to what is written here, so **double-check every digit**. A wallet
  only appears at checkout when both its name and number are filled in.

## 12. Safety rules

- Approve a payment only after seeing it **in your wallet app**.
- The store **never** asks customers for a PIN or OTP — warn customers who say
  someone asked for one.
- Don't share admin passwords; ask the developer to remove access for staff
  who leave.
- Payment screenshots contain customers' private data — don't forward them.

## 13. Common questions

| Question | Answer |
|---|---|
| A customer paid but forgot to upload the receipt | They can open their order page (from the confirmation, My Account, or **Track your order** with order number + phone) and upload it. |
| A customer uploaded the wrong screenshot | **Reject…** with the reason; they can upload again. |
| Can I change an order's items or price? | No — cancel it (stock returns) and ask the customer to order again. |
| A product shows the wrong stock | Fix it in **Inventory** with + / − and a reason. |
| JazzCash/EasyPaisa disappeared at checkout | Its account name or number is empty in **Settings**. |
| Who changed this order? | The **History** box on the order page lists each change and who made it. |

---

## Roman Urdu khulasa

**Login:** site par apne admin email se Sign in karein, phir `/admin` kholein.

**Rozana ka kaam:**
1. **Dashboard** par peela dabba "Needs your attention" dekhein. Is mein woh sab hota hai jo aaj karna hai.
2. **Payments:** har EasyPaisa/JazzCash payment ko **apne wallet app mein** check karein: Transaction ID, poori raqam aur waqt. Sirf screenshot par bharosa na karein, screenshot edit ho sakta hai. Sab theek ho to **Approve** karein, order khud Confirmed ho jayega. Ghalat ho to **Reject…** dabayein aur wajah likhein. Customer dobara bhej sakta hai.
3. **Orders:**
   - COD orders par customer ko call ya WhatsApp karke **Confirm order** karein.
   - Packing shuru ho to **Start processing**.
   - Courier ko dein to **Mark as shipped**, aur Note mein courier ka naam aur tracking number likhein.
   - Customer tak pahunch jaye to **Mark as delivered**.
   - COD ka paisa mil jaye to Payments mein **Mark as paid**.
4. **Inventory:** naya maal aaye to **+ Add**, kharab maal ho to **− Remove**. Har tabdeeli wajah ke saath record hoti hai.

**Naya product:** Products → **Add product** → naam, price, category → har size aur rang ki line, shuru ka stock ke saath → **Create product** → tasveerein upload karein (3:4 portrait, 1MB se kam). Sale ke liye purani qeemat **Was price** mein likhein.

**Product band karna:** **Archive** karne se product shop se chhup jata hai, lekin purane orders mehfooz rehte hain.

**Messages (live chat):** customer site par chat ke button se message bhejte hain. Admin → **Messages** mein laal number wali chats nayi hain. Chat kholein, jawab likhein aur **Enter** dabayein. Customer ko kuch second mein jawab mil jata hai. Kaam ho jaye to **Close chat** karein. Phone par alert nahi aata, is liye kaam ke auqaat mein yeh page khula rakhein.

**Reports:** din, hafta, mahina ya apni dates chunein. Sales, wusooli aur best sellers dekhein. **Download CSV** se Excel mein khulta hai.

**Settings:** WhatsApp, delivery charges aur **EasyPaisa/JazzCash account number** yahan hain. Har number dhyan se check karein, kyunki customer isi number par paisa bhejta hai.

**Hifazat:**
- Hum customer se kabhi PIN ya OTP nahi maangte.
- Admin password kisi ko na dein.
- Payment screenshots aage forward na karein.
