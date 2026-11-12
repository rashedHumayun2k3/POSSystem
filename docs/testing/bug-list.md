# Bug List — Test Run 2026-11-11

**Business:** TOSS Collection (test)
**User:** LTM (OWNER)
**Language:** বাংলা
**Browser:** Chrome desktop. The window could not be resized to phone width, so mobile layout is checked separately.

**Severity:**
- Critical: wrong money or stock, data loss, crash, or a security leak.
- High: a flow is blocked.
- Medium: a wrong display or validation gap.
- Low: cosmetic or text.

| ID | Module | Severity | Bug | Steps | Expected | Actual |
|----|--------|----------|-----|-------|----------|--------|
| B-01 | Partners | High | Profit share % silently lost | Add Partner, type "abc150" in সম্মত প্রফিট শেয়ার %, Save | Field blocks letters; values above 100 are rejected | Saves with "Partner added."; profit share stored as empty (দেওয়া হয়নি), with no warning |
| B-02 | Partners | Medium | NID accepts any text | Add Partner, NID = "abcd12" | Digits only, 10/13/17 length | Saved as "abcd12" |
| B-03 | Partners | Medium | Email not validated | Add Partner, email = "notanemail" | Error under the field | Saved |
| B-04 | Partners | Medium | Phone fields accept letters | Type "abc!@#12" in ফোন | Only digits can be typed | Letters are accepted; an error appears afterwards (blocking at typing time is better) |
| B-05 | Partners | Low | Bank account no. accepts letters | Type "xyz" | Digits only | Saved as "xyz" |
| B-06 | Partners | Low | Toast in English | Save a partner | "পার্টনার যোগ হয়েছে" | "Partner added." |
| B-07 | Cash In/Out | Medium | Wrong time on cash-in row | Cash In with today's date | No time shown, or the real entry time | Shows "6:00 AM" (a date-only value shown as a UTC-midnight time) |
| B-08 | Cash In/Out | Low | Success message colour | Save a cash in or out | Green success text | Orange/red text, which looks like an error |
| B-09 | Global | Low | Mixed number formats | Compare the Partners page (৳205,100.00) with Cash In/Out (৳1,00,000) | One format everywhere | Western grouping with .00 on one page, Indian lakh grouping on another |
| B-11 | **Global (web)** | **High** | Confirm popups don't open on web, so the buttons do nothing | Categories → ডিলিট করুন | A confirm popup appears | Nothing happens. `Alert.alert` with buttons is a no-op on react-native-web. 12 places: Categories, CategoryDetail, Staff, ExpenseCategories, NewExpense, PartnerDetail, ProductDetail ×6. On the phone app they work but the text is English |
| B-12 | Categories | Medium | Duplicate category allowed | New category "saree" when "Saree" exists | "এই নামে ক্যাটাগরি আছে" | Created a second "saree" |
| B-13 | Categories | Low | Empty-name create gives no feedback | Click ক্যাটাগরি তৈরি করুন with an empty name | Error under the field | Nothing happens |
| B-14 | Products | High | Fractional stock for a "pcs" product | Setup step 4: initial quantity 5.5 pcs | Whole numbers only for pcs/pair | 5.5 saved. Afterwards "− স্টক কমান" rejects 0.5 ("must be at least 1"), so it can only be fixed with পুনঃগণনা |
| B-15 | Products | Medium | Cost above sale price, no warning | Setup: sale price 1500, cost 2000 | Warning: "ক্রয়মূল্য বিক্রয়মূল্যের চেয়ে বেশি" | Saved silently; profit shows "৳-500" |
| B-16 | Products | High | Sale price ৳0 accepted | Pricing tab → edit price → 0 → Save | Blocked | Saved. Selling at ৳0 is possible |
| B-17 | Products | Medium | Stock history times in UTC | Adjust stock at 13:43 BD time | 13:43 | 07:43 (the same issue as B-07) |
| B-18 | Products | Low | Mixed digits in step counter | Setup wizard | "ধাপ 2 / 4" | "ধাপ 2 / ৪" (Bangla ৪) |
| B-19 | Products | Medium | Price field accepts letters | Setup step 2: type "-abc12.345" | Blocked while typing | Accepted; error only on Save |
| B-20 | Products | Low | Possible duplicate on a slow create | Click পণ্য তৈরি করুন; there's no loading state for about 1s | Button disabled with a spinner | No loading indicator, so users will tap twice (check the product list for duplicates) |
| B-21 | **Purchases / Stock** | **Critical** | Damaged units deducted from stock twice | PO: 10 ordered, receive 9 good + 1 damaged, with 5 in stock before | Available = 14 | Shows 13. DB: OnHand=14, Damaged=1. [PurchaseTripService.Receiving.cs:170-181](backend/src/ResellerApi/Services/PurchaseTripService.Receiving.cs#L170-L181) adds only usable to OnHand but also adds to Damaged, while `Available = OnHand − Committed − Damaged` assumes OnHand includes damaged. The same pattern exists in the order return path ([OrderService.cs:952](backend/src/ResellerApi/Services/OrderService.cs#L952)). Every PO with damage under-counts sellable stock |
| B-22 | **Cash / Funds** | **High** | Partner withdrawal not deducted from the "business usable balance" | Cash Out ৳5,000, then open PO → পেমেন্ট যোগ করুন | ৳2,80,000 (matches the Cash Out page) | Shows ৳285,000; after paying ৳18,000 it shows ৳267,000. Two screens disagree about how much money the business has |
| B-23 | Purchases | Medium | Times in one list use different time zones | PO → খরচ tab | Both in BD time | Product payment "7:47:39 AM" (UTC), transport payment "1:48:35 PM" (local) |
| B-24 | Purchases | Low | Every payment numbered PT-0001 | Add 3 payments in one PO | PT-0001, PT-0002, PT-0003 | All show PT-0001 |
| B-25 | Purchases | Medium | Supplier mobile not validated | Add supplier with mobile "01abc" | Blocked | Saved |
| B-26 | Purchases | Medium | Qty/price in Add product accept letters, and Save is disabled with no reason | Type "abc2.5" / "x-1800" | Letters blocked | Accepted; no message |
| B-27 | Purchases | Medium | Receive: damaged above the lot quantity gives no message | Lot 10, damaged 12 | "মোট 10-এর বেশি হতে পারবে না" | ভালো পণ্য goes blank and the button is disabled with no message |
| B-28 | Purchases | Low | Step banner doesn't move forward | After marking shipped, then after completion | Banner shows the current step | Still "ধাপ 3: কুরিয়ারের জন্য লট তৈরি করুন" even when COMPLETED |
| B-29 | Purchases | Low | Overview says 5 steps; the stepper shows 4 | কাজের ধাপ tab vs প্রোডাক্ট tab | Same count | 5 vs 4 |
| B-30 | Purchases | Low | Draft PO created as soon as the type is picked | Pick a type → ক্রয় অর্ডার শুরু করুন → leave | No PO until something is saved | Empty DRAFT PO left in the list |
| B-31 | Products | Low | Avg cost rounding | (5×2000 + 9×2061.11)/14 = 2039.2857 | ৳2,039.29 | ৳2,039.28 (truncated) |
| B-32 | Products | Low | PO receipt missing from stock history | Receive a PO, open স্টক কম-বেশি করুন tab | Shows "+9 ক্রয় থেকে" and "1 ক্ষতিগ্রস্ত" | Only manual adjustments are listed |
| B-33 | Discounts | Low | Stale error stays after the popup closes | Discount 95% → error → Esc | Error cleared | "Discount must be between 1% and 90%." stays on the page |
| B-34 | Discounts | Low | Apply popup stays open with no confirmation | Apply discount → Apply | Closes with a success toast | Stays open |
| B-35 | **Security** | **Critical** | Production DB password committed to git | Open `backend/src/ResellerApi/appsettings.Production.json` | Secrets in environment variables or user-secrets | The production SQL Server user and password are in the repo. **Change that password**, and remove the file from git history |
| B-36 | **POS** | **High** | No warning when selling below cost | Cart → change unit price to ৳1,000 (cost ৳2,039) → review → confirm is enabled | "লোকসানে বিক্রি হচ্ছে" warning, and STAFF blocked below the safe-discount floor | Goes straight through; a ৳2,078 loss with no warning |
| B-37 | POS | Medium | A letter in the price wipes the value to 0 | Unit price: type "1a000" | Letter ignored, stays 1000 | Field becomes 0 and the total becomes ৳0 |
| B-38 | POS | Low | Quantity silently capped at stock | Tap the product 15× with 13 in stock | "স্টকে মাত্র 13টি আছে" | Stops at 13 with no message |
| B-39 | Global | Medium | **Bangla digits appear** (the rule is English digits) | POS cart "কার্টে ১টি", "১টি পণ্য", "মোট পরিমাণ: ২টি"; Due page "৳২,৫০০.০০", "১ জন", "১১ নভেম্বর, ২০২৬"; product setup "ধাপ 2 / ৪" | English digits everywhere | Bangla digits in these places |
| B-40 | POS | Low | bKash TxID error shown before typing | Part Paid → select bKash → enter amount | Error after the user leaves the TxID field empty | "অক্ষর ও সংখ্যা দিয়ে লেনদেনের আইডি দিন।" appears immediately |
| B-41 | POS | Medium | Due-sale customer requires a delivery address | বাকি আছে → নতুন কাস্টমার → phone + name | Address optional for a shop sale | "নতুন গ্রাহক নির্বাচন করুন" stays disabled until an address is typed |
| B-42 | POS | Low | Customer phone accepts letters | New customer phone "0171abc" | Digits only | Accepted; button disabled with no message |
| B-10 | Cash In/Out | Low | Row shows "Cash" in English | Bangla mode, transactions list | নগদ | "6:00 AM · Cash" |

## Fix status (branch `fix/qa-bugs-2026-11-11`)

All bugs fixed except **B-36** (left as requested).

- **B-20** was not a bug: the button already shows a spinner and blocks a second tap.
- **B-24:** the popup showed the internal trip number. It now shows the PO name.
- **B-29:** the guide now has 4 steps, matching the progress bar ("পণ্য পাঠান ও বুঝে নিন" merges create-lot and receive).
- **B-35:** the secrets moved to the git-ignored `appsettings.Production.secrets.json`. **The password is still in git history, so change the DB password, JWT key and SMTP password.**
- **B-21:** for existing damaged stock, the corrected numbers appear right away. No data change was needed, because OnHand never included damaged units.
