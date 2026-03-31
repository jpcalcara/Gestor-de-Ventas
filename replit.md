# Inventory & Sales Management System

## Overview

This is a modern inventory and sales management web application built with a full-stack TypeScript architecture. The application enables users to manage product inventory, record sales transactions, and view detailed sales reports. It features a clean, minimal interface inspired by Linear and Notion, prioritizing clarity, speed, and efficient data access. The system automatically handles stock deductions when sales are recorded and provides real-time inventory tracking with low-stock alerts.

The project aims to provide a robust, multi-tenant SaaS platform for businesses to manage their inventory and sales across multiple branches, with a focus on security, scalability, and an intuitive user experience. It includes an invitation system for onboarding new users and detailed audit trails for all operations.

## User Preferences

Preferred communication style: Simple, everyday language.

**Currency Format:** Argentine peso style: $ 20.000,59 (space after $, dot for thousands, comma for decimals) using `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.

## System Architecture

### Authentication & Authorization

The system supports Email/Password authentication with bcrypt and Google SSO via Replit Auth. A three-tier role-based access control (sistemas, admin, vendedor) is implemented, with `sistemas` being a superuser role. User accounts can be enabled/disabled. A default `sistemas` user is provided for initial setup. Security features include session-based authentication, role validation on every protected request, active status checks, and a complete audit trail of all system operations. Brute force protection is implemented for login attempts.

### Branch Isolation (Multi-Branch Support)

The architecture supports multi-branch operations, where each branch is an isolated unit with its own products, stock, and sales. All data operations are branch-scoped, ensuring data segregation. Users are assigned to specific branches based on their role, with `sistemas` users having access to all branches, `admin` users accessing branches they own or are assigned to, and `vendedor` users accessing only assigned branches. A `userBranches` table manages these assignments.

### Multi-Tenant SaaS Architecture

The application is designed as a multi-tenant SaaS platform. Businesses have a `slug` and a `plan` (free/starter/pro). Company settings are isolated per business. An invitation system allows `admin` users to invite new users to their business/branch with specific roles. Audit logs are filtered by business for non-sistemas users, and login validates business activity.

### Frontend Architecture

The frontend is built with React 18, TypeScript, and Vite. It uses Wouter for routing, TanStack Query for server state management, and React Hook Form with Zod for forms. The UI is built using shadcn/ui (Radix UI primitives) with TailwindCSS for styling, following a modern, minimal design inspired by Linear and Notion.

### Backend Architecture

The backend uses Express.js with TypeScript and ES Modules. Drizzle ORM is used for type-safe database operations with PostgreSQL. The API is RESTful, managing products, sales, and sale orders. A cart-based sales system supports multiple payment methods and automatically manages stock. Server-side validation uses Zod schemas derived from Drizzle definitions, with shared schemas between client and server.

### Database Schema

Key tables include:
- **Products**: UUID, title, description, price, stock (decimal for weight/volume), unit type, image URL, and `branchId`.
- **Sale Orders**: UUID, user reference, `branchId`, payment method, paid/change/total amounts, timestamp.
- **Sales (Order Line Items)**: UUID, FK to sale_orders, FK to products, `branchId`, quantity, unit type, unit price snapshot, total price, `isEdited` flag, timestamps.
- **Audit Logs**: UUID, user reference, `branchId`, action type, entity type/ID, description, timestamp.
- **Invitations**: token, email, role, businessId, branchId, expiresAt, usedAt.

Business logic includes automatic stock reduction on sales, price capture at sale time, and validation to prevent negative stock. Product stock type is `decimal(10,3)` to support various unit types. Sale orders and sales tables explicitly enforce `branchId` as NOT NULL for stronger isolation.

### Build & Development System

Development uses Vite with HMR and Replit-specific plugins. Production builds use Vite for the client and esbuild for the server, outputting ES modules. Strict TypeScript and shared types ensure type safety across the stack.

## External Dependencies

### Database Service
- **Neon Database**: Serverless PostgreSQL via `@neondatabase/serverless` driver.
- **Drizzle ORM**: For database migrations and queries.

### UI Component Libraries
- **Radix UI**: Accessible, unstyled component primitives.
- **shadcn/ui**: Pre-styled component system built on Radix.
- **Lucide React**: Icon library.
- **cmdk**: Command palette.
- **embla-carousel-react**: Carousel component.
- **vaul**: Drawer component.

### Form & Validation
- **React Hook Form**: Form state management.
- **Zod**: Schema validation.
- **@hookform/resolvers**: Zod integration for React Hook Form.
- **drizzle-zod**: Generates Zod schemas from Drizzle tables.

### Utilities
- **clsx & tailwind-merge**: Conditional className utilities.
- **class-variance-authority**: Component variant management.
- **date-fns**: Date formatting and manipulation.
- **nanoid**: Unique ID generation.

### Development Tools
- **Replit Vite Plugins**: Runtime error modal, cartographer, dev banner.
- **TSX**: TypeScript execution for development server.
- **Drizzle Kit**: Database migration tooling.

### Session Management
- **connect-pg-simple**: PostgreSQL session store.