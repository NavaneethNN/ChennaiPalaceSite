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

- `/order`: customers select an available table number and place an order. The
  receipt shows their saved items, prices, total and live acceptance status, even
  after reloading the page. `/order?table=12` prefills a configured, active table
  and can be used as a table QR-code destination.
- `/admin`: sign in with `SUPERADMIN_PASSWORD`. Manage dishes, AUD prices, categories,
  descriptions, stock, visibility and each item's KOT destination. Add table numbers
  from **Dining tables** and hide or re-enable them as needed. Create cashiers
  with a unique 4 digit login PIN and 4 digit password, including leading zeroes.
  Configure **Printers** to detect connected Windows receipt printers and assign one
  printer for the kitchen and one for the cashier counter.
- `/cashier`: sign in using the cashier PIN and password. Accept/reject orders,
  view table totals, reopen KOT PDFs, and close a session after manual billing.
  Cashiers cannot access menu, stock or account administration.

Orders await cashier acceptance. Acceptance reduces tracked stock atomically and
adds the order to the table's running total. Blank stock means unlimited; zero stock
means sold out. Rejected orders do not reduce stock or affect the total. Each order
retains its submitted price and printer destination even when the menu is edited.
Multiple orders for a table share one open session. Pending orders must be accepted
or rejected before closing; the next order at a closed table starts a new session.
The customer who starts a table session can order more from the same browser;
other customers see that table as in use and cannot submit orders for it until
the cashier closes the session.
Closed sessions and their order snapshots remain available in the staff history.
Closing also checks the displayed total and order count, so changes during manual
billing require the cashier to review the table again.

Acceptance opens a printable, receipt-width KOT PDF in a new browser tab. The
combined PDF has one section/page per destination that has items, labeled Kitchen
or Cashier, with table, order, time, quantities, customer notes, and the configured
printer name. Separate PDF links let the cashier print only the relevant destination.
Allow popups for this site to open KOTs automatically. PDF links remain available
if popups are blocked.

### Windows 2-Printer Hardware & Automatic Paper Sizing

When 2 thermal receipt printers are connected to the same Windows system (via USB or network):
1. In the **Admin** panel, navigate to the **Printers** section.
2. Click **Scan Windows printers** to query Windows (PowerShell/CIM) for installed printer names.
   - If running locally on Windows, the server detects installed printers natively.
   - If running remotely or in the cloud, run `scripts/windows-printer-bridge.bat` on the Windows machine
     to expose a local bridge on `http://127.0.0.1:18080/printers` for one-click browser detection.
   - Printers can also be selected from common presets (POS-80, POS-58, EPSON TM-T88, Star TSP100) or typed directly.
3. Assign one printer as **Kitchen printer** and one as **Cashier printer**.
4. Configure or auto-detect paper roll sizes:
   - **80mm (Standard 3-inch roll)**: Generates full-width 226.77pt KOT slips with large kitchen typography and 24-character item columns.
   - **58mm (Compact 2-inch roll)**: Automatically reduces width to 164.41pt, tightens margins, and scales font sizes and line wrapping (16-character columns) to fit smaller rolls without truncation.
   - Paper size is automatically inferred from printer names (e.g. `POS-58` → 58mm, `POS-80` → 80mm) and can also be explicitly selected.
5. Click **Save printer configuration**.
6. Use **Test kitchen slip ↗** and **Test cashier slip ↗** to verify print output on both devices.
7. Dishes configured with "Kitchen printer" route to the kitchen printer, while drinks, desserts, and
   counter items configured with "Cashier table printer" route to the cashier printer. Both order
   cards and KOT PDFs display the assigned physical printer and formatted paper size.

### High-Speed Continuous Printing Engine

During busy restaurant service with multiple orders arriving simultaneously:
- **Zero Browser Pop-up Blocking**: Acceptance dispatches print jobs directly to the sequential print engine (`enqueueOrderPrint`). No browser popup tabs are opened, preventing Chrome/Edge from blocking tabs when 10+ orders are accepted in rapid succession.
- **Direct Hardware Printing**: When `windows-printer-bridge.bat` is running on the Windows POS machine, print jobs are sent via high-speed text protocol directly to the Windows print spooler (`Out-Printer`) in under 100 milliseconds per ticket.
- **Sequential FIFO Spooling**: Print jobs are queued and dispatched with rate-limited intervals (150ms) to prevent printer buffer conflicts or dropped tickets.
- **Silent Background Fallback**: If the bridge is not running, jobs print smoothly via a background hidden iframe (`iframe.contentWindow.print()`).
- **Live Status Badging & Reprinting**: Order cards show live print progress (`Printed ✓`, `Printing…`, or `Retry print ↻`). Any accepted order can be reprinted with one click via the **Reprint KOT** button if paper runs out.
- **Auto-Print Toggle**: Cashiers can toggle **Auto-print KOT on accept** directly from the orders queue header.
Billing and payments remain external; KOTs are not tax invoices.

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
