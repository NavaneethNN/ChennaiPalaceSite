# Chennai Palace — South Indian Kitchen · Adelaide

A modern, responsive restaurant website built with Next.js 15, showcasing authentic South Indian cuisine in Adelaide, Australia.

## ✨ Features

- **Fully Responsive Design**: Optimized for mobile (320px+), tablet (600-1100px), and desktop (1100px+) devices
- **Accessible**: WCAG 2.1 Level AA compliant with keyboard navigation and screen reader support
- **Performance Optimized**: Built with Next.js 15 for optimal loading speed and SEO
- **Motion-Aware**: Respects `prefers-reduced-motion` user preferences
- **Modern UI**: Clean, elegant design with smooth animations and interactions

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/NavaneethNN/ChennaiPalaceSite.git

# Navigate to project directory
cd ChennaiPalaceSite

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## 📱 Responsive Breakpoints

- **Mobile**: ≤600px
- **Tablet**: 600px - 1100px
- **Desktop**: 1100px+
- **Ultra-wide**: 1600px+ (centered layout with max-width constraints)

## ♿ Accessibility Features

- Keyboard navigation support for all interactive elements
- Screen reader-friendly semantic HTML
- Focus indicators with 3px rose outline
- `inert` attribute management for accordion panels
- Skip-to-content link for keyboard users
- Touch targets meet 44×44px minimum size
- Reduced motion support for animations

## 🎨 Tech Stack

- **Framework**: Next.js 15.3.4
- **Styling**: Tailwind CSS + Custom CSS
- **Icons**: Lucide React
- **Typography**: Custom web fonts (PalaceSerif, PalaceSans)
- **Images**: Next.js Image component with optimization
- **Deployment**: Ready for Vercel/Netlify

## 📂 Project Structure

```
ChennaiPalace/
├── src/
│   ├── app/
│   │   ├── globals.css          # Global styles & responsive breakpoints
│   │   ├── layout.tsx           # Root layout with metadata
│   │   ├── page.tsx             # Home page
│   │   └── menu/
│   │       └── page.tsx         # Menu page
│   ├── components/
│   │   ├── HomeContent.tsx      # Home page client component
│   │   ├── MenuContent.tsx      # Menu page client component
│   │   └── SiteShell.tsx        # Header, footer, navigation
│   └── lib/
│       ├── content.ts           # Site content configuration
│       └── menu.json            # Menu data
├── public/
│   ├── fonts/                   # Custom web fonts
│   └── images/                  # Optimized images
└── content.md                   # Content reference document
```

## 🎯 Performance

- **Build Time**: ~0ms (cached)
- **Static Generation**: All pages pre-rendered
- **First Load JS**: ~117 KB (optimized bundle)
- **Image Optimization**: WebP format with responsive sizing

## 📄 License

This project is private and proprietary to Chennai Palace.

## 🤝 Contributing

This is a client project. For inquiries, please contact the development team.

---

**Built with ❤️ for Chennai Palace** · Adelaide, South Australia

## Table ordering and restaurant operations

The live menu and restaurant workflow use PostgreSQL (Neon). Configure `DATABASE_URL`
and `SUPERADMIN_PASSWORD` in `.env.local` locally, and in the hosting environment
for production. `.env.example` contains placeholders only. No database credentials
or staff passwords are sent to the browser.

Run `npm run db:setup` to create the dedicated `palace` schema and seed the existing
52 dishes in an empty menu. It is safe to run again; existing menu data is preserved.
`DATABASE_URL_UNPOOLED`, when provided, is used for setup only.

- `/order`: customer orders with a table number (1–999). `/order?table=12` prefills
  a table number and can be used as a table QR-code destination.
- `/admin`: sign in with `SUPERADMIN_PASSWORD`. Manage dishes, AUD prices, categories,
  descriptions, stock, visibility and each item's KOT destination. Create cashiers
  with a unique 4 digit login PIN and 4 digit password, including leading zeroes.
- `/cashier`: sign in using the cashier PIN and password. Accept/reject orders,
  view table totals, reopen KOT PDFs, and close a session after manual billing.
  Cashiers cannot access menu, stock or account administration.

Orders await cashier acceptance. Acceptance reduces tracked stock atomically and
adds the order to the table's running total. Blank stock means unlimited; zero stock
means sold out. Rejected orders do not reduce stock or affect the total. Each order
retains its submitted price and printer destination even when the menu is edited.
Multiple orders for a table share one open session. Pending orders must be accepted
or rejected before closing; the next order at a closed table starts a new session.
Closed sessions and their order snapshots remain available in the staff history.
Closing also checks the displayed total and order count, so changes during manual
billing require the cashier to review the table again.

Acceptance opens a printable, receipt-width KOT PDF in a new browser tab. The
combined PDF has one section/page per destination that has items, labeled Kitchen
or Cashier, with table, order, time, quantities and customer notes. Separate PDF
links let the cashier print only the relevant destination. Allow popups for this
site to open KOTs automatically. PDF links remain available if popups are blocked.
Physical printer routing and silent printing are not connected yet. Billing and
payments remain external; KOTs are not tax invoices.

Staff sessions use HttpOnly cookies, expire after 12 hours, and are revoked when a
cashier is disabled or their password is reset. Passwords are stored as salted
scrypt hashes. Login attempts are limited to 10 per account in 15 minutes.
Staff screens receive server-sent events after database commits. `DATABASE_URL_UNPOOLED`
enables a shared PostgreSQL LISTEN connection for immediate notifications; a durable
revision check recovers missed events (every second without a direct connection).
Browsers reconnect automatically, with a five-second refresh fallback while disconnected.
Keep the cashier screen open during service. Customer status refreshes every two seconds,
and open customer menus refresh every five seconds. The hosting provider must support
streaming responses for live notifications. Staff streams reauthorize every 15 seconds
and reconnect before 60 seconds.

Admin edits use optimistic version checks so an old form cannot overwrite stock deducted
by a newly accepted order. Close and reopen the editor if a conflict is reported.
The schema setup is additive and preserves existing menu, staff and order data.

### Validation

`npm run lint`, `npx tsc --noEmit`, and `npm run build` check the application.
In restricted environments where Turbopack cannot start its compiler worker, use
`npm run build -- --webpack`.
For full integration/browser coverage, start `npm run start -- --port 3100` after
building, then run `npm run test:restaurant`. Set `TEST_BASE_URL` to test another
local port. Chromium must be installed with `npx playwright install chromium`.
The test uses the configured Neon database, creates isolated test items and a test
cashier at an unused table, and removes its records afterward. Run against a test
or staging environment when the restaurant is in service.

## Customer menu and ordering experience

The [customer menu design](CUSTOMER_MENU_DESIGN.md) records the layout, optional
add-on rules, and metrics to evaluate whether it helps customers build meals.
The menu can carry a selected item into `/order`; suggested additions use only
available dishes and show their prices before they are added. For a local browser
check, start the built site and run `npm run test:customer` with `TEST_BASE_URL`
pointing at the local site.
