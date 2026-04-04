import { 
  type Product, 
  type InsertProduct, 
  type Sale, 
  type InsertSale,
  type UpdateSale,
  type SaleWithProduct,
  type SaleOrder,
  type InsertSaleOrder,
  type SaleOrderWithItems,
  type User,
  type InsertUser,
  type UpsertUser,
  type AuditLog,
  type InsertAuditLog,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type CompanySettings,
  type UpdateCompanySettings,
  type Business,
  type InsertBusiness,
  type BusinessAdmin,
  type Branch,
  type InsertBranch,
  type UpdateBranch,
  type BranchStock,
  type InsertBranchStock,
  type BranchStockWithProduct,
  type UserBranch,
  type UserWithBranches,
  type Invitation,
  type InsertInvitation,
  type Plan,
  type InsertPlan,
  type Feature,
  type InsertFeature,
  type PlanFeature,
  type InsertPlanFeature,
  type SubscriptionEvent,
  type InsertSubscriptionEvent,
  products,
  sales,
  saleOrders,
  users,
  auditLogs,
  passwordResetTokens,
  companySettings,
  businesses,
  businessAdmins,
  branches,
  branchStocks,
  userBranches,
  invitations,
  plans,
  features,
  planFeatures,
  subscriptionEvents,
  updateSaleSchema,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, inArray, lt } from "drizzle-orm";

export interface IStorage {
  getProducts(branchId?: string): Promise<Product[]>;
  getProductByBranch(id: string, branchId: string): Promise<Product | undefined>;
  getProductByTitle(title: string, branchId: string): Promise<Product | undefined>;
  getProductByBarcode(barcode: string, branchId: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct & { branchId: string }): Promise<Product>;
  updateProduct(id: string, product: InsertProduct, branchId: string): Promise<Product | undefined>;
  deleteProduct(id: string, branchId: string): Promise<boolean>;
  
  getSaleByBranch(id: string, branchId: string): Promise<Sale | undefined>;
  createSale(sale: InsertSale & { userId: string; branchId: string }): Promise<Sale>;
  updateSale(id: string, updates: UpdateSale, branchId: string): Promise<Sale | undefined>;
  deleteSale(id: string, branchId: string): Promise<boolean>;
  
  updateProductStock(productId: string, branchId: string, quantity: number): Promise<Product | undefined>;
  
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUsersForBusiness(businessId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  upsertUser(userData: UpsertUser): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
  
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(offset?: number, limit?: number): Promise<{ logs: AuditLog[]; total: number }> | Promise<AuditLog[]>;
  
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  
  getCompanySettings(businessId?: string): Promise<CompanySettings>;
  updateCompanySettings(updates: UpdateCompanySettings, businessId?: string): Promise<CompanySettings>;
  getOrCreateCompanySettings(businessId: string, defaultName?: string): Promise<CompanySettings>;
  
  getBusiness(id: string): Promise<Business | undefined>;
  getBusinesses(includeInactive?: boolean): Promise<Business[]>;
  getBusinessesForUser(userId: string, role?: string): Promise<Business[]>;
  getBusinessAdmins(businessId: string): Promise<BusinessAdmin[]>;
  setBusinessAdmins(businessId: string, userIds: string[]): Promise<void>;
  getBranches(businessId?: string): Promise<Branch[]>;
  getBranchesForBusiness(businessId: string): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch & { businessId: string }): Promise<Branch>;
  updateBranch(id: string, updates: UpdateBranch): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<boolean>;
  
  getBranchStocks(branchId: string): Promise<BranchStockWithProduct[]>;
  getBranchStock(branchId: string, productId: string): Promise<BranchStock | undefined>;
  upsertBranchStock(stock: InsertBranchStock): Promise<BranchStock>;
  updateBranchStock(branchId: string, productId: string, quantity: number): Promise<BranchStock | undefined>;
  
  getSalesByBranch(branchId: string): Promise<SaleWithProduct[]>;
  getSaleOrdersByBranch(branchId: string): Promise<SaleOrderWithItems[]>;
  createSaleOrderForBranch(order: InsertSaleOrder & { userId: string; branchId: string }): Promise<SaleOrder>;
  
