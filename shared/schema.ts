import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const userRoleEnum = ["sistemas", "admin", "vendedor"] as const;
export type UserRole = typeof userRoleEnum[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("vendedor"),
  isActive: boolean("is_active").notNull().default(true),
  avatar: text("avatar").default("default"),
  profileImageUrl: text("profile_image_url"),
  googleId: text("google_id").unique(),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lastFailedLoginAt: timestamp("last_failed_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const unitTypeEnum = ["unidad", "gramos", "litros"] as const;
export type UnitType = typeof unitTypeEnum[number];

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: decimal("stock", { precision: 10, scale: 3 }).notNull().default("0"),
  unitType: text("unit_type").notNull().default("unidad"),
  imageUrl: text("image_url"),
  barcode: varchar("barcode", { length: 100 }),
});

export const paymentMethodEnum = ["efectivo", "debito", "credito", "qr", "transferencia"] as const;
export type PaymentMethod = typeof paymentMethodEnum[number];

export const saleOrders = pgTable("sale_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  paymentMethod: text("payment_method").notNull().default("efectivo"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }),
  changeAmount: decimal("change_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => saleOrders.id),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitType: text("unit_type").notNull().default("unidad"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  isEdited: boolean("is_edited").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  branchId: varchar("branch_id").references(() => branches.id, { onDelete: "set null" }),
  userName: text("user_name").notNull(),
  actionType: text("action_type").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: varchar("business_id").references(() => businesses.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull().default("JOTA Sistemas"),
  logoUrl: text("logo_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const features = pgTable("features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  enabledGlobally: boolean("enabled_globally").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const planFeatures = pgTable("plan_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  featureKey: text("feature_key").notNull().references(() => features.key, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  limit: integer("limit"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const businesses = pgTable("businesses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  razonSocial: text("razon_social").notNull().unique(),
  slug: text("slug").unique(),
  plan: text("plan").notNull().default("free"),
  planId: varchar("plan_id").references(() => plans.id),
  cuit: text("cuit").unique(),
  encargado: text("encargado"),
  telefono: text("telefono"),
  mail: text("mail"),
  adminUserId: varchar("admin_user_id").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  // Subscription / MP
  mpSubscriptionId: text("mp_subscription_id"),
  mpPayerId: text("mp_payer_id"),
  mpStatus: text("mp_status"),
  subscriptionStatus: text("subscription_status").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at"),
  graceEndsAt: timestamp("grace_ends_at"),
  lastPaymentAt: timestamp("last_payment_at"),
  nextPaymentAt: timestamp("next_payment_at"),
  gracePeriodDays: integer("grace_period_days").notNull().default(7),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const businessAdmins = pgTable("business_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  businessId: varchar("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const branches = pgTable("branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: varchar("business_id").notNull().references(() => businesses.id),
  adminUserId: varchar("admin_user_id").references(() => users.id),
  number: integer("number").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const branchStocks = pgTable("branch_stocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  stock: decimal("stock", { precision: 10, scale: 3 }).notNull().default("0"),
  lowStockThreshold: integer("low_stock_threshold").default(10),
});

export const userBranches = pgTable("user_branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionEvents = pgTable("subscription_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessId: varchar("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  mpPaymentId: text("mp_payment_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  description: text("description"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  businessId: varchar("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id").references(() => branches.id, { onDelete: "set null" }),
  role: text("role").notNull().default("vendedor"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales),
  auditLogs: many(auditLogs),
  passwordResetTokens: many(passwordResetTokens),
  userBranches: many(userBranches),
}));

export const userBranchesRelations = relations(userBranches, ({ one }) => ({
  user: one(users, {
    fields: [userBranches.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [userBranches.branchId],
    references: [branches.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  branch: one(branches, {
    fields: [products.branchId],
    references: [branches.id],
  }),
  sales: many(sales),
}));

export const saleOrdersRelations = relations(saleOrders, ({ one, many }) => ({
  user: one(users, {
    fields: [saleOrders.userId],
    references: [users.id],
  }),
  items: many(sales),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  order: one(saleOrders, {
    fields: [sales.orderId],
    references: [saleOrders.id],
  }),
  product: one(products, {
    fields: [sales.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [auditLogs.branchId],
    references: [branches.id],
  }),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  admin: one(users, {
    fields: [businesses.adminUserId],
    references: [users.id],
  }),
  branches: many(branches),
  businessAdmins: many(businessAdmins),
}));

export const businessAdminsRelations = relations(businessAdmins, ({ one }) => ({
  user: one(users, {
    fields: [businessAdmins.userId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [businessAdmins.businessId],
    references: [businesses.id],
  }),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  business: one(businesses, {
    fields: [branches.businessId],
    references: [businesses.id],
  }),
  stocks: many(branchStocks),
  saleOrders: many(saleOrders),
  sales: many(sales),
  auditLogs: many(auditLogs),
  userBranches: many(userBranches),
}));

export const branchStocksRelations = relations(branchStocks, ({ one }) => ({
  branch: one(branches, {
    fields: [branchStocks.branchId],
    references: [branches.id],
  }),
  product: one(products, {
    fields: [branchStocks.productId],
    references: [products.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  email: z.string().email("Email inválido"),
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  phone: z.string().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
  googleId: z.string().optional(),
  profileImageUrl: z.string().optional(),
  role: z.enum(["sistemas", "admin", "vendedor"]).default("vendedor"),
}).refine(
  (data) => data.password || data.googleId,
  {
    message: "Debe proporcionar una contraseña o un Google ID",
    path: ["password"],
  }
);

export const upsertUserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  profileImageUrl: z.string().nullable().optional(),
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;

export const loginSchema = z.object({
  email: z.string().email("Email inválido").min(1, "El email es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  branchId: true,
}).extend({
  price: z.coerce.number().min(0, "El precio debe ser mayor o igual a 0"),
  stock: z.coerce.number().min(0, "El stock debe ser mayor o igual a 0"),
  title: z.string().min(1, "El título es requerido"),
  description: z.string().min(1, "La descripción es requerida"),
  unitType: z.enum(unitTypeEnum).default("unidad"),
  barcode: z.string().max(100).optional().or(z.literal("")),
});

export const cartItemSchema = z.object({
  productId: z.string().min(1, "Debe seleccionar un producto"),
  quantity: z.coerce.number().min(0.001, "La cantidad debe ser mayor a 0"),
  unitType: z.enum(unitTypeEnum),
  unitPrice: z.number(),
  productTitle: z.string(),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const insertSaleOrderSchema = z.object({
  paymentMethod: z.enum(paymentMethodEnum),
  paidAmount: z.coerce.number().optional(),
  items: z.array(cartItemSchema).min(1, "Debe agregar al menos un producto"),
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  unitPrice: true,
  totalPrice: true,
  isEdited: true,
  orderId: true,
}).extend({
  quantity: z.coerce.number().min(0.001, "La cantidad debe ser mayor a 0"),
  productId: z.string().min(1, "Debe seleccionar un producto"),
  unitType: z.enum(unitTypeEnum).default("unidad"),
});

export const updateSaleSchema = z.object({
  quantity: z.coerce.number().min(0.001, "La cantidad debe ser mayor a 0"),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().min(1, "El usuario es requerido"),
  token: z.string().min(1, "El token es requerido"),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  updatedAt: true,
});

export const updateCompanySettingsSchema = z.object({
  companyName: z.string().min(1, "El nombre de la empresa es requerido").optional(),
  logoUrl: z.string().nullable().optional(),
});

export const insertBusinessSchema = createInsertSchema(businesses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  adminUserId: true,
}).extend({
  razonSocial: z.string().min(1, "La razón social es requerida"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones").optional(),
  plan: z.enum(["free", "starter", "pro"]).default("free"),
  cuit: z.string().optional().or(z.literal("")).nullable(),
  encargado: z.string().optional().or(z.literal("")).nullable(),
  telefono: z.string().optional().or(z.literal("")).nullable(),
  mail: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  isActive: z.boolean().default(true),
});

export const updateBusinessSchema = z.object({
  razonSocial: z.string().min(1, "La razón social es requerida").optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  plan: z.enum(["free", "starter", "pro"]).optional(),
  cuit: z.string().optional().nullable(),
  encargado: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  mail: z.string().email("Email inválido").optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateBusiness = z.infer<typeof updateBusinessSchema>;

export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  number: z.coerce.number().min(1, "El número de sucursal es requerido"),
  name: z.string().min(1, "El nombre de la sucursal es requerido"),
  address: z.string().min(1, "El domicilio es requerido"),
  isActive: z.boolean().default(true),
});

export const updateBranchSchema = z.object({
  number: z.coerce.number().min(1, "El número de sucursal es requerido").optional(),
  name: z.string().min(1, "El nombre de la sucursal es requerido").optional(),
  address: z.string().min(1, "El domicilio es requerido").optional(),
  adminUserId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const insertBranchStockSchema = createInsertSchema(branchStocks).omit({
  id: true,
}).extend({
  branchId: z.string().min(1, "La sucursal es requerida"),
  productId: z.string().min(1, "El producto es requerido"),
  stock: z.coerce.number().min(0, "El stock debe ser mayor o igual a 0"),
  lowStockThreshold: z.coerce.number().optional(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type SaleOrder = typeof saleOrders.$inferSelect;
export type InsertSaleOrder = z.infer<typeof insertSaleOrderSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type UpdateSale = z.infer<typeof updateSaleSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type UpdateCompanySettings = z.infer<typeof updateCompanySettingsSchema>;

export type SaleWithProduct = Sale & {
  product: Product;
};

export type SaleOrderWithItems = SaleOrder & {
  items: SaleWithProduct[];
  user?: User;
};

export type Business = typeof businesses.$inferSelect;
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type BusinessAdmin = typeof businessAdmins.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type UpdateBranch = z.infer<typeof updateBranchSchema>;
export type BranchStock = typeof branchStocks.$inferSelect;
export type InsertBranchStock = z.infer<typeof insertBranchStockSchema>;

export type BranchStockWithProduct = BranchStock & {
  product: Product;
};

export const insertUserBranchSchema = createInsertSchema(userBranches).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().min(1, "El usuario es requerido"),
  branchId: z.string().min(1, "La sucursal es requerida"),
});

export const updateUserBranchesSchema = z.object({
  branchIds: z.array(z.string()).min(0),
});

export type UserBranch = typeof userBranches.$inferSelect;
export type InsertUserBranch = z.infer<typeof insertUserBranchSchema>;
export type UpdateUserBranches = z.infer<typeof updateUserBranchesSchema>;

export type UserWithBranches = User & {
  userBranches?: (UserBranch & { branch?: Branch })[];
};

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  token: true,
  expiresAt: true,
  usedAt: true,
  createdAt: true,
}).extend({
  email: z.string().email("Email inválido"),
  role: z.enum(["admin", "vendedor"]).default("vendedor"),
  branchId: z.string().optional().nullable(),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;

// Plans / Features schemas
export const insertPlanSchema = createInsertSchema(plans).omit({ id: true, createdAt: true, updatedAt: true });
export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  price: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

export const insertFeatureSchema = createInsertSchema(features).omit({ id: true, createdAt: true });
export type Feature = typeof features.$inferSelect;
export type InsertFeature = z.infer<typeof insertFeatureSchema>;

export const insertPlanFeatureSchema = createInsertSchema(planFeatures).omit({ id: true, createdAt: true });
export type PlanFeature = typeof planFeatures.$inferSelect;
export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;

export const insertSubscriptionEventSchema = createInsertSchema(subscriptionEvents).omit({ id: true, createdAt: true });
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type InsertSubscriptionEvent = z.infer<typeof insertSubscriptionEventSchema>;

export const registerBusinessSchema = z.object({
  razonSocial: z.string().min(1, "La razón social es requerida"),
  cuit: z.string().optional().or(z.literal("")).nullable(),
  encargado: z.string().optional().or(z.literal("")).nullable(),
  telefono: z.string().optional().or(z.literal("")).nullable(),
  mail: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  planSlug: z.enum(["free", "starter", "pro"]).default("free"),
});
