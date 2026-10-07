# Customer menu and ordering design

The customer flow now moves from `/menu` to `/order` with a chosen dish carried into the cart. This is intended to make it easier to begin an order and discover complementary items. It does not guarantee a higher average bill; that needs to be measured with real orders.

## Layout

1. **Menu landing:** a clear table-order button in the hero, a small inspiration row using available dishes, then the searchable full menu. Every available dish has an Add action that opens the order screen with that dish selected.
2. **Ordering start:** a short introduction, three example dishes with visible prices, then search and category filters. The filters remain accessible while scrolling through a long menu.
3. **Cart:** an always-visible total on desktop. On mobile, a bottom bar shows the item count and total and opens the cart. The table number, notes, total, and send action sit together at the final decision point.
4. **Relevant additions:** after a diner selects food, the cart suggests up to two available, unselected items. Curries prompt bread or rice; dosa prompts a drink; biryani prompts a drink. The diner adds each item explicitly, and its price is shown first.
5. **Checkout:** the customer sees an estimated total and sends the order for cashier acceptance. Billing and payment remain at the cashier.

## Trust and accuracy

- No automatic add-ons, fake discounts, timers, or invented sales-rank badges.
- Featured and suggested dishes come from the live menu. Sold-out items are hidden from these prompts.
- Menu prices come from the database, while the server validates price, stock, and availability when the customer submits.
- Allergy requests still direct customers to staff; the suggestions do not claim an item is safe for a specific diet.

## What to measure

Compare a baseline period with a later period of similar service hours. Track order submission rate, average accepted order value, average items per accepted order, the share of orders containing suggested sides or drinks, and rejected orders due to stock. Review results by lunch/dinner and weekday/weekend before changing the recommendation rules. Avoid treating click counts alone as successful upselling.

Research on restaurant menu presentation indicates that recommendation and description framing can influence choices, with effects varying by diner. This design treats those findings as a reason to test the layout, not as a promised revenue increase: [published menu-design experiment](https://pubmed.ncbi.nlm.nih.gov/29428546/).