  getAuditLogsByBranch(branchId: string, offset?: number, limit?: number): Promise<{ logs: AuditLog[]; total: number } | AuditLog[]>;
  getAuditLogsByBusiness(businessId: string, offset?: number, limit?: number): Promise<{ logs: AuditLog[]; total: number }>;
  
  createInvitation(data: InsertInvitation & { businessId: string; token: string; expiresAt: Date }): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  markInvitationUsed(id: string): Promise<void>;
  getInvitationsByBusiness(businessId: string): Promise<Invitation[]>;
  deleteInvitation(id: string): Promise<boolean>;
  
  getUserBranches(userId: string): Promise<UserBranch[]>;
  getBranchesForUser(userId: string, role: string): Promise<Branch[]>;
  setUserBranches(userId: string, branchIds: string[]): Promise<void>;
  canUserAccessBranch(userId: string, branchId: string, role: string): Promise<boolean>;
  getUserWithBranches(userId: string): Promise<UserWithBranches | undefined>;

  // Plans & Features
  getPlans(includeInactive?: boolean): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  getPlanBySlug(slug: string): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, updates: Partial<InsertPlan>): Promise<Plan | undefined>;
  getFeatures(): Promise<Feature[]>;
  createFeature(feature: InsertFeature): Promise<Feature>;
  getPlanFeatures(planId: string): Promise<PlanFeature[]>;
  upsertPlanFeature(planId: string, featureKey: string, enabled: boolean, limit?: number | null): Promise<PlanFeature>;
  getAllPlanFeatures(): Promise<PlanFeature[]>;

  // Subscription events
  createSubscriptionEvent(event: InsertSubscriptionEvent): Promise<SubscriptionEvent>;
  getSubscriptionEvents(businessId: string): Promise<SubscriptionEvent[]>;
  getBusinessesWithExpiredGrace(): Promise<Business[]>;
  getUserCountForBusiness(businessId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getProducts(branchId?: string): Promise<Product[]> {
    if (branchId) {
      return await db.select().from(products).where(eq(products.branchId, branchId));
    }
    return await db.select().from(products);
  }

  async getProductByBranch(id: string, branchId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(
      and(eq(products.id, id), eq(products.branchId, branchId))
    );
    return product || undefined;
  }

  async getProductByTitle(title: string, branchId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(
      and(eq(products.title, title), eq(products.branchId, branchId))
    );
    return product || undefined;
  }

  async getProductByBarcode(barcode: string, branchId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(
      and(eq(products.barcode, barcode), eq(products.branchId, branchId))
    );
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct & { branchId: string }): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values({
        ...insertProduct,
        price: String(insertProduct.price),
        stock: String(insertProduct.stock),
        branchId: insertProduct.branchId,
      })
      .returning();
    return product;
  }

  async updateProduct(id: string, insertProduct: InsertProduct, branchId: string): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({
        ...insertProduct,
        price: String(insertProduct.price),
        stock: String(insertProduct.stock),
      })
      .where(and(eq(products.id, id), eq(products.branchId, branchId)))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: string, branchId: string): Promise<boolean> {
    await db.delete(branchStocks).where(
      and(eq(branchStocks.productId, id), eq(branchStocks.branchId, branchId))
    );
    const result = await db.delete(products).where(
      and(eq(products.id, id), eq(products.branchId, branchId))
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getSaleByBranch(id: string, branchId: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(
      and(eq(sales.id, id), eq(sales.branchId, branchId))
    );
    return sale || undefined;
  }

  async createSale(insertSale: InsertSale & { userId: string; branchId: string }): Promise<Sale> {
    return await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(and(
          eq(products.id, insertSale.productId),
          eq(products.branchId, insertSale.branchId)
        ));

      if (!product) {
        throw new Error("Producto no encontrado en esta sucursal");
      }

      const quantity = Number(insertSale.quantity);
      const unitPriceCents = Math.round(parseFloat(product.price) * 100);
      const totalPriceCents = Math.round(unitPriceCents * quantity);
      const unitPrice = (unitPriceCents / 100).toFixed(2);
      const totalPrice = (totalPriceCents / 100).toFixed(2);

      const [sale] = await tx
        .insert(sales)
        .values({
          productId: insertSale.productId,
          branchId: insertSale.branchId,
          userId: insertSale.userId,
          quantity: String(quantity),
          unitType: insertSale.unitType || product.unitType,
          unitPrice,
          totalPrice,
        })
        .returning();

      const [updatedProduct] = await tx
        .update(products)
        .set({ stock: sql`stock - ${quantity}` })
        .where(and(
          eq(products.id, insertSale.productId),
          eq(products.branchId, insertSale.branchId)
        ))
        .returning();

      if (!updatedProduct || Number(updatedProduct.stock) < 0) {
        throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
      }

      return sale;
    });
  }

  async updateSale(id: string, updates: UpdateSale, branchId: string): Promise<Sale | undefined> {
    updateSaleSchema.parse(updates);
    
    return await db.transaction(async (tx) => {
      const [currentSale] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, id), eq(sales.branchId, branchId)))
        .for('update');

      if (!currentSale) return undefined;

      const originalQty = Number(currentSale.quantity);
      const nextQty = Number(updates.quantity);

      if (nextQty === originalQty) {
        const [updated] = await tx
          .update(sales)
          .set({
            isEdited: true,
            updatedAt: new Date(),
          })
          .where(and(eq(sales.id, id), eq(sales.branchId, branchId)))
          .returning();
        return updated || undefined;
      }

      const [product] = await tx
        .select()
        .from(products)
        .where(and(eq(products.id, currentSale.productId), eq(products.branchId, branchId)))
        .for('update');

      if (!product) throw new Error("Producto no encontrado en esta sucursal");

      const delta = originalQty - nextQty;
      const currentStock = Number(product.stock);
      
      if (currentStock + delta < 0) {
        throw new Error(`Stock insuficiente. Disponible: ${currentStock + originalQty}`);
      }

      const unitPriceCents = Math.round(parseFloat(currentSale.unitPrice) * 100);
      const totalPriceCents = Math.round(unitPriceCents * nextQty);
      const totalPrice = (totalPriceCents / 100).toFixed(2);

      const [updatedProduct] = await tx
        .update(products)
        .set({ stock: sql`stock + ${delta}` })
        .where(and(eq(products.id, currentSale.productId), eq(products.branchId, branchId)))
        .returning();

      if (!updatedProduct) {
        throw new Error("Stock cambió concurrentemente");
      }

      const [updated] = await tx
        .update(sales)
        .set({
          quantity: String(nextQty),
          totalPrice,
          isEdited: true,
          updatedAt: new Date(),
        })
        .where(and(eq(sales.id, id), eq(sales.branchId, branchId)))
        .returning();

      if (!updated) {
        throw new Error("Venta cambió concurrentemente");
      }

      return updated;
    });
  }

  async deleteSale(id: string, branchId: string): Promise<boolean> {
    const result = await db.delete(sales).where(
      and(eq(sales.id, id), eq(sales.branchId, branchId))
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async updateProductStock(productId: string, branchId: string, quantityChange: number): Promise<Product | undefined> {
    return await db.transaction(async (tx) => {
      const [updatedProduct] = await tx
        .update(products)
        .set({ stock: sql`stock + ${quantityChange}` })
        .where(and(eq(products.id, productId), eq(products.branchId, branchId)))
        .returning();

      if (!updatedProduct || Number(updatedProduct.stock) < 0) {
        throw new Error(`Stock insuficiente`);
      }

      return updatedProduct;
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersForBusiness(businessId: string): Promise<User[]> {
    const businessBranches = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.businessId, businessId));

    if (businessBranches.length === 0) return [];

    const branchIds = businessBranches.map(b => b.id);
    const userBranchRows = await db
      .select({ userId: userBranches.userId })
      .from(userBranches)
      .where(inArray(userBranches.branchId, branchIds));

    if (userBranchRows.length === 0) return [];

    const userIds = [...new Set(userBranchRows.map(r => r.userId))];
    return await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds))
      .orderBy(desc(users.createdAt));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUser(userData.id);
    
    if (existingUser) {
      const [updated] = await db
        .update(users)
        .set({
          email: userData.email || existingUser.email,
          firstName: userData.firstName || existingUser.firstName,
          lastName: userData.lastName || existingUser.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id))
        .returning();
      return updated;
    }

    const [user] = await db
      .insert(users)
      .values({
        id: userData.id,
        email: userData.email || `user_${userData.id}@temp.local`,
        firstName: userData.firstName || "Usuario",
        lastName: userData.lastName || "Google",
        profileImageUrl: userData.profileImageUrl,
        role: "vendedor",
        googleId: userData.id,
      })
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db
      .insert(auditLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getAuditLogs(offset: number = 0, limit: number = 50): Promise<{ logs: AuditLog[]; total: number }> {
    const [{ count }] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(auditLogs);
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
    return { logs, total: count };
  }

  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db
      .insert(passwordResetTokens)
      .values(insertToken)
      .returning();
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken || undefined;
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }

  async getCompanySettings(businessId?: string): Promise<CompanySettings> {
    if (businessId) {
      return await this.getOrCreateCompanySettings(businessId);
    }
    const [settings] = await db.select().from(companySettings).where(sql`${companySettings.businessId} IS NULL`);
    if (settings) return settings;
    
    const [newSettings] = await db
      .insert(companySettings)
      .values({ companyName: "JOTA Sistemas" })
      .returning();
    return newSettings;
  }

  async getOrCreateCompanySettings(businessId: string, defaultName?: string): Promise<CompanySettings> {
    const [settings] = await db.select().from(companySettings).where(eq(companySettings.businessId, businessId));
    if (settings) return settings;
    
    const business = await this.getBusiness(businessId);
    const [newSettings] = await db
      .insert(companySettings)
      .values({ 
        businessId,
        companyName: defaultName || business?.razonSocial || "Mi Empresa",
      })
      .returning();
    return newSettings;
  }

  async updateCompanySettings(updates: UpdateCompanySettings, businessId?: string): Promise<CompanySettings> {
    const current = businessId 
      ? await this.getOrCreateCompanySettings(businessId)
      : await this.getCompanySettings();
    const [updated] = await db
      .update(companySettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companySettings.id, current.id))
      .returning();
    return updated;
  }

  async getBusiness(id: string): Promise<Business | undefined> {
    const [business] = await db.select().from(businesses).where(eq(businesses.id, id));
    return business || undefined;
  }

  async getBusinesses(includeInactive = false): Promise<Business[]> {
    if (includeInactive) {
      return await db.select().from(businesses).orderBy(businesses.razonSocial);
    }
    return await db.select().from(businesses).where(eq(businesses.isActive, true)).orderBy(businesses.razonSocial);
  }

  async getBusinessesForUser(userId: string, role?: string): Promise<Business[]> {
    if (role === "sistemas") {
      return await this.getBusinesses(true);
    }
    
    const businessIds = await db
      .selectDistinct({ id: businessAdmins.businessId })
      .from(businessAdmins)
      .where(eq(businessAdmins.userId, userId));
    
    const adminBizIds = businessIds.map(b => b.id);
    
    return await db.select().from(businesses).where(
      and(
        or(
          eq(businesses.adminUserId, userId),
          adminBizIds.length > 0 ? inArray(businesses.id, adminBizIds) : sql`false`
        ),
        eq(businesses.isActive, true)
      )
    );
  }

  async createBusiness(insertBusiness: InsertBusiness & { adminUserId: string }): Promise<Business> {
    const [business] = await db
      .insert(businesses)
      .values(insertBusiness)
      .returning();
    return business;
  }

  async updateBusiness(id: string, updates: Partial<InsertBusiness>): Promise<Business | undefined> {
    const [updated] = await db
      .update(businesses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(businesses.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBusiness(id: string): Promise<boolean> {
    const result = await db.delete(businesses).where(eq(businesses.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getBusinessesWithBranches(): Promise<Array<{
    id: string; razonSocial: string; slug: string | null; cuit: string | null;
    encargado: string | null; telefono: string | null; mail: string | null;
    plan: string; isActive: boolean; createdAt: Date;
    branches: Array<{ id: string; number: number; name: string; address: string; isActive: boolean }>;
  }>> {
    const bizList = await db.select().from(businesses).orderBy(businesses.razonSocial);
    const branchList = await db.select({
      id: branches.id, businessId: branches.businessId, number: branches.number,
      name: branches.name, address: branches.address, isActive: branches.isActive,
    }).from(branches).orderBy(branches.number);

    return bizList.map(b => ({
      id: b.id, razonSocial: b.razonSocial, slug: b.slug ?? null, cuit: b.cuit ?? null,
      encargado: b.encargado ?? null, telefono: b.telefono ?? null, mail: b.mail ?? null,
      plan: b.plan ?? "free", isActive: b.isActive, createdAt: b.createdAt,
      branches: branchList
        .filter(br => br.businessId === b.id)
        .map(br => ({ id: br.id, number: br.number, name: br.name, address: br.address, isActive: br.isActive })),
    }));
  }

  async getBusinessAdmins(businessId: string): Promise<BusinessAdmin[]> {
    return await db.select().from(businessAdmins).where(eq(businessAdmins.businessId, businessId));
  }

  async setBusinessAdmins(businessId: string, userIds: string[]): Promise<void> {
    await db.delete(businessAdmins).where(eq(businessAdmins.businessId, businessId));
    
    if (userIds.length > 0) {
      await db.insert(businessAdmins).values(
        userIds.map(userId => ({
          userId,
          businessId,
        }))
      );
    }
  }

  async getBranches(businessId?: string): Promise<Branch[]> {
    if (businessId) {
      return await db.select().from(branches).where(eq(branches.businessId, businessId)).orderBy(branches.number);
    }
    return await db.select().from(branches).orderBy(branches.number);
  }

  async getBranchesForBusiness(businessId: string): Promise<Branch[]> {
    return await db.select().from(branches).where(
      and(eq(branches.businessId, businessId), eq(branches.isActive, true))
    ).orderBy(branches.number);
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch || undefined;
  }

  async createBranch(insertBranch: InsertBranch & { businessId: string }): Promise<Branch> {
    const [branch] = await db
      .insert(branches)
      .values(insertBranch)
      .returning();
    return branch;
  }

  async updateBranch(id: string, updates: UpdateBranch): Promise<Branch | undefined> {
    const [updated] = await db
      .update(branches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(branches.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBranch(id: string): Promise<boolean> {
    const result = await db.delete(branches).where(eq(branches.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getBranchStocks(branchId: string): Promise<BranchStockWithProduct[]> {
    const result = await db
      .select()
      .from(branchStocks)
      .leftJoin(products, eq(branchStocks.productId, products.id))
      .where(eq(branchStocks.branchId, branchId));

    return result
      .filter(row => row.products !== null)
      .map(row => ({
        ...row.branch_stocks,
        product: row.products!,
      }));
  }

  async getBranchStock(branchId: string, productId: string): Promise<BranchStock | undefined> {
    const [stock] = await db
      .select()
      .from(branchStocks)
      .where(and(
        eq(branchStocks.branchId, branchId),
        eq(branchStocks.productId, productId)
      ));
    return stock || undefined;
  }

  async upsertBranchStock(stock: InsertBranchStock): Promise<BranchStock> {
    const existing = await this.getBranchStock(stock.branchId, stock.productId);
    
    if (existing) {
      const [updated] = await db
        .update(branchStocks)
        .set({ stock: String(stock.stock) })
        .where(eq(branchStocks.id, existing.id))
        .returning();
      return updated;
    }
    
    const [newStock] = await db
      .insert(branchStocks)
      .values({
        branchId: stock.branchId,
        productId: stock.productId,
        stock: String(stock.stock),
        lowStockThreshold: stock.lowStockThreshold,
      })
      .returning();
    return newStock;
  }

  async updateBranchStock(branchId: string, productId: string, quantity: number): Promise<BranchStock | undefined> {
    const existing = await this.getBranchStock(branchId, productId);
    
    if (!existing) {
      const [newStock] = await db
        .insert(branchStocks)
        .values({
          branchId,
          productId,
          stock: String(quantity),
        })
        .returning();
      return newStock;
    }
    
    const [updated] = await db
      .update(branchStocks)
      .set({ stock: sql`stock + ${quantity}` })
      .where(eq(branchStocks.id, existing.id))
      .returning();
    return updated || undefined;
  }

  async getSalesByBranch(branchId: string): Promise<SaleWithProduct[]> {
    const result = await db
      .select()
      .from(sales)
      .leftJoin(products, eq(sales.productId, products.id))
      .where(eq(sales.branchId, branchId))
      .orderBy(desc(sales.createdAt));

    return result
      .filter(row => row.products !== null)
      .map(row => ({
        ...row.sales,
        product: row.products!,
      }));
  }

  async getSaleOrdersByBranch(branchId: string): Promise<SaleOrderWithItems[]> {
    const orders = await db
      .select()
      .from(saleOrders)
      .leftJoin(users, eq(saleOrders.userId, users.id))
      .where(eq(saleOrders.branchId, branchId))
      .orderBy(desc(saleOrders.createdAt));

    const result: SaleOrderWithItems[] = [];
    
    for (const row of orders) {
      const orderSales = await db
        .select()
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .where(eq(sales.orderId, row.sale_orders.id));

      result.push({
        ...row.sale_orders,
        user: row.users || undefined,
        items: orderSales
          .filter(s => s.products !== null)
          .map(s => ({
            ...s.sales,
            product: s.products!,
          })),
      });
    }

    return result;
  }

  async createSaleOrderForBranch(order: InsertSaleOrder & { userId: string; branchId: string }): Promise<SaleOrder> {
    return await db.transaction(async (tx) => {
      let totalAmount = 0;
      
      for (const item of order.items) {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(
            eq(products.id, item.productId),
            eq(products.branchId, order.branchId)
          ));

        if (!product) {
          throw new Error(`Producto no encontrado en esta sucursal: ${item.productTitle}`);
        }

        const currentStock = Number(product.stock);
        const quantity = Number(item.quantity);
        
        if (currentStock < quantity) {
          throw new Error(`Stock insuficiente para ${product.title}. Disponible: ${currentStock}`);
        }

        totalAmount += item.unitPrice * quantity;
      }

      const changeAmount = order.paymentMethod === "efectivo" && order.paidAmount 
        ? order.paidAmount - totalAmount 
        : null;

      const [saleOrder] = await tx
        .insert(saleOrders)
        .values({
          userId: order.userId,
          branchId: order.branchId,
          paymentMethod: order.paymentMethod,
          paidAmount: order.paidAmount?.toString() || null,
          changeAmount: changeAmount?.toFixed(2) || null,
          totalAmount: totalAmount.toFixed(2),
        })
        .returning();

      for (const item of order.items) {
        const quantity = Number(item.quantity);
        const totalPrice = (item.unitPrice * quantity).toFixed(2);

        await tx
          .insert(sales)
          .values({
            orderId: saleOrder.id,
            branchId: order.branchId,
            productId: item.productId,
            userId: order.userId,
            quantity: String(quantity),
            unitType: item.unitType,
            unitPrice: item.unitPrice.toFixed(2),
            totalPrice,
          });

        await tx
          .update(products)
          .set({ stock: sql`stock - ${quantity}` })
          .where(and(
            eq(products.id, item.productId),
            eq(products.branchId, order.branchId)
          ));
      }

      return saleOrder;
    });
  }

  async getAuditLogsByBranch(branchId: string, offset: number = 0, limit: number = 50): Promise<{ logs: AuditLog[]; total: number }> {
    const [{ count }] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(auditLogs).where(eq(auditLogs.branchId, branchId));
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.branchId, branchId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    return { logs, total: count };
  }

  async getAuditLogsByBusiness(businessId: string, offset: number = 0, limit: number = 50): Promise<{ logs: AuditLog[]; total: number }> {
    // Get all branch IDs for this business
    const businessBranches = await db.select({ id: branches.id }).from(branches).where(eq(branches.businessId, businessId));
    const branchIds = businessBranches.map(b => b.id);
    
    if (branchIds.length === 0) {
      return { logs: [], total: 0 };
    }
    
    const [{ count }] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(auditLogs)
      .where(inArray(auditLogs.branchId, branchIds));
    const logs = await db
      .select()
      .from(auditLogs)
      .where(inArray(auditLogs.branchId, branchIds))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    return { logs, total: count };
  }

  async createInvitation(data: InsertInvitation & { businessId: string; token: string; expiresAt: Date }): Promise<Invitation> {
    const [invitation] = await db
      .insert(invitations)
      .values({
        email: data.email,
        businessId: data.businessId,
        branchId: data.branchId || null,
        role: data.role || "vendedor",
        token: data.token,
        expiresAt: data.expiresAt,
      })
      .returning();
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token));
    return invitation || undefined;
  }

  async markInvitationUsed(id: string): Promise<void> {
    await db.update(invitations).set({ usedAt: new Date() }).where(eq(invitations.id, id));
  }

  async getInvitationsByBusiness(businessId: string): Promise<Invitation[]> {
    return await db.select().from(invitations).where(eq(invitations.businessId, businessId)).orderBy(desc(invitations.createdAt));
  }

  async deleteInvitation(id: string): Promise<boolean> {
    const result = await db.delete(invitations).where(eq(invitations.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getUserBranches(userId: string): Promise<UserBranch[]> {
    return await db
      .select()
      .from(userBranches)
      .where(eq(userBranches.userId, userId));
  }

  async getBranchesForUser(userId: string, role: string): Promise<Branch[]> {
    if (role === "sistemas") {
      return await db.select().from(branches).orderBy(branches.number);
    }

    if (role === "admin") {
      // Admins ven sucursales donde:
      // 1. Son adminUserId del negocio (business.adminUserId)
      // 2. Son adminUserId de la sucursal directamente (branch.adminUserId)
      // 3. Están asignados vía userBranches
      return await db
        .select()
        .from(branches)
        .where(or(
          eq(branches.businessId, 
            sql`(SELECT id FROM businesses WHERE admin_user_id = ${userId})`
          ),
          eq(branches.adminUserId, userId),
          sql`${branches.id} IN (SELECT branch_id FROM user_branches WHERE user_id = ${userId})`
        ))
        .orderBy(branches.number);
    }

    const assignedBranchIds = await db
      .select({ branchId: userBranches.branchId })
      .from(userBranches)
      .where(eq(userBranches.userId, userId));

    if (assignedBranchIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(branches)
      .where(sql`${branches.id} IN (${sql.join(assignedBranchIds.map(b => sql`${b.branchId}`), sql`, `)})`)
      .orderBy(branches.number);
  }

  async setUserBranches(userId: string, branchIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(userBranches).where(eq(userBranches.userId, userId));
      
      if (branchIds.length > 0) {
        await tx.insert(userBranches).values(
          branchIds.map(branchId => ({
            userId,
            branchId,
          }))
        );
      }
    });
  }

  async canUserAccessBranch(userId: string, branchId: string, role: string): Promise<boolean> {
    if (role === "sistemas") {
      return true;
    }

    if (role === "admin") {
      // Verificar si es admin del negocio
      const [adminBranch] = await db
        .select()
        .from(branches)
        .where(and(
          eq(branches.id, branchId),
          eq(branches.businessId, 
            sql`(SELECT id FROM businesses WHERE admin_user_id = ${userId})`
          )
        ));
      
      if (adminBranch) return true;

      // Verificar si es admin directo de la sucursal
      const [directAdmin] = await db
        .select()
        .from(branches)
        .where(and(
          eq(branches.id, branchId),
          eq(branches.adminUserId, userId)
        ));
      
      if (directAdmin) return true;
    }

    const [assignment] = await db
      .select()
      .from(userBranches)
      .where(and(
        eq(userBranches.userId, userId),
        eq(userBranches.branchId, branchId)
      ));

    return !!assignment;
  }

  async getUserWithBranches(userId: string): Promise<UserWithBranches | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;

    const assignments = await db
      .select()
      .from(userBranches)
      .leftJoin(branches, eq(userBranches.branchId, branches.id))
      .where(eq(userBranches.userId, userId));

    return {
      ...user,
      userBranches: assignments.map(a => ({
        ...a.user_branches,
        branch: a.branches || undefined,
      })),
    };
  }

  // Plans & Features
  async getPlans(includeInactive = false): Promise<Plan[]> {
    if (includeInactive) return await db.select().from(plans).orderBy(plans.sortOrder);
    return await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.sortOrder);
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    const [p] = await db.select().from(plans).where(eq(plans.id, id));
    return p || undefined;
  }

  async getPlanBySlug(slug: string): Promise<Plan | undefined> {
    const [p] = await db.select().from(plans).where(eq(plans.slug, slug));
    return p || undefined;
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    const [p] = await db.insert(plans).values({ ...plan, price: String(plan.price) }).returning();
    return p;
  }

  async updatePlan(id: string, updates: Partial<InsertPlan>): Promise<Plan | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.price !== undefined) updateData.price = String(updates.price);
    const [p] = await db.update(plans).set(updateData).where(eq(plans.id, id)).returning();
    return p || undefined;
  }

  async getFeatures(): Promise<Feature[]> {
    return await db.select().from(features).orderBy(features.category, features.name);
  }

  async createFeature(feature: InsertFeature): Promise<Feature> {
    const [f] = await db.insert(features).values(feature).returning();
    return f;
  }

  async getPlanFeatures(planId: string): Promise<PlanFeature[]> {
    return await db.select().from(planFeatures).where(eq(planFeatures.planId, planId));
  }

  async getAllPlanFeatures(): Promise<PlanFeature[]> {
    return await db.select().from(planFeatures);
  }

  async upsertPlanFeature(planId: string, featureKey: string, enabled: boolean, limit?: number | null): Promise<PlanFeature> {
    const [existing] = await db.select().from(planFeatures).where(
      and(eq(planFeatures.planId, planId), eq(planFeatures.featureKey, featureKey))
    );

    if (existing) {
      const [updated] = await db.update(planFeatures)
        .set({ enabled, limit: limit !== undefined ? limit : existing.limit })
        .where(eq(planFeatures.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(planFeatures)
      .values({ planId, featureKey, enabled, limit: limit ?? null })
      .returning();
    return created;
  }

  // Subscription events
  async createSubscriptionEvent(event: InsertSubscriptionEvent): Promise<SubscriptionEvent> {
    const [e] = await db.insert(subscriptionEvents)
      .values({ ...event, amount: event.amount ? String(event.amount) : null })
      .returning();
    return e;
  }

  async getSubscriptionEvents(businessId: string): Promise<SubscriptionEvent[]> {
    return await db.select().from(subscriptionEvents)
      .where(eq(subscriptionEvents.businessId, businessId))
      .orderBy(desc(subscriptionEvents.createdAt));
  }

  async getBusinessesWithExpiredGrace(): Promise<Business[]> {
    return await db.select().from(businesses).where(
      and(
        eq(businesses.subscriptionStatus, "grace_period"),
        lt(businesses.graceEndsAt, new Date())
      )
    );
  }

  async getUserCountForBusiness(businessId: string): Promise<number> {
    // Count users who have access to any branch of this business
    const businessBranches = await db.select({ id: branches.id }).from(branches)
      .where(eq(branches.businessId, businessId));
    if (businessBranches.length === 0) return 0;
    const branchIds = businessBranches.map(b => b.id);
    const result = await db.select({ count: sql<number>`count(distinct user_id)` })
      .from(userBranches)
      .where(inArray(userBranches.branchId, branchIds));
    return Number(result[0]?.count ?? 0);
  }
}

export const storage = new DatabaseStorage();
