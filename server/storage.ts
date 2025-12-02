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
  type Branch,
  type InsertBranch,
  type UpdateBranch,
  type BranchStock,
  type InsertBranchStock,
  type BranchStockWithProduct,
  products,
  sales,
  saleOrders,
  users,
  auditLogs,
  passwordResetTokens,
  companySettings,
  branches,
  branchStocks,
  updateSaleSchema,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  getProducts(branchId?: string): Promise<Product[]>;
  getProductByBranch(id: string, branchId: string): Promise<Product | undefined>;
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
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  upsertUser(userData: UpsertUser): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
  
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(): Promise<AuditLog[]>;
  
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  
  getCompanySettings(): Promise<CompanySettings>;
  updateCompanySettings(updates: UpdateCompanySettings): Promise<CompanySettings>;
  
  getBranches(): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: string, updates: UpdateBranch): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<boolean>;
  
  getBranchStocks(branchId: string): Promise<BranchStockWithProduct[]>;
  getBranchStock(branchId: string, productId: string): Promise<BranchStock | undefined>;
  upsertBranchStock(stock: InsertBranchStock): Promise<BranchStock>;
  updateBranchStock(branchId: string, productId: string, quantity: number): Promise<BranchStock | undefined>;
  
  getSalesByBranch(branchId: string): Promise<SaleWithProduct[]>;
  getSaleOrdersByBranch(branchId: string): Promise<SaleOrderWithItems[]>;
  createSaleOrderForBranch(order: InsertSaleOrder & { userId: string; branchId: string }): Promise<SaleOrder>;
  
  getAuditLogsByBranch(branchId: string): Promise<AuditLog[]>;
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

  async createProduct(insertProduct: InsertProduct & { branchId: string }): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values({
        ...insertProduct,
        price: String(insertProduct.price),
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
      })
      .where(and(eq(products.id, id), eq(products.branchId, branchId)))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: string, branchId: string): Promise<boolean> {
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

      if (!updatedProduct || updatedProduct.stock < 0) {
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
        role: "admin",
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

  async getAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
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

  async getCompanySettings(): Promise<CompanySettings> {
    const [settings] = await db.select().from(companySettings);
    if (settings) return settings;
    
    const [newSettings] = await db
      .insert(companySettings)
      .values({ companyName: "JOTA Sistemas" })
      .returning();
    return newSettings;
  }

  async updateCompanySettings(updates: UpdateCompanySettings): Promise<CompanySettings> {
    const current = await this.getCompanySettings();
    const [updated] = await db
      .update(companySettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companySettings.id, current.id))
      .returning();
    return updated;
  }

  async getBranches(): Promise<Branch[]> {
    return await db.select().from(branches).orderBy(branches.number);
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch || undefined;
  }

  async createBranch(insertBranch: InsertBranch): Promise<Branch> {
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

  async getAuditLogsByBranch(branchId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.branchId, branchId))
      .orderBy(desc(auditLogs.createdAt));
  }
}

export const storage = new DatabaseStorage();
