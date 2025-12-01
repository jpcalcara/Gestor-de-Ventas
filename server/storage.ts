import { 
  type Product, 
  type InsertProduct, 
  type Sale, 
  type InsertSale,
  type UpdateSale,
  type SaleWithProduct,
  type User,
  type InsertUser,
  type UpsertUser,
  type AuditLog,
  type InsertAuditLog,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  products,
  sales,
  users,
  auditLogs,
  passwordResetTokens,
  updateSaleSchema,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, ne } from "drizzle-orm";

export interface IStorage {
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: InsertProduct): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  getSales(): Promise<SaleWithProduct[]>;
  getSale(id: string): Promise<Sale | undefined>;
  createSale(sale: InsertSale & { userId: string }): Promise<Sale>;
  updateSale(id: string, updates: UpdateSale): Promise<Sale | undefined>;
  deleteSale(id: string): Promise<boolean>;
  
  updateProductStock(productId: string, quantity: number): Promise<Product | undefined>;
  
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
}

export class DatabaseStorage implements IStorage {
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values({
        ...insertProduct,
        price: String(insertProduct.price),
      })
      .returning();
    return product;
  }

  async updateProduct(id: string, insertProduct: InsertProduct): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({
        ...insertProduct,
        price: String(insertProduct.price),
      })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getSales(): Promise<SaleWithProduct[]> {
    const result = await db
      .select()
      .from(sales)
      .leftJoin(products, eq(sales.productId, products.id))
      .orderBy(desc(sales.createdAt));

    return result
      .filter(row => row.products !== null)
      .map(row => ({
        ...row.sales,
        product: row.products!,
      }));
  }

  async getSale(id: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, id));
    return sale || undefined;
  }

  async createSale(insertSale: InsertSale & { userId: string }): Promise<Sale> {
    return await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, insertSale.productId));

      if (!product) {
        throw new Error("Producto no encontrado");
      }

      const unitPriceCents = Math.round(parseFloat(product.price) * 100);
      const totalPriceCents = unitPriceCents * insertSale.quantity;
      const unitPrice = (unitPriceCents / 100).toFixed(2);
      const totalPrice = (totalPriceCents / 100).toFixed(2);

      const [sale] = await tx
        .insert(sales)
        .values({
          productId: insertSale.productId,
          userId: insertSale.userId,
          quantity: insertSale.quantity,
          unitPrice,
          totalPrice,
        })
        .returning();

      const [updatedProduct] = await tx
        .update(products)
        .set({ stock: sql`stock - ${insertSale.quantity}` })
        .where(eq(products.id, insertSale.productId))
        .returning();

      if (!updatedProduct || updatedProduct.stock < 0) {
        throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
      }

      return sale;
    });
  }

  async updateSale(id: string, updates: UpdateSale): Promise<Sale | undefined> {
    updateSaleSchema.parse(updates);
    
    return await db.transaction(async (tx) => {
      const [currentSale] = await tx
        .select()
        .from(sales)
        .where(eq(sales.id, id))
        .for('update');

      if (!currentSale) return undefined;

      const originalQty = currentSale.quantity;
      const nextQty = updates.quantity;

      if (nextQty === originalQty) {
        const [updated] = await tx
          .update(sales)
          .set({
            isEdited: true,
            updatedAt: new Date(),
          })
          .where(eq(sales.id, id))
          .returning();
        return updated || undefined;
      }

      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, currentSale.productId))
        .for('update');

      if (!product) throw new Error("Producto no encontrado");

      const delta = originalQty - nextQty;
      
      if (product.stock + delta < 0) {
        throw new Error(`Stock insuficiente. Disponible: ${product.stock + originalQty}`);
      }

      const unitPriceCents = Math.round(parseFloat(currentSale.unitPrice) * 100);
      const totalPriceCents = unitPriceCents * nextQty;
      const totalPrice = (totalPriceCents / 100).toFixed(2);

      const [updatedProduct] = await tx
        .update(products)
        .set({ stock: sql`stock + ${delta}` })
        .where(eq(products.id, currentSale.productId))
        .returning();

      if (!updatedProduct) {
        throw new Error("Stock cambió concurrentemente");
      }

      const [updated] = await tx
        .update(sales)
        .set({
          quantity: nextQty,
          totalPrice,
          isEdited: true,
          updatedAt: new Date(),
        })
        .where(eq(sales.id, id))
        .returning();

      if (!updated) {
        throw new Error("Venta cambió concurrentemente");
      }

      return updated;
    });
  }

  async deleteSale(id: string): Promise<boolean> {
    const result = await db.delete(sales).where(eq(sales.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async updateProductStock(productId: string, quantityChange: number): Promise<Product | undefined> {
    return await db.transaction(async (tx) => {
      const [updatedProduct] = await tx
        .update(products)
        .set({ stock: sql`stock + ${quantityChange}` })
        .where(eq(products.id, productId))
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
}

export const storage = new DatabaseStorage();
