# Inventory & Sales Management System

## Overview

This is a modern inventory and sales management web application built with a full-stack TypeScript architecture. The application enables users to manage product inventory, record sales transactions, and view detailed sales reports. It features a clean, minimal interface inspired by Linear and Notion, prioritizing clarity, speed, and efficient data access.

The system automatically handles stock deductions when sales are recorded and provides real-time inventory tracking with low-stock alerts.

## User Preferences

Preferred communication style: Simple, everyday language.

**Currency Format:** Argentine peso style: $ 20.000,59 (space after $, dot for thousands, comma for decimals) using `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.

## Authentication & Authorization

### Authentication Methods
1. **Email/Password** - Traditional login with bcrypt password hashing
2. **Google SSO** - Via Replit Auth (OpenID Connect)

### User Roles
- **admin** - Full system access: products CRUD, sales, reports, user management, audit logs
- **vendedor** - Limited access: view products, create/edit sales only

### Security Features
- Session-based authentication with PostgreSQL session store
- Role validation from database on every protected request
- SSO users default to "vendedor" role (no privilege escalation)
- Complete audit trail of all system operations

## System Architecture

### Frontend Architecture

**Core Technology Stack:**
- React 18 with TypeScript
- Vite as the build tool and development server
- Wouter for client-side routing
- TanStack Query (React Query) for server state management
- React Hook Form with Zod validation for form handling

**UI Component System:**
- shadcn/ui component library (Radix UI primitives)
- TailwindCSS for styling with custom design tokens
- Inter font family from Google Fonts
- Custom color system with HSL-based theming
- Responsive design with mobile-first approach

**State Management Pattern:**
The application uses TanStack Query for all server state, eliminating the need for global state management. Forms use local state via React Hook Form, and UI state (dialogs, modals) is managed with local component state.

**Design System:**
- Modern, minimal aesthetic inspired by Linear and Notion
- Consistent spacing using Tailwind's 2/4/6/8/12/16 unit system
- Typography hierarchy with Inter font (semibold headers, normal body, mono for data)
- Card-based layouts for products with hover interactions
- Toast notifications for user feedback

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript
- ES Modules architecture
- Custom middleware for request logging and JSON handling

**Data Layer:**
- Drizzle ORM for type-safe database operations
- PostgreSQL database (configured via Neon serverless driver)
- Schema-first design with Zod validation
- In-memory storage implementation (MemStorage) for development/testing

**API Design:**
RESTful endpoints following resource-oriented patterns:
- `GET/POST /api/products` - List and create products
- `GET/PATCH/DELETE /api/products/:id` - Individual product operations
- `GET/POST /api/sales` - List and create individual sales
- `POST /api/sale-orders` - Create cart-based sales with multiple items
- Automatic stock management on sale creation

**Cart-Based Sales System:**
- Users add products to a cart before completing the sale
- Support for 5 payment methods: Efectivo, Débito, Crédito, QR, Transferencia
- Change calculation for cash (Efectivo) payments
- Audit logging for all sales transactions

**Validation Strategy:**
- Shared schema definitions between client and server
- Zod schemas derived from Drizzle table definitions
- Server-side validation with friendly error messages using zod-validation-error

### Database Schema

**Products Table:**
- UUID primary key with auto-generation
- Title and description (text)
- Price (decimal with 10,2 precision)
- Stock quantity (decimal with 10,3 precision for weight-based items)
- Unit type: unidad (count), gramos (weight), litros (volume)
- Optional image URL (text)

**Sale Orders Table:**
- UUID primary key with auto-generation
- User reference (vendor who made the sale)
- Payment method: efectivo, debito, credito, qr, transferencia
- Paid amount and change amount (for cash payments)
- Total amount (decimal with 10,2 precision)
- Timestamp for creation tracking

**Sales Table (Order Line Items):**
- UUID primary key with auto-generation
- Foreign key reference to sale_orders (nullable for backward compatibility)
- Foreign key reference to products
- Quantity sold (decimal for weight-based items)
- Unit type at time of sale
- Unit price snapshot (decimal)
- Calculated total price (decimal)
- Edit tracking (isEdited flag)
- Timestamps for creation and updates

**Business Logic:**
- Sales automatically reduce product stock
- Price is captured at sale time (preserving historical pricing)
- Validation prevents negative stock scenarios
- Change calculation for cash payments

### Build & Development System

**Development Mode:**
- Vite dev server with HMR (Hot Module Replacement)
- Middleware mode integration with Express
- Runtime error overlay for debugging
- Replit-specific plugins for cartographer and dev banner

**Production Build:**
- Vite builds client to `dist/public`
- esbuild bundles server code to `dist`
- ES modules format for Node.js compatibility
- External package handling for optimized bundle size

**Type Safety:**
- Strict TypeScript configuration
- Path aliases for clean imports (`@/`, `@shared/`)
- Shared types between client and server
- No emit mode for development (type checking only)

## External Dependencies

### Database Service
- **Neon Database** - Serverless PostgreSQL with connection pooling
- Environment variable: `DATABASE_URL`
- Used via `@neondatabase/serverless` driver
- Drizzle ORM for migrations and queries

### UI Component Libraries
- **Radix UI** - Unstyled, accessible component primitives (20+ components)
- **shadcn/ui** - Pre-styled component system built on Radix
- **Lucide React** - Icon library
- **cmdk** - Command palette component
- **embla-carousel-react** - Carousel implementation
- **vaul** - Drawer component

### Form & Validation
- **React Hook Form** - Form state management
- **Zod** - Schema validation
- **@hookform/resolvers** - Zod integration for React Hook Form
- **drizzle-zod** - Generate Zod schemas from Drizzle tables

### Utilities
- **clsx & tailwind-merge** - Conditional className utilities
- **class-variance-authority** - Component variant management
- **date-fns** - Date formatting and manipulation
- **nanoid** - Unique ID generation

### Development Tools
- **Replit Vite Plugins** - Runtime error modal, cartographer, dev banner
- **TSX** - TypeScript execution for development server
- **Drizzle Kit** - Database migration tooling

### Session Management
- **connect-pg-simple** - PostgreSQL session store (configured but not actively used in current implementation)