# Design Guidelines: Inventory & Sales Management System

## Design Approach
**Selected Approach:** Modern Design System (inspired by Linear + Notion)
- Prioritizes clarity, speed, and data density
- Clean, minimal aesthetic that stays out of the user's way
- Focus on efficient workflows and quick data access

## Typography System
**Font Family:** Inter (via Google Fonts CDN)
- Headers (h1): text-2xl font-semibold (24px, 600 weight)
- Headers (h2): text-xl font-semibold (20px, 600 weight)
- Body text: text-base font-normal (16px, 400 weight)
- Labels: text-sm font-medium (14px, 500 weight)
- Data/numbers: text-sm font-mono (14px, monospace for tables)
- Button text: text-sm font-medium (14px, 500 weight)

## Layout System
**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- Card gaps: gap-4
- Form field spacing: space-y-4
- Page margins: px-4 md:px-8, py-6 md:py-8

**Grid Structure:**
- Container: max-w-7xl mx-auto
- Product cards: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Form layouts: max-w-2xl for single-column forms
- Table views: w-full with responsive scroll wrapper

## Component Library

### Navigation
- Top navigation bar: Fixed header, h-16, flex justify-between items-center
- Logo/brand: Left-aligned, text-xl font-semibold
- Nav links: Horizontal flex gap-6, text-sm font-medium
- Mobile: Hamburger menu with slide-in drawer

### Product Cards
- Compact card design with image thumbnail (aspect-square, 200px)
- Title: text-lg font-semibold, truncate
- Price: text-xl font-bold
- Stock indicator: Small badge (px-2 py-1 rounded-full text-xs)
- Actions: Icon buttons group (Edit, Delete) at bottom
- Low stock warning: Prominent badge when stock < 10

### Forms
- Input fields: h-10, px-4, rounded-lg, border, text-sm
- Labels: Above inputs, mb-2, text-sm font-medium
- Image upload: Dashed border dropzone, 200px height, with preview
- Select dropdowns: Match input styling, chevron icon
- Buttons: Primary (h-10 px-6), Secondary (outlined variant)
- Form sections: Grouped with space-y-4, dividers between major sections

### Tables (Sales/Reports)
- Clean, borderless rows with hover states
- Header: Sticky top, text-xs font-semibold uppercase tracking-wide
- Cell padding: px-4 py-3
- Alternating row treatment for readability
- Responsive: Stack to cards on mobile (<768px)
- Action column: Right-aligned icon buttons

### Filters Section
- Horizontal layout: flex flex-wrap gap-4
- Filter inputs: Inline, compact (h-9)
- Date range: Two date inputs side-by-side
- Apply button: Primary style, ml-auto
- Clear filters: Text button, text-sm

### Notifications/Toasts
- Fixed top-right position (top-4 right-4)
- Width: max-w-sm
- Success/Error variants with icon
- Auto-dismiss after 3 seconds
- Slide-in animation (translate-x)

### Empty States
- Centered content with icon (h-12 w-12)
- Message: text-base, max-w-sm
- CTA button below message
- Used for: No products, No sales, No results

## Page-Specific Layouts

### Products Page
- Header with title + "Add Product" button (flex justify-between)
- Search bar: w-full max-w-md, mb-6
- Product grid: 3 columns desktop, 2 tablet, 1 mobile
- Each card: Image top, content below, actions at bottom

### Sales Registration
- Two-column layout on desktop (Product selection | Sale summary)
- Left: Product dropdown, Quantity input
- Right: Live calculation preview (readonly fields)
- Submit button: Full-width below, h-12

### Reports/Sales History
- Filters bar at top: Horizontal scroll on mobile
- Results table below filters
- Summary cards row above table (Total Sales, Items Sold, Revenue)
- Pagination: Bottom-right, simple prev/next

## Interactions
- Button hover: Subtle scale (scale-105) or opacity change
- Card hover: Slight elevation (shadow-md)
- Form validation: Inline error messages below fields (text-xs text-red-600)
- Loading states: Spinner overlay on forms, skeleton on cards
- Transitions: transition-all duration-200 for smooth interactions

## Responsive Behavior
- Breakpoints: Mobile-first, md:768px, lg:1024px
- Navigation: Collapse to hamburger <768px
- Tables: Transform to stacked cards <768px
- Forms: Single column always, wider on desktop
- Grids: Adjust columns based on viewport

## Images
**Product Images:**
- Location: Product cards (top of card)
- Size: aspect-square, object-cover
- Fallback: Placeholder with product initial or generic icon
- Upload preview: Same dimensions in form

No hero images needed - this is a utility application focused on data management efficiency.