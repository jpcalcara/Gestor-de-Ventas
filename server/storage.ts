import { type Product, type InsertProduct, type Sale, type InsertSale, type SaleWithProduct } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: InsertProduct): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  getSales(): Promise<SaleWithProduct[]>;
  getSale(id: string): Promise<Sale | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  
  updateProductStock(productId: string, quantity: number): Promise<Product | undefined>;
}

export class MemStorage implements IStorage {
  private products: Map<string, Product>;
  private sales: Map<string, Sale>;

  constructor() {
    this.products = new Map();
    this.sales = new Map();
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const product: Product = {
      id,
      title: insertProduct.title,
      description: insertProduct.description,
      price: String(insertProduct.price),
      stock: insertProduct.stock,
      imageUrl: insertProduct.imageUrl || null,
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: string, insertProduct: InsertProduct): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;

    const updated: Product = {
      id,
      title: insertProduct.title,
      description: insertProduct.description,
      price: String(insertProduct.price),
      stock: insertProduct.stock,
      imageUrl: insertProduct.imageUrl || null,
    };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.products.delete(id);
  }

  async getSales(): Promise<SaleWithProduct[]> {
    const salesArray = Array.from(this.sales.values());
    const salesWithProducts: SaleWithProduct[] = [];

    for (const sale of salesArray) {
      const product = await this.getProduct(sale.productId);
      if (product) {
        salesWithProducts.push({
          ...sale,
          product,
        });
      }
    }

    return salesWithProducts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getSale(id: string): Promise<Sale | undefined> {
    return this.sales.get(id);
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    const product = await this.getProduct(insertSale.productId);
    if (!product) {
      throw new Error("Producto no encontrado");
    }

    if (product.stock < insertSale.quantity) {
      throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
    }

    const id = randomUUID();
    const unitPrice = Number(product.price);
    const totalPrice = unitPrice * insertSale.quantity;
    
    const sale: Sale = {
      id,
      productId: insertSale.productId,
      quantity: insertSale.quantity,
      unitPrice: String(unitPrice),
      totalPrice: String(totalPrice),
      createdAt: new Date(),
    };

    this.sales.set(id, sale);

    await this.updateProductStock(insertSale.productId, -insertSale.quantity);

    return sale;
  }

  async updateProductStock(productId: string, quantityChange: number): Promise<Product | undefined> {
    const product = this.products.get(productId);
    if (!product) return undefined;

    const updatedProduct: Product = {
      ...product,
      stock: product.stock + quantityChange,
    };
    this.products.set(productId, updatedProduct);
    return updatedProduct;
  }
}

export const storage = new MemStorage();
