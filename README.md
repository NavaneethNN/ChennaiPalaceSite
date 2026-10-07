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
