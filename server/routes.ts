import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertSaleSchema, updateSaleSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { registerAuthRoutes, requireAuth, requireAdmin } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  registerAuthRoutes(app);
  
  app.get("/api/products", requireAuth, async (_req: Request, res: Response) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = insertProductSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const product = await storage.createProduct(result.data);
      res.status(201).json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/products/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = insertProductSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const product = await storage.updateProduct(req.params.id, result.data);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/products/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sales", requireAuth, async (_req: Request, res: Response) => {
    try {
      const sales = await storage.getSales();
      res.json(sales);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sales/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ message: "Venta no encontrada" });
      }
      res.json(sale);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = insertSaleSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const sale = await storage.createSale({
        ...result.data,
        userId: req.session.userId!,
      });
      res.status(201).json(sale);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/sales/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = updateSaleSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const currentSale = await storage.getSale(req.params.id);
      if (!currentSale) {
        return res.status(404).json({ message: "Venta no encontrada" });
      }

      if (req.session.userRole !== "admin" && currentSale.userId !== req.session.userId) {
        return res.status(403).json({ message: "No tienes permiso para editar esta venta" });
      }

      const sale = await storage.updateSale(req.params.id, result.data);
      if (!sale) {
        return res.status(404).json({ message: "Venta no encontrada" });
      }
      res.json(sale);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/sales/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ message: "Venta no encontrada" });
      }

      await storage.updateProductStock(sale.productId, sale.quantity);
      
      const deleted = await storage.deleteSale(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Error al eliminar la venta" });
      }
      
      res.json({ success: true, message: "Venta eliminada y stock restaurado" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
