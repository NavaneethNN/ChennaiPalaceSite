# Chennai Palace — content and brand guide

The site was rebuilt around the supplied `Logo.png`: royal purple (#8d258e), rose pink (#d781b4), deep plum (#43223f), and warm ivory (#fbf7f1).

## Content sources

Restaurant details, opening hours, dishes, prices, and food imagery were taken from the user-provided reference:

- https://chennaipalace.thrivehausdigital.com.au/
- https://chennaipalace.thrivehausdigital.com.au/menu/

Retrieved 7 October 2026. The reference labels its food images as illustrative. These have been retained as illustrative food photography; replace them with restaurant photographs when available. Prices and opening hours should be checked with the restaurant before launch. Tuesday hours were not provided.

The new source content replaces the previous draft brief and its unconfirmed buffet, heritage, and contact information.

## Updating the site

- `src/lib/content.ts`: telephone, address, maps link, hours, food features, and dining experiences.
- `src/lib/menu.json`: all 52 menu items, grouped into five categories. Each item has a name, price, and optional description.
- `src/components/HomeContent.tsx`: homepage editorial copy and section layout.
- `public/images/`: locally hosted food photography and optimized logo. The original `Logo.png` is preserved at the project root.
- `public/fonts/`: locally hosted Cormorant Garamond and DM Sans.
- `src/app/globals.css`: complete responsive design system and motion preferences.

Booking buttons open a dialog with the restaurant’s telephone number. Bookings and takeaway orders are completed by phone; there is no booking backend or simulated confirmation.

## Running locally

```sh
npm install
npm run dev
```

Production verification:

```sh
npm run lint
npm run build
npm run start
```

Set `NEXT_PUBLIC_SITE_URL` to the final public origin when deploying so social image URLs use the right domain. The source reference domain is the default.

## Checks completed

Production build and ESLint; desktop and mobile browser checks at 320, 390, 768, and 1440 pixels; all 52 menu items; search, category filters, empty states, category links, booking dialog, experience accordion, and mobile navigation. Automated WCAG 2.1 AA checks reported no violations on the homepage, menu page, or booking dialog.

## Responsive and motion refinements

The site includes responsive phone/tablet spacing, larger touch targets and text, phone menu filters that stay available while browsing, short-screen navigation, and a sticky-header active-section indicator. Section reveals run once, with short entrance transitions for the hero, booking dialog, and navigation. Experience panels animate their height and keep collapsed controls out of the keyboard focus order. All motion respects the visitor’s reduced-motion preference.

Development uses `.next-dev`; production builds use `.next`, so building does not overwrite the active development server’s assets.
