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

### User Roles (Three-Tier System)
- **sistemas** - Superuser with highest privileges: full system access, can enable/disable users and branches, can view/edit other sistemas users
- **admin** - Full system access: products CRUD, sales, reports, user management (except sistemas users), audit logs
- **vendedor** - Limited access: view products, create/edit sales only

### Default Sistemas User
- Email: `sistemas@jota.com`
- Password: `Sistemas123!`
- This user should be used to initially configure the system and its password should be changed after first login

### User Status (isActive)
- Users can be enabled/disabled via the isActive field
- Disabled users cannot log in to the system
- Only sistemas users can enable/disable admin users
- Admin users can only enable/disable vendedor users

### Security Features
- Session-based authentication with PostgreSQL session store
- Role validation from database on every protected request
- Active status check on login (disabled users are blocked)
- SSO users default to "vendedor" role (no privilege escalation) - Fixed: Google SSO now assigns vendedor instead of admin
- Complete audit trail of all system operations including user enable/disable actions
- Audit log FK constraint safe: branchId uses ON DELETE SET NULL to prevent cascade deletions

## Branch Isolation (Multi-Branch Support)

### Architecture
- Each branch operates as an isolated unit with its own products, stock, and sales
- Products table has branchId column (NOT NULL FK to branches)
- All product and sale operations require and validate session.branchId
- Storage layer enforces branch isolation at query level (not just route level)

### User-Branch Assignment
Users are assigned to specific branches based on their role:
- **sistemas**: Can access ALL branches (no assignment needed)
- **admin**: Can access branches where:
  - They are set as `adminUserId` on the branch (business owner)
  - They are explicitly assigned via `userBranches` table
- **vendedor**: Can ONLY access branches explicitly assigned via `userBranches` table

The `userBranches` table provides a many-to-many relationship between users and branches:
```typescript
userBranches = {
  id: varchar (UUID),
  userId: varchar (FK to users),
  branchId: varchar (FK to branches),
  createdAt: timestamp
}
```

### Assigning Branches to Users
- Only **sistemas** users can assign branches to other users
- Navigate to Users page → click the Building icon on any admin/vendedor user
- Select which branches that user should have access to
- Changes take effect immediately on next branch selection

### Branch-Scoped Storage Methods
All data access goes through branch-scoped methods:
- **Products**: getProducts(branchId), getProductByBranch(id, branchId), createProduct(+branchId), updateProduct(+branchId), deleteProduct(+branchId)
- **Sales**: getSalesByBranch(branchId), getSaleByBranch(id, branchId), createSale(+branchId), updateSale(+branchId), deleteSale(+branchId)
- **Sale Orders**: getSaleOrdersByBranch(branchId), createSaleOrderForBranch(+branchId)
- **Audit Logs**: getAuditLogsByBranch(branchId)
- **User Branches**: getUserBranches(userId), getBranchesForUser(userId, role), setUserBranches(userId, branchIds), canUserAccessBranch(userId, branchId, role)

### Security Enforcement
- Legacy branch-agnostic methods (getProduct, getSale) have been removed
- Cross-branch access attempts return 404 (not found in this branch)
- Stock updates validate product belongs to current branch
- Sale order creation validates all line items belong to session branch
- Branch selection validates user has permission via `canUserAccessBranch`

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
- Stock quantity (decimal with 10,3 precision) - supports unidad, gramos, and litros
- Unit type: unidad (count), gramos (weight), litros (volume)
- Optional image URL (text)
- BranchId (NOT NULL FK to branches)

**Sale Orders Table:**
- UUID primary key with auto-generation
- User reference (vendor who made the sale)
- BranchId (NOT NULL FK to branches) - ensures branch isolation
- Payment method: efectivo, debito, credito, qr, transferencia
- Paid amount and change amount (for cash payments)
- Total amount (decimal with 10,2 precision)
- Timestamp for creation tracking

**Sales Table (Order Line Items):**
- UUID primary key with auto-generation
- Foreign key reference to sale_orders (nullable for backward compatibility)
- Foreign key reference to products
- BranchId (NOT NULL FK to branches) - ensures branch isolation
- Quantity sold (decimal with 10,3 precision for weight-based items)
- Unit type at time of sale
- Unit price snapshot (decimal)
- Calculated total price (decimal)
- Edit tracking (isEdited flag)
- Timestamps for creation and updates

**Audit Logs Table:**
- UUID primary key with auto-generation
- User reference (FK to users)
- BranchId (nullable FK to branches, uses ON DELETE SET NULL) - safe branch deletion without cascading
- Action type (create, edit, delete, etc.)
- Entity type and ID
- Detailed action description
- Timestamp for auditing

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

## Recent Improvements (2026-03-25)

### Security & Stability Fixes
1. **Google SSO Role Assignment**: Fixed to assign 'vendedor' role instead of 'admin' for new SSO users (prevents privilege escalation)
2. **Audit Log Constraint Safety**: Added ON DELETE SET NULL to auditLogs.branchId FK to prevent cascade deletions when branches are deleted

### Schema Improvements
1. **Product Stock Type**: Changed from `integer` to `decimal(10,3)` to properly support weight-based inventory (gramos, litros)
2. **Sales Order Branch Isolation**: Made `saleOrders.branchId` NOT NULL to enforce branch isolation at database level
3. **Sales Branch Isolation**: Made `sales.branchId` NOT NULL to enforce branch isolation at database level

### Performance Enhancements
1. **Audit Log Pagination**: Implemented pagination on `/api/audit-logs` and `/api/branches/:branchId/audit-logs` endpoints
   - Query parameters: `offset` (default 0) and `limit` (default 50, max 100)
   - Response format: `{ logs: AuditLog[], total: number }`
   - Frontend: Added pagination UI with previous/next navigation buttons
2. **Frontend Audit Page**: Updated to handle paginated audit logs with pagination controls

### Feature Improvements
1. **Product Search**: Added server-side filtering on `/api/products` endpoint with `?search=` query parameter
   - Searches across product title and description
   - Frontend already includes search UI with client-side filtering
   
2. **Unique Product Names**: Added validation to prevent duplicate product names within a branch
   - Validation on both create and update endpoints
   - Clear error messages when duplicate found

3. **Login Attempt Limiting**: Implemented brute force protection
   - Tracks `failedLoginAttempts` and `lastFailedLoginAt` in users table
   - Locks account after 5 failed attempts for 15 minutes
   - Returns 429 status code when account is locked
   - Automatically resets counter on successful login or after lockout duration expires

4. **Date Range Filters in Reports**: Replaced single-date filter with date range
   - Defaults to last 30 days
   - Users can select "from" and "to" dates
   - Displays filtered sales data within selected range
   - Properly formats and displays date range in report title

5. **Event Logging for User Management**: Complete audit trail for user enable/disable operations
   - Logs creation, edit, enable/disable, and deletion events
   - Separate action types: `habilitar_usuario`, `deshabilitar_usuario`, `editar_usuario`, `eliminar_usuario`
   - Detailed descriptions for audit trail