import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertSaleSchema, updateSaleSchema, updateCompanySettingsSchema, insertBranchSchema, updateBranchSchema, insertBranchStockSchema, updateUserBranchesSchema, insertInvitationSchema, updatePlanSchema, insertFeatureSchema, registerBusinessSchema, features as featuresFlagsTable, planFeatures as planFeaturesTable, businesses as businessesTable, saleOrders as saleOrdersTable } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { registerAuthRoutes, requireAuth, requireAdmin, hashPassword } from "./auth";
import { generateSlug } from "./utils";
import { requireFeatureMiddleware, getBusinessFeatures, checkFeatureLimit, invalidateFeatureCache, requireActiveSubscription, isFeatureEnabledForBusiness } from "./features";
import { getMPClientForBusiness, getBusinessMPStatus } from "./mercadopago";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

function requireSistemas(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ message: "No autenticado" });
  if (req.session.userRole !== "sistemas") return res.status(403).json({ message: "Solo superadmin puede realizar esta acción" });
  next();
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, gif, webp)"));
    }
  }
});

async function createAuditLog(
  userId: string,
  userName: string,
  actionType: string,
  entity: string,
  entityId?: string,
  details?: string,
  branchId?: string
) {
  try {
    await storage.createAuditLog({
      userId,
      userName,
      actionType,
      entity,
      entityId: entityId || null,
      details: details || null,
      branchId: branchId || null,
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  registerAuthRoutes(app);
  
  app.get("/api/product-lookup/barcode/:code", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      if (!code || code.length < 4) {
        return res.status(400).json({ message: "Código de barras inválido" });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) {
          return res.status(404).json({ message: "Producto no encontrado en la base de datos pública" });
        }

        const data = await response.json();

        if (!data || data.status !== 1 || !data.product) {
          return res.status(404).json({ message: "Producto no encontrado en la base de datos pública" });
        }

        const p = data.product;
        res.json({
          title: p.product_name_es || p.product_name || "",
          description: p.generic_name || p.categories || "",
          brand: p.brands || "",
          imageUrl: p.image_url || p.image_front_url || "",
          barcode: code,
          source: "openfoodfacts",
        });
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === "AbortError") {
          return res.status(503).json({ message: "La consulta al servicio externo tardó demasiado. Intenta de nuevo." });
        }
        return res.status(503).json({ message: "Error al consultar la base de datos pública de productos" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/product-lookup/image", requireAdmin, async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ message: "El reconocimiento por imagen no está configurado. Falta la API key de Gemini." });
      }

      const { imageBase64, mimeType } = req.body;
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ message: "Imagen y tipo MIME son requeridos" });
      }

      const validMimes = ["image/jpeg", "image/png", "image/webp"];
      if (!validMimes.includes(mimeType)) {
        return res.status(400).json({ message: "Formato de imagen no soportado. Usa JPEG, PNG o WebP." });
      }

      // Check feature flags
      const businessId = req.session.businessId;
      const canUseImageRecognition = req.session.userRole === "sistemas" || !businessId ||
        (await isFeatureEnabledForBusiness("ai_image_recognition", businessId));
      if (!canUseImageRecognition) {
        return res.status(403).json({ message: "El reconocimiento de imagen no está disponible en tu plan.", code: "FEATURE_NOT_IN_PLAN" });
      }

      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      let parsed: any;
      try {
        const imageResult = await model.generateContent([
          {
            inlineData: {
              mimeType: mimeType as any,
              data: imageBase64,
            },
          },
          {
            text: `Analizá esta imagen de un producto de comercio minorista argentino. Respondé ÚNICAMENTE con un JSON sin markdown con este formato exacto:
{"title":"nombre comercial del producto","description":"descripción breve (tipo, sabor, variante, etc.)","brand":"marca del producto","unitType":"unidad","confidence":"high"}
unitType debe ser "unidad", "gramos" o "litros" según corresponda. confidence debe ser "high", "medium" o "low".`,
          },
        ]);
        const text = imageResult.response.text().trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch (err: any) {
        console.error("Gemini image error:", err.message);
        return res.status(502).json({ message: "Error al analizar la imagen con IA" });
      }

      // Price suggestion (only if feature enabled)
      const canUsePriceSuggestion = req.session.userRole === "sistemas" || !businessId ||
        (await isFeatureEnabledForBusiness("ai_price_suggestion", businessId));

      let priceSuggestion: { suggested: number; range: string; source: string } | null = null;

      if (canUsePriceSuggestion && parsed.title) {
        try {
          const searchModel = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            tools: [{ googleSearch: {} } as any],
          });
          const searchResult = await searchModel.generateContent(
            `Buscá el precio de venta al público en Argentina de: "${parsed.title}". Respondé ÚNICAMENTE con un JSON sin markdown:
{"precioSugerido":1500,"rango":"entre $1200 y $1800","fuente":"descripción breve de la fuente"}
precioSugerido es un número. No incluyas el símbolo $. Si no encontrás datos concretos, estimá razonablemente.`
          );
          const searchText = searchResult.response.text().trim();
          const searchMatch = searchText.match(/\{[\s\S]*\}/);
          if (searchMatch) {
            const sp = JSON.parse(searchMatch[0]);
            priceSuggestion = {
              suggested: Number(sp.precioSugerido) || 0,
              range: sp.rango || "",
              source: sp.fuente || "",
            };
          }
        } catch (err: any) {
          console.error("Gemini price search error:", err.message);
          // non-fatal — price suggestion is optional
        }
      }

      res.json({
        title: parsed.title || "",
        description: parsed.description || "",
        brand: parsed.brand || "",
        unitType: parsed.unitType || "unidad",
        confidence: parsed.confidence || "low",
        source: "ai-vision",
        priceSuggestion,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      const search = (req.query.search as string || "").toLowerCase().trim();
      const products = await storage.getProducts(branchId);
      
      if (search) {
        const filtered = products.filter(p => 
          p.title.toLowerCase().includes(search) || 
          p.description.toLowerCase().includes(search)
        );
        res.json(filtered);
      } else {
        res.json(products);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      const product = await storage.getProductByBranch(req.params.id, branchId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado en esta sucursal" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products", requireAdmin, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      
      const result = insertProductSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const existingProduct = await storage.getProductByTitle(result.data.title, branchId);
      if (existingProduct) {
        return res.status(400).json({ message: "Ya existe un producto con este nombre en la sucursal" });
      }

      if (result.data.barcode && result.data.barcode.trim() !== "") {
        const existingBarcode = await storage.getProductByBarcode(result.data.barcode.trim(), branchId);
        if (existingBarcode) {
          return res.status(400).json({ message: `El código de barras ${result.data.barcode} ya está asignado al producto "${existingBarcode.title}"` });
        }
      }

      const product = await storage.createProduct({ ...result.data, branchId });

      // Auto-create branch stock record with the product's initial stock
      if (result.data.stock !== undefined) {
        await storage.upsertBranchStock({
          branchId,
          productId: product.id,
          stock: String(result.data.stock),
          lowStockThreshold: null,
        });
      }
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "crear",
        "producto",
        product.id,
        `Producto creado: ${product.title}`,
        branchId
      );
      
      res.status(201).json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/products/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      
      const result = insertProductSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const currentProduct = await storage.getProductByBranch(req.params.id, branchId);
      if (!currentProduct) {
        return res.status(404).json({ message: "Producto no encontrado en esta sucursal" });
      }

      if (currentProduct.title !== result.data.title) {
        const existingProduct = await storage.getProductByTitle(result.data.title, branchId);
        if (existingProduct) {
          return res.status(400).json({ message: "Ya existe otro producto con este nombre en la sucursal" });
        }
      }

      if (result.data.barcode && result.data.barcode.trim() !== "") {
        const trimmedBarcode = result.data.barcode.trim();
        if (currentProduct.barcode !== trimmedBarcode) {
          const existingBarcode = await storage.getProductByBarcode(trimmedBarcode, branchId);
          if (existingBarcode) {
            return res.status(400).json({ message: `El código de barras ${trimmedBarcode} ya está asignado al producto "${existingBarcode.title}"` });
          }
        }
      }

      const product = await storage.updateProduct(req.params.id, result.data, branchId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado en esta sucursal" });
      }

      // Sync branch stock when stock changes
      if (result.data.stock !== undefined) {
        await storage.upsertBranchStock({
          branchId,
          productId: product.id,
          stock: String(result.data.stock),
          lowStockThreshold: null,
        });
      }
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "editar",
        "producto",
        product.id,
        `Producto editado: ${product.title}`,
        branchId
      );
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/products/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      
      const productToDelete = await storage.getProductByBranch(req.params.id, branchId);
      if (!productToDelete) {
        return res.status(404).json({ message: "Producto no encontrado en esta sucursal" });
      }
      
      const deleted = await storage.deleteProduct(req.params.id, branchId);
      if (!deleted) {
        return res.status(404).json({ message: "Producto no encontrado en esta sucursal" });
      }
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "eliminar",
        "producto",
        req.params.id,
        `Producto eliminado: ${productToDelete.title}`,
        branchId
      );
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products/import", requireAdmin, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }

      const { products: rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No se recibieron productos para importar" });
      }

      const results: { row: number; title: string; success: boolean; error?: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +2: header row + 1-indexed
        const title = String(row.title || "");

        try {
          const parsed = insertProductSchema.safeParse(row);
          if (!parsed.success) {
            const errMsg = fromError(parsed.error).message;
            results.push({ row: rowNum, title, success: false, error: errMsg });
            continue;
          }

          const existingTitle = await storage.getProductByTitle(parsed.data.title, branchId);
          if (existingTitle) {
            results.push({ row: rowNum, title, success: false, error: `Ya existe un producto con el nombre "${parsed.data.title}"` });
            continue;
          }

          if (parsed.data.barcode && parsed.data.barcode.trim() !== "") {
            const existingBarcode = await storage.getProductByBarcode(parsed.data.barcode.trim(), branchId);
            if (existingBarcode) {
              results.push({ row: rowNum, title, success: false, error: `El código de barras "${parsed.data.barcode}" ya pertenece a "${existingBarcode.title}"` });
              continue;
            }
          }

          const product = await storage.createProduct({ ...parsed.data, branchId });

          if (parsed.data.stock !== undefined) {
            await storage.upsertBranchStock({
              branchId,
              productId: product.id,
              stock: String(parsed.data.stock),
              lowStockThreshold: null,
            });
          }

          results.push({ row: rowNum, title: product.title, success: true });
        } catch (err: any) {
          results.push({ row: rowNum, title, success: false, error: err.message });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      if (successCount > 0) {
        await createAuditLog(
          req.session.userId!,
          req.session.userName!,
          "crear",
          "producto",
          "bulk",
          `Importación CSV: ${successCount} producto(s) importado(s)`,
          branchId
        );
      }

      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      const userRole = req.session.userRole;
      const userId = req.session.userId!;
      let sales = await storage.getSalesByBranch(branchId);
      if (userRole === "vendedor") {
        sales = sales.filter(s => s.userId === userId);
      }
      res.json(sales);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sales/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      const sale = await storage.getSaleByBranch(req.params.id, branchId);
      if (!sale) {
        return res.status(404).json({ message: "Venta no encontrada en esta sucursal" });
      }
      res.json(sale);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      
      const result = insertSaleSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const product = await storage.getProductByBranch(result.data.productId, branchId);
      if (!product) {
        return res.status(400).json({ message: "El producto no existe en esta sucursal" });
      }

      const sale = await storage.createSale({
        ...result.data,
        userId: req.session.userId!,
        branchId,
      });
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "registrar_venta",
        "venta",
        sale.id,
        `Venta registrada: ${result.data.quantity} unidades de ${product.title}`,
        branchId
      );
      
      res.status(201).json(sale);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/sales/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      
      const result = updateSaleSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const currentSale = await storage.getSaleByBranch(req.params.id, branchId);
      if (!currentSale) {
        return res.status(404).json({ message: "Venta no encontrada en esta sucursal" });
      }

      if (req.session.userRole !== "admin" && req.session.userRole !== "sistemas" && currentSale.userId !== req.session.userId) {
        return res.status(403).json({ message: "No tienes permiso para editar esta venta" });
      }

      const sale = await storage.updateSale(req.params.id, result.data, branchId);
      if (!sale) {
        return res.status(404).json({ message: "Venta no encontrada" });
      }
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "editar_venta",
        "venta",
        sale.id,
        `Venta editada: cantidad cambiada a ${result.data.quantity}`,
        branchId
      );
      
      res.json(sale);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/sales/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      
      const sale = await storage.getSaleByBranch(req.params.id, branchId);
      if (!sale) {
        return res.status(404).json({ message: "Venta no encontrada en esta sucursal" });
      }

      await storage.updateProductStock(sale.productId, branchId, Number(sale.quantity));
      
      const deleted = await storage.deleteSale(req.params.id, branchId);
      if (!deleted) {
        return res.status(500).json({ message: "Error al eliminar la venta" });
      }
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "eliminar_venta",
        "venta",
        req.params.id,
        `Venta eliminada, stock restaurado: ${sale.quantity} unidades`,
        branchId
      );
      
      res.json({ success: true, message: "Venta eliminada y stock restaurado" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sale-orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      const orders = await storage.getSaleOrdersByBranch(branchId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sale-orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      
      const { insertSaleOrderSchema } = await import("@shared/schema");
      const result = insertSaleOrderSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      for (const item of result.data.items) {
        const product = await storage.getProductByBranch(item.productId, branchId);
        if (!product) {
          return res.status(400).json({ message: `El producto ${item.productTitle} no existe en esta sucursal` });
        }
      }

      const order = await storage.createSaleOrderForBranch({
        ...result.data,
        userId: req.session.userId!,
        branchId,
      });

      const itemsDescription = result.data.items
        .map(i => `${i.quantity} ${i.unitType} de ${i.productTitle}`)
        .join(", ");
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "registrar_venta",
        "orden_venta",
        order.id,
        `Orden de venta registrada: ${itemsDescription}. Método: ${result.data.paymentMethod}. Total: ${order.totalAmount}`,
        branchId
      );
      
      res.status(201).json(order);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const createUserSchema = z.object({
    email: z.string().email("Email inválido"),
    firstName: z.string().min(1, "El nombre es requerido"),
    lastName: z.string().min(1, "El apellido es requerido"),
    phone: z.string().optional(),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    role: z.enum(["admin", "vendedor"]).default("vendedor"),
  });

  app.get("/api/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;
      const businessId = req.session.businessId;

      let filteredUsers;

      if (userRole === "sistemas") {
        // sistemas ve a todos los usuarios del sistema
        filteredUsers = await storage.getUsers();
      } else if (userRole === "admin" && businessId) {
        // admin ve solo usuarios de su propio negocio
        filteredUsers = await storage.getUsersForBusiness(businessId);
      } else if (userRole === "vendedor") {
        // vendedor solo se ve a sí mismo
        const self = await storage.getUser(userId);
        filteredUsers = self ? [self] : [];
      } else {
        filteredUsers = [];
      }
      
      const safeUsers = filteredUsers.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        avatar: u.avatar,
        profileImageUrl: u.profileImageUrl,
        createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = createUserSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const existing = await storage.getUserByEmail(result.data.email);
      if (existing) {
        return res.status(400).json({ message: "El email ya está registrado" });
      }

      const hashedPassword = await hashPassword(result.data.password);
      const user = await storage.createUser({
        ...result.data,
        password: hashedPassword,
      });

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "crear_usuario",
        "usuario",
        user.id,
        `Usuario creado: ${user.firstName} ${user.lastName} (${user.role})`
      );

      res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const actorRole = req.session.userRole;
      const targetRole = targetUser.role;

      if (targetRole === "sistemas" && actorRole !== "sistemas") {
        return res.status(403).json({ message: "Solo usuarios sistemas pueden modificar otros usuarios sistemas" });
      }

      if (targetRole === "admin" && actorRole === "admin") {
        return res.status(403).json({ message: "Administradores no pueden modificar otros administradores" });
      }

      const { firstName, lastName, phone, role, password, isActive } = req.body;
      const updates: any = {};
      
      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (phone !== undefined) updates.phone = phone;
      
      if (role && ["admin", "vendedor", "sistemas"].includes(role)) {
        if (role === "sistemas" && actorRole !== "sistemas") {
          return res.status(403).json({ message: "Solo usuarios sistemas pueden asignar el rol sistemas" });
        }
        updates.role = role;
      }
      
      if (password && password.length >= 6) {
        updates.password = await hashPassword(password);
      }
      
      if (typeof isActive === "boolean") {
        if (targetRole === "sistemas" && actorRole !== "sistemas") {
          return res.status(403).json({ message: "Solo usuarios sistemas pueden habilitar/deshabilitar otros usuarios sistemas" });
        }
        if (targetRole === "admin" && actorRole !== "sistemas") {
          return res.status(403).json({ message: "Solo usuarios sistemas pueden habilitar/deshabilitar administradores" });
        }
        updates.isActive = isActive;
      }

      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const actionType = typeof isActive === "boolean" 
        ? (isActive ? "habilitar_usuario" : "deshabilitar_usuario")
        : "editar_usuario";
      
      const description = typeof isActive === "boolean"
        ? `Usuario ${isActive ? "habilitado" : "deshabilitado"}: ${user.firstName} ${user.lastName}`
        : `Usuario editado: ${user.firstName} ${user.lastName}`;

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        actionType,
        "usuario",
        user.id,
        description
      );

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.params.id === req.session.userId) {
        return res.status(400).json({ message: "No puedes eliminar tu propia cuenta" });
      }

      const userToDelete = await storage.getUser(req.params.id);
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "eliminar_usuario",
        "usuario",
        req.params.id,
        `Usuario eliminado: ${userToDelete?.firstName} ${userToDelete?.lastName}`
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users/:id/branches", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userWithBranches = await storage.getUserWithBranches(req.params.id);
      if (!userWithBranches) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const branchIds = userWithBranches.userBranches?.map(ub => ub.branchId) || [];
      res.json({ branchIds });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id/branches", requireAdmin, async (req: Request, res: Response) => {
    try {
      const currentUser = req.session.userRole;
      
      if (currentUser !== "sistemas") {
        return res.status(403).json({ message: "Solo usuarios sistemas pueden asignar sucursales" });
      }

      const result = updateUserBranchesSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      if (targetUser.role === "sistemas") {
        return res.status(400).json({ message: "No se pueden asignar sucursales a usuarios sistemas" });
      }

      await storage.setUserBranches(req.params.id, result.data.branchIds);

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "asignar_sucursales",
        "usuario",
        req.params.id,
        `Sucursales asignadas a ${targetUser.firstName} ${targetUser.lastName}: ${result.data.branchIds.length} sucursal(es)`
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/audit-logs", requireAdmin, requireFeatureMiddleware("auditoria"), async (req: Request, res: Response) => {
    try {
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 50));
      
      // sistemas sees all; admin sees only their business logs
      if (req.session.userRole !== "sistemas" && req.session.businessId) {
        const result = await storage.getAuditLogsByBusiness(req.session.businessId, offset, limit);
        return res.json(result);
      }
      
      const result = await storage.getAuditLogs(offset, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/company-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      const settings = await storage.getCompanySettings(businessId || undefined);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/company-settings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = updateCompanySettingsSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const businessId = req.session.businessId || undefined;
      const settings = await storage.updateCompanySettings(result.data, businessId);
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "editar_configuracion",
        "configuracion",
        settings.id,
        `Configuración de empresa actualizada`
      );

      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.use("/uploads", (await import("express")).default.static(uploadsDir));

  app.get("/api/businesses", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;
      const businessesList = await storage.getBusinessesForUser(userId, userRole);
      // Enrich with branch counts
      const enriched = await Promise.all(
        businessesList.map(async (b) => {
          const branches = await storage.getBranchesForBusiness(b.id);
          return { ...b, branchCount: branches.length };
        })
      );
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/businesses", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.session.userRole !== "sistemas") {
        return res.status(403).json({ message: "Solo usuarios sistemas pueden crear negocios" });
      }

      const { insertBusinessSchema } = await import("@shared/schema");
      const result = insertBusinessSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      // Auto-generate slug from razonSocial if not provided
      const slug = result.data.slug || generateSlug(result.data.razonSocial);
      
      const business = await storage.createBusiness({ ...result.data, slug, adminUserId: req.session.userId! });
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "crear_negocio",
        "negocio",
        business.id,
        `Negocio creado: ${business.razonSocial}`
      );

      res.status(201).json(business);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/businesses/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.session.userRole !== "sistemas") {
        return res.status(403).json({ message: "Solo usuarios sistemas pueden editar negocios" });
      }

      const { updateBusinessSchema } = await import("@shared/schema");
      const result = updateBusinessSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const updateData = { ...result.data };
      // Auto-regenerate slug when razonSocial changes
      if (updateData.razonSocial) {
        const { generateSlug } = await import("./utils");
        updateData.slug = generateSlug(updateData.razonSocial);
      }

      const business = await storage.updateBusiness(req.params.id, updateData);
      if (!business) {
        return res.status(404).json({ message: "Negocio no encontrado" });
      }

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "editar_negocio",
        "negocio",
        req.params.id,
        `Negocio actualizado: ${business.razonSocial}`
      );

      res.json(business);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/businesses/:id/admins", requireAdmin, async (req: Request, res: Response) => {
    try {
      const admins = await storage.getBusinessAdmins(req.params.id);
      res.json(admins);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/businesses/:id/admins", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.session.userRole !== "sistemas") {
        return res.status(403).json({ message: "Solo usuarios sistemas pueden asignar administradores" });
      }

      const { adminIds } = req.body;
      if (!Array.isArray(adminIds)) {
        return res.status(400).json({ message: "adminIds debe ser un array" });
      }

      await storage.setBusinessAdmins(req.params.id, adminIds);

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "asignar_admins_negocio",
        "negocio",
        req.params.id,
        `Administradores asignados: ${adminIds.length} admin(es)`
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/businesses/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.session.userRole !== "sistemas") {
        return res.status(403).json({ message: "Solo usuarios sistemas pueden eliminar negocios" });
      }

      const deleted = await storage.deleteBusiness(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Error al eliminar el negocio" });
      }

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "eliminar_negocio",
        "negocio",
        req.params.id,
        "Negocio eliminado"
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/upload/profile", requireAuth, upload.single("image"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ninguna imagen" });
      }

      const imageUrl = `/uploads/${req.file.filename}`;
      const user = await storage.updateUser(req.session.userId!, { profileImageUrl: imageUrl });
      
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "actualizar_perfil",
        "usuario",
        user.id,
        "Foto de perfil actualizada"
      );

      res.json({ imageUrl, user });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/upload/logo", requireAdmin, upload.single("image"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se proporcionó ninguna imagen" });
      }

      const logoUrl = `/uploads/${req.file.filename}`;
      const businessId = req.session.businessId || undefined;
      const settings = await storage.updateCompanySettings({ logoUrl }, businessId);
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "actualizar_logo",
        "configuracion",
        settings.id,
        "Logo de empresa actualizado"
      );

      res.json({ logoUrl, settings });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/branches", requireAuth, async (req: Request, res: Response) => {
    try {
      const businessId = req.query.businessId as string;
      
      if (businessId) {
        const branchesList = await storage.getBranchesForBusiness(businessId);
        return res.json(branchesList);
      }
      
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;
      const branchesList = await storage.getBranchesForUser(userId, userRole);
      res.json(branchesList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/branches/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const branch = await storage.getBranch(req.params.id);
      if (!branch) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      res.json(branch);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/branches", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = insertBranchSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      let businessId: string | undefined = req.body.businessId;
      const userRole = req.session.userRole!;
      const userId = req.session.userId!;

      // Para sistemas, el businessId es requerido en el request
      if (userRole === "sistemas") {
        if (!businessId) {
          return res.status(400).json({ message: "El negocio es requerido" });
        }
      } else if (userRole === "admin") {
        // Para admins, usar el businessId de su sesión
        businessId = req.session.businessId;
        if (!businessId) {
          // Si no hay businessId en sesión, obtenerlo del usuario
          const businesses = await storage.getBusinessesForUser(userId);
          if (businesses.length === 0) {
            return res.status(400).json({ message: "El usuario no tiene negocios asignados" });
          }
          businessId = businesses[0].id;
          req.session.businessId = businessId;
        }
      } else {
        return res.status(403).json({ message: "No tiene permiso para crear sucursales" });
      }

      if (!businessId) {
        return res.status(400).json({ message: "El negocio es requerido" });
      }

      const newBranch = await storage.createBranch({ ...result.data, businessId });
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "crear_sucursal",
        "sucursal",
        newBranch.id,
        `Sucursal creada: ${newBranch.name}`,
        newBranch.businessId
      );
      
      res.status(201).json(newBranch);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/branches/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Sistemas puede editar cualquier sucursal, admins solo las de su negocio
      const existingBranch = await storage.getBranch(req.params.id);
      if (!existingBranch) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      if (req.session.userRole === "admin") {
        const userBusinessId = req.session.businessId;
        if (!userBusinessId || existingBranch.businessId !== userBusinessId) {
          return res.status(403).json({ message: "No tiene permiso para editar esta sucursal" });
        }
      } else if (req.session.userRole !== "sistemas") {
        return res.status(403).json({ message: "No tiene permiso para editar sucursales" });
      }

      const result = updateBranchSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const updatedBranch = await storage.updateBranch(req.params.id, result.data);
      if (!updatedBranch) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "editar_sucursal",
        "sucursal",
        updatedBranch.id,
        `Sucursal editada: ${updatedBranch.name}`
      );

      res.json(updatedBranch);
    } catch (error: any) {
      if (error.message?.includes("duplicate key")) {
        return res.status(400).json({ message: "El número de sucursal ya existe" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/branches/:id/product-count", requireAdmin, async (req: Request, res: Response) => {
    try {
      const products = await storage.getProducts(req.params.id);
      res.json({ count: products.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/branches/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Solo sistemas puede eliminar sucursales
      if (req.session.userRole !== "sistemas") {
        return res.status(403).json({ message: "Solo usuarios sistemas pueden eliminar sucursales" });
      }

      const branchToDelete = await storage.getBranch(req.params.id);
      if (!branchToDelete) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      const products = await storage.getProducts(req.params.id);
      const productCount = products.length;
      const forceDelete = req.query.force === "true";

      if (productCount > 0 && !forceDelete) {
        return res.status(400).json({ 
          message: `La sucursal tiene ${productCount} producto(s). Use force=true para eliminar todo.`,
          productCount,
          requiresConfirmation: true
        });
      }

      if (productCount > 0) {
        for (const product of products) {
          await storage.deleteProduct(product.id, req.params.id);
        }
        
        await createAuditLog(
          req.session.userId!,
          req.session.userName!,
          "eliminar_productos_sucursal",
          "productos",
          req.params.id,
          `Eliminados ${productCount} productos de sucursal: ${branchToDelete.name}`,
          req.params.id
        );
      }

      const deleted = await storage.deleteBranch(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Error al eliminar la sucursal" });
      }
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "eliminar_sucursal",
        "sucursal",
        req.params.id,
        `Sucursal eliminada: ${branchToDelete.name}${productCount > 0 ? ` (con ${productCount} productos)` : ""}`
      );

      res.json({ success: true, deletedProducts: productCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/session/branch", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.body.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Se requiere el ID de la sucursal" });
      }

      const branch = await storage.getBranch(branchId);
      if (!branch) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }

      if (!branch.isActive) {
        return res.status(400).json({ message: "La sucursal no está activa" });
      }

      const canAccess = await storage.canUserAccessBranch(
        req.session.userId!,
        branchId,
        req.session.userRole!
      );

      if (!canAccess) {
        return res.status(403).json({ message: "No tiene acceso a esta sucursal" });
      }

      req.session.branchId = branchId;
      req.session.branchName = branch.name;

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "cambiar_sucursal",
        "sucursal",
        branchId,
        `Cambió a sucursal: ${branch.name}`,
        branchId
      );

      res.json({ 
        businessId: req.session.businessId || null,
        businessName: req.session.businessName || null,
        branchId, 
        branchName: branch.name 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/session/business", requireAuth, async (req: Request, res: Response) => {
    try {
      const businessId = req.body.businessId;
      if (!businessId) {
        return res.status(400).json({ message: "Se requiere el ID del negocio" });
      }

      const userRole = req.session.userRole!;
      const userId = req.session.userId!;
      
      if (userRole === "vendedor") {
        return res.status(403).json({ message: "Los vendedores no pueden cambiar de negocio" });
      }
      
      // Verify access
      const accessible = await storage.getBusinessesForUser(userId, userRole);
      const business = accessible.find(b => b.id === businessId);
      if (!business) {
        return res.status(403).json({ message: "No tiene acceso a este negocio" });
      }

      // Validate business is active
      if (!business.isActive) {
        return res.status(403).json({ message: "Este negocio está deshabilitado" });
      }

      req.session.businessId = businessId;
      req.session.businessName = business.razonSocial;
      req.session.branchId = undefined;
      req.session.branchName = undefined;

      res.json({ businessId, businessName: business.razonSocial });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/session/branch", requireAuth, async (req: Request, res: Response) => {
    try {
      let businessId = req.session.businessId;
      let businessName = req.session.businessName;
      const branchId = req.session.branchId;
      const branchName = req.session.branchName;
      
      if (!businessId && req.session.userRole && req.session.userRole !== "vendedor" && req.session.userRole !== "sistemas") {
        const businesses = await storage.getBusinessesForUser(req.session.userId!, req.session.userRole);
        const active = businesses.filter(b => b.isActive);
        if (active.length > 0) {
          businessId = active[0].id;
          businessName = active[0].razonSocial;
          req.session.businessId = businessId;
          req.session.businessName = businessName;
        }
      }
      
      res.json({ 
        businessId: businessId || null, 
        businessName: businessName || null,
        branchId: branchId || null, 
        branchName: branchName || null 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/branches/:branchId/stocks", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.params.branchId !== req.session.branchId) {
        return res.status(403).json({ message: "No tiene acceso a esta sucursal" });
      }
      const stocks = await storage.getBranchStocks(req.params.branchId);
      res.json(stocks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/branches/:branchId/stocks", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.params.branchId !== req.session.branchId) {
        return res.status(403).json({ message: "No tiene acceso a esta sucursal" });
      }
      
      const result = insertBranchStockSchema.safeParse({
        ...req.body,
        branchId: req.params.branchId,
      });
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const stock = await storage.upsertBranchStock(result.data);
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "actualizar_stock",
        "stock_sucursal",
        stock.id,
        `Stock actualizado para producto en sucursal`,
        req.params.branchId
      );
      
      res.status(201).json(stock);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/branches/:branchId/sale-orders", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.params.branchId !== req.session.branchId) {
        return res.status(403).json({ message: "No tiene acceso a esta sucursal" });
      }
      const orders = await storage.getSaleOrdersByBranch(req.params.branchId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/branches/:branchId/sale-orders", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.params.branchId !== req.session.branchId) {
        return res.status(403).json({ message: "No tiene acceso a esta sucursal" });
      }
      
      const order = await storage.createSaleOrderForBranch({
        ...req.body,
        userId: req.session.userId!,
        branchId: req.params.branchId,
      });
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "crear_venta",
        "orden_venta",
        order.id,
        `Venta creada por $${order.totalAmount}`,
        req.params.branchId
      );
      
      res.status(201).json(order);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/branches/:branchId/audit-logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.params.branchId !== req.session.branchId) {
        return res.status(403).json({ message: "No tiene acceso a esta sucursal" });
      }
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 50));
      const result = await storage.getAuditLogsByBranch(req.params.branchId, offset, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Invitation routes
  app.get("/api/invitations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      if (!businessId) {
        return res.status(400).json({ message: "No hay negocio seleccionado" });
      }
      const invitationsList = await storage.getInvitationsByBusiness(businessId);
      res.json(invitationsList);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/invitations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      if (!businessId) {
        return res.status(400).json({ message: "No hay negocio seleccionado" });
      }

      const schema = insertInvitationSchema.pick({ email: true, role: true, branchId: true });
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await storage.createInvitation({
        ...result.data,
        businessId,
        token,
        expiresAt,
      });

      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "crear_invitacion",
        "invitacion",
        invitation.id,
        `Invitación creada para: ${invitation.email} (${invitation.role})`
      );

      res.status(201).json(invitation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/invitations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      if (!businessId) {
        return res.status(400).json({ message: "No hay negocio seleccionado" });
      }

      // Verify invitation belongs to this business
      const invitations = await storage.getInvitationsByBusiness(businessId);
      const invitation = invitations.find(i => i.id === req.params.id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitación no encontrada" });
      }

      await storage.deleteInvitation(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public invitation accept endpoint (no auth required)
  app.get("/api/invitations/token/:token", async (req: Request, res: Response) => {
    try {
      const invitation = await storage.getInvitationByToken(req.params.token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitación no encontrada o ya utilizada" });
      }
      if (invitation.usedAt) {
        return res.status(400).json({ message: "Esta invitación ya fue utilizada" });
      }
      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Esta invitación ha expirado" });
      }
      
      // Return limited info for display
      const business = await storage.getBusiness(invitation.businessId);
      res.json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        businessId: invitation.businessId,
        businessName: business?.razonSocial || "Empresa",
        branchId: invitation.branchId,
        expiresAt: invitation.expiresAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/invitations/token/:token/accept", async (req: Request, res: Response) => {
    try {
      const invitation = await storage.getInvitationByToken(req.params.token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitación no encontrada" });
      }
      if (invitation.usedAt) {
        return res.status(400).json({ message: "Esta invitación ya fue utilizada" });
      }
      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Esta invitación ha expirado" });
      }

      const { firstName, lastName, password } = req.body;
      if (!firstName || !lastName || !password) {
        return res.status(400).json({ message: "Nombre, apellido y contraseña son requeridos" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
      }

      // Check if user already exists with this email
      const existing = await storage.getUserByEmail(invitation.email);
      let user;
      
      if (existing) {
        // Update existing user (they're accepting an invite to a new business)
        user = existing;
      } else {
        const hashedPassword = await hashPassword(password);
        user = await storage.createUser({
          email: invitation.email,
          firstName,
          lastName,
          password: hashedPassword,
          role: invitation.role as "admin" | "vendedor",
        });
      }

      // Assign branch if specified
      if (invitation.branchId) {
        const currentBranches = await storage.getUserBranches(user.id);
        const branchIds = currentBranches.map(b => b.branchId);
        if (!branchIds.includes(invitation.branchId)) {
          await storage.setUserBranches(user.id, [...branchIds, invitation.branchId]);
        }
      }

      await storage.markInvitationUsed(invitation.id);

      res.json({ success: true, message: "Cuenta creada exitosamente. Puede iniciar sesión." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== PUBLIC PLANS ENDPOINT =====
  app.get("/api/plans", async (req: Request, res: Response) => {
    try {
      const planList = await storage.getPlans(false);
      const allPlanFeatures = await storage.getAllPlanFeatures();

      const result = await Promise.all(planList.map(async (plan) => {
        const pf = allPlanFeatures.filter(f => f.planId === plan.id);
        return { ...plan, features: pf };
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== MY FEATURES ENDPOINT =====
  app.get("/api/my-features", requireAuth, async (req: Request, res: Response) => {
    try {
      const userRole = req.session.userRole!;
      if (userRole === "sistemas") {
        const allFeaturesList = await storage.getFeatures();
        const featMap: Record<string, boolean> = {};
        const limMap: Record<string, number | null> = {};
        for (const f of allFeaturesList) { featMap[f.key] = true; limMap[f.key] = null; }
        return res.json({
          features: featMap, limits: limMap,
          subscription: { status: "active", trialEndsAt: null, graceEndsAt: null, nextPaymentAt: null, planName: "Sistemas" },
        });
      }

      const businessId = req.session.businessId;
      if (!businessId) {
        return res.json({ features: {}, limits: {}, subscription: { status: "trial" } });
      }

      const { features: featMap, limits: limMap } = await getBusinessFeatures(businessId);
      const business = await storage.getBusiness(businessId);
      let planName = business?.plan || "free";
      if (business?.planId) {
        const plan = await storage.getPlan(business.planId);
        if (plan) planName = plan.name;
      }

      res.json({
        features: featMap, limits: limMap,
        subscription: {
          status: business?.subscriptionStatus || "trial",
          trialEndsAt: business?.trialEndsAt,
          graceEndsAt: business?.graceEndsAt,
          nextPaymentAt: business?.nextPaymentAt,
          planName,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== PUBLIC REGISTRATION =====
  app.post("/api/auth/register-business", async (req: Request, res: Response) => {
    try {
      const result = registerBusinessSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const { razonSocial, cuit, encargado, telefono, mail, firstName, lastName, email, password, planSlug } = result.data;

      // Check uniqueness
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) return res.status(400).json({ message: "Ya existe un usuario con ese email" });

      if (cuit) {
        const businesses_list = await storage.getBusinesses(true);
        if (businesses_list.some(b => b.cuit === cuit)) {
          return res.status(400).json({ message: "Ya existe un negocio con ese CUIT" });
        }
      }

      const plan = await storage.getPlanBySlug(planSlug);

      // Create admin user
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email, firstName, lastName, password: hashedPassword, role: "admin", isActive: true,
      });

      // Create business
      const slug = generateSlug(razonSocial);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const business = await storage.createBusiness({
        razonSocial, slug, plan: planSlug, planId: plan?.id || null,
        cuit: cuit || null, encargado: encargado || null, telefono: telefono || null, mail: mail || null,
        adminUserId: user.id,
        subscriptionStatus: planSlug === "free" ? "trial" : "pending",
        trialEndsAt: planSlug === "free" ? trialEndsAt : null,
      } as any);

      // Create first branch
      const branch = await storage.createBranch({
        businessId: business.id, number: 1, name: "Casa Central", address: "A configurar", isActive: true,
      });

      // Assign user to branch
      await storage.setUserBranches(user.id, [branch.id]);

      // Assign as business admin
      await storage.setBusinessAdmins(business.id, [user.id]);

      // Create settings
      await storage.getOrCreateCompanySettings(business.id, razonSocial);

      // Create subscription event
      await storage.createSubscriptionEvent({
        businessId: business.id,
        type: "subscription_created",
        description: `Negocio registrado con plan ${planSlug}`,
      } as any);

      if (planSlug === "free") {
        // Auto login
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = `${user.firstName} ${user.lastName}`;
        req.session.userRole = "admin";
        req.session.businessId = business.id;
        req.session.businessName = business.razonSocial;
        req.session.branchId = branch.id;
        req.session.branchName = branch.name;

        return res.json({ success: true, redirect: "/" });
      }

      // For paid plans, create MP subscription
      try {
        const { createMPSubscription } = await import("./mp-subscriptions");
        const amount = plan ? parseFloat(plan.price) : 0;
        const { checkoutUrl } = await createMPSubscription({
          businessId: business.id, planId: plan?.id || "", payerEmail: email,
          planName: plan?.name || planSlug, amount,
        });
        return res.json({ success: true, checkoutUrl });
      } catch (mpError: any) {
        // If MP is not configured, auto-activate with trial
        await storage.updateBusiness(business.id, { subscriptionStatus: "trial", trialEndsAt } as any);
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = `${user.firstName} ${user.lastName}`;
        req.session.userRole = "admin";
        req.session.businessId = business.id;
        req.session.businessName = business.razonSocial;
        req.session.branchId = branch.id;
        req.session.branchName = branch.name;
        return res.json({ success: true, redirect: "/" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== SUBSCRIPTION ENDPOINTS =====
  app.post("/api/subscription/checkout", requireAuth, requireActiveSubscription, async (req: Request, res: Response) => {
    try {
      if (req.session.userRole !== "admin" && req.session.userRole !== "sistemas") {
        return res.status(403).json({ message: "Sin permiso" });
      }
      const businessId = req.session.businessId;
      if (!businessId) return res.status(400).json({ message: "Sin negocio en sesión" });

      const { planSlug } = req.body;
      const plan = await storage.getPlanBySlug(planSlug);
      if (!plan) return res.status(404).json({ message: "Plan no encontrado" });

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const { isMPConfigured } = await import("./mercadopago");

      if (!isMPConfigured()) {
        // No MP token set: activate directly (dev/demo mode)
        await storage.updateBusiness(businessId, {
          plan: plan.slug, planId: plan.id, subscriptionStatus: "active",
        } as any);
        await storage.createSubscriptionEvent({
          businessId,
          type: "plan_changed",
          description: `Cambio a plan ${plan.name}`,
        });
        return res.json({ activated: true });
      }

      // MP is configured: create real checkout
      await storage.updateBusiness(businessId, { plan: plan.slug, planId: plan.id } as any);
      try {
        const { createMPSubscription } = await import("./mp-subscriptions");
        const { checkoutUrl } = await createMPSubscription({
          businessId, planId: plan.id, payerEmail: user.email,
          planName: plan.name, amount: parseFloat(plan.price),
        });
        res.json({ checkoutUrl });
      } catch (mpError: any) {
        console.error("[MP Checkout Error]", mpError?.message || mpError);
        const detail = mpError?.cause?.message || mpError?.message || "Error al conectar con Mercado Pago";
        res.status(502).json({ message: detail });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/subscription/success", async (req: Request, res: Response) => {
    const businessId = req.query.external_reference as string;
    if (businessId) {
      try {
        const business = await storage.getBusiness(businessId);
        if (business) {
          const now = new Date();
          const nextPaymentAt = new Date(now);
          nextPaymentAt.setMonth(nextPaymentAt.getMonth() + 1);
          await storage.updateBusiness(businessId, {
            subscriptionStatus: "active",
            lastPaymentAt: now,
            nextPaymentAt,
          } as any);
          await storage.createSubscriptionEvent({
            businessId,
            type: "subscription_activated",
            description: `Suscripción activada tras pago aprobado`,
          });
        }
      } catch (e) {
        console.error("[subscription/success]", e);
      }
    }
    res.redirect("/billing?subscribed=1");
  });

  app.get("/api/subscription/failure", async (_req: Request, res: Response) => {
    res.redirect("/billing?payment_failed=1");
  });

  app.get("/api/subscription/pending", async (_req: Request, res: Response) => {
    res.redirect("/billing?payment_pending=1");
  });

  app.get("/api/subscription/portal", requireAuth, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      if (!businessId) return res.status(400).json({ message: "Sin negocio en sesión" });
      const business = await storage.getBusiness(businessId);
      if (!business?.mpSubscriptionId) {
        return res.status(404).json({ message: "Sin suscripción activa en Mercado Pago" });
      }
      const portalUrl = `https://www.mercadopago.com.ar/subscriptions/${business.mpSubscriptionId}`;
      res.json({ portalUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/subscription", requireAuth, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      if (!businessId) return res.status(400).json({ message: "Sin negocio en sesión" });
      const business = await storage.getBusiness(businessId);
      if (!business) return res.status(404).json({ message: "Negocio no encontrado" });

      if (business.mpSubscriptionId) {
        try {
          const { cancelMPSubscription } = await import("./mp-subscriptions");
          await cancelMPSubscription(business.mpSubscriptionId);
        } catch {}
      }

      await storage.updateBusiness(businessId, { subscriptionStatus: "cancelled" } as any);
      await storage.createSubscriptionEvent({
        businessId, type: "subscription_cancelled",
        description: "Suscripción cancelada por el usuario",
      } as any);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== WEBHOOKS =====
  app.post("/api/webhooks/mercadopago", async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-signature"] as string;
      const webhookSecret = process.env.MP_WEBHOOK_SECRET;

      if (webhookSecret && signature) {
        // Verify signature
        const parts = signature.split(",");
        const tsPart = parts.find(p => p.startsWith("ts="));
        const v1Part = parts.find(p => p.startsWith("v1="));
        if (tsPart && v1Part) {
          const ts = tsPart.replace("ts=", "");
          const v1 = v1Part.replace("v1=", "");
          const requestId = req.headers["x-request-id"] as string || "";
          const dataId = req.body?.data?.id || "";
          const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
          const computed = crypto.createHmac("sha256", webhookSecret).update(manifest).digest("hex");
          if (computed !== v1) {
            return res.status(401).json({ message: "Firma inválida" });
          }
        }
      }

      const { processMPWebhook } = await import("./mp-webhooks");
      await processMPWebhook(req.body);
      res.json({ received: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== SUPERADMIN PLAN MANAGEMENT =====
  app.get("/api/admin/plans", requireSistemas, async (req: Request, res: Response) => {
    try {
      const planList = await storage.getPlans(true);
      const allFeaturesList = await storage.getFeatures();
      const allPlanFeatures = await storage.getAllPlanFeatures();
      const allBusinesses = await storage.getBusinesses(true);

      const result = planList.map(plan => {
        const pf = allPlanFeatures.filter(f => f.planId === plan.id);
        const businessCount = allBusinesses.filter(b => b.planId === plan.id || b.plan === plan.slug).length;
        return { ...plan, planFeatures: pf, businessCount };
      });
      res.json({ plans: result, features: allFeaturesList });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/plans/:id", requireSistemas, async (req: Request, res: Response) => {
    try {
      const result = updatePlanSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const plan = await storage.updatePlan(req.params.id, result.data as any);
      if (!plan) return res.status(404).json({ message: "Plan no encontrado" });
      res.json(plan);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/features", requireSistemas, async (req: Request, res: Response) => {
    try {
      res.json(await storage.getFeatures());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/features", requireSistemas, async (req: Request, res: Response) => {
    try {
      const result = insertFeatureSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }
      const feature = await storage.createFeature(result.data);
      // Auto-create disabled entries for all existing plans
      const planList = await storage.getPlans(true);
      await Promise.all(planList.map(p => storage.upsertPlanFeature(p.id, feature.key, false, null)));
      invalidateFeatureCache();
      res.status(201).json(feature);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/plan-features", requireSistemas, async (req: Request, res: Response) => {
    try {
      const { planId, featureKey, enabled, limit } = req.body;
      if (!planId || !featureKey) return res.status(400).json({ message: "planId y featureKey son requeridos" });
      const pf = await storage.upsertPlanFeature(planId, featureKey, enabled ?? true, limit ?? null);
      invalidateFeatureCache();
      res.json(pf);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/businesses/subscriptions", requireSistemas, async (req: Request, res: Response) => {
    try {
      const allBusinesses = await storage.getBusinesses(true);
      const planList = await storage.getPlans(true);
      const result = await Promise.all(allBusinesses.map(async b => {
        const plan = planList.find(p => p.id === b.planId || p.slug === b.plan);
        return { ...b, planName: plan?.name || b.plan };
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/businesses/:id/plan", requireSistemas, async (req: Request, res: Response) => {
    try {
      const { planId } = req.body;
      const plan = await storage.getPlan(planId);
      if (!plan) return res.status(404).json({ message: "Plan no encontrado" });
      const business = await storage.updateBusiness(req.params.id, { plan: plan.slug, planId } as any);
      if (!business) return res.status(404).json({ message: "Negocio no encontrado" });
      await storage.createSubscriptionEvent({
        businessId: req.params.id, type: "plan_changed",
        description: `Plan cambiado a ${plan.name} por sistemas`,
      } as any);
      invalidateFeatureCache(req.params.id);
      res.json(business);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/businesses/:id/subscription", requireSistemas, async (req: Request, res: Response) => {
    try {
      const { subscriptionStatus, gracePeriodDays, isActive } = req.body;
      const updateData: any = {};
      if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
      if (gracePeriodDays !== undefined) updateData.gracePeriodDays = gracePeriodDays;
      if (isActive !== undefined) updateData.isActive = isActive;
      const business = await storage.updateBusiness(req.params.id, updateData);
      if (!business) return res.status(404).json({ message: "Negocio no encontrado" });
      res.json(business);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/businesses/:id/subscription-events", requireSistemas, async (req: Request, res: Response) => {
    try {
      const events = await storage.getSubscriptionEvents(req.params.id);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== SUPERADMIN FEATURE FLAGS =====
  app.get("/api/admin/feature-flags", requireSistemas, async (req: Request, res: Response) => {
    try {
      const allFeaturesList = await db.select().from(featuresFlagsTable);
      const allPlansList = await storage.getPlans(true);
      const allPlanFeaturesList = await storage.getAllPlanFeatures();
      res.json({ features: allFeaturesList, plans: allPlansList, planFeatures: allPlanFeaturesList });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/feature-flags/:key/global", requireSistemas, async (req: Request, res: Response) => {
    try {
      const { enabledGlobally } = req.body;
      if (typeof enabledGlobally !== "boolean") {
        return res.status(400).json({ message: "enabledGlobally debe ser booleano" });
      }
      const [updated] = await db
        .update(featuresFlagsTable)
        .set({ enabledGlobally })
        .where(eq(featuresFlagsTable.key, req.params.key))
        .returning();
      if (!updated) return res.status(404).json({ message: "Feature no encontrada" });
      invalidateFeatureCache();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/feature-flags/:key/plan/:planId", requireSistemas, async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "enabled debe ser booleano" });
      }
      const { key, planId } = req.params;
      const found = (await db.select().from(planFeaturesTable)
        .where(eq(planFeaturesTable.planId, planId))).find(f => f.featureKey === key);
      if (found) {
        await db.update(planFeaturesTable).set({ enabled }).where(eq(planFeaturesTable.id, found.id));
      } else {
        await db.insert(planFeaturesTable).values({ planId, featureKey: key, enabled, limit: null });
      }
      invalidateFeatureCache();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Also expose subscription events for admin of their own business
  app.get("/api/subscription/events", requireAuth, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      if (!businessId) return res.json([]);
      const events = await storage.getSubscriptionEvents(businessId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── MercadoPago Connect OAuth ────────────────────────────────────────────

  // POST /api/mercadopago/connect-manual  — connect MP with a direct access token
  app.post("/api/mercadopago/connect-manual", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.session.userRole;
      if (role !== "admin" && role !== "sistemas") {
        return res.status(403).json({ message: "Solo administradores pueden conectar MercadoPago" });
      }
      const businessId = req.session.businessId;
      if (!businessId) return res.status(400).json({ message: "Sin negocio asociado" });
      const { accessToken, publicKey } = req.body;
      if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
        return res.status(400).json({ message: "El Access Token es requerido" });
      }
      // Validate token by calling MP users/me
      const testRes = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${accessToken.trim()}` },
      });
      if (!testRes.ok) {
        return res.status(400).json({ message: "Access Token inválido. Verificá que sea el token de producción correcto." });
      }
      const userData = await testRes.json() as any;
      await db.update(businessesTable).set({
        mpAccessToken: accessToken.trim(),
        mpRefreshToken: null,
        mpUserId: String(userData.id ?? ""),
        mpPublicKey: publicKey?.trim() ?? null,
        mpConnectedAt: new Date(),
        mpExpiresAt: null,
      }).where(eq(businessesTable.id, businessId));
      res.json({ success: true, mpUserId: String(userData.id ?? "") });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/mercadopago/connect  — returns the MP authorization URL (OAuth flow, requires Marketplace app)
  app.get("/api/mercadopago/connect", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.session.userRole;
      if (role !== "admin" && role !== "sistemas") {
        return res.status(403).json({ message: "Solo administradores pueden conectar MercadoPago" });
      }
      const businessId = req.session.businessId;
      if (!businessId) return res.status(400).json({ message: "Sin negocio asociado" });
      const appId = process.env.MP_APP_ID;
      const redirectUri = process.env.MP_REDIRECT_URI;
      if (!appId || !redirectUri) {
        return res.status(500).json({ message: "MP_APP_ID o MP_REDIRECT_URI no configurados" });
      }
      const authUrl = `https://auth.mercadopago.com/authorization?client_id=${appId}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}&state=${businessId}`;
      res.json({ authUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/mercadopago/callback  — public, receives code + state from MP
  app.get("/api/mercadopago/callback", async (req: Request, res: Response) => {
    const { code, state: businessId } = req.query as Record<string, string>;
    const frontendBase = process.env.MP_BACK_URL || "http://localhost:5000";
    if (!code || !businessId) {
      return res.redirect(`${frontendBase}/settings?mp=error`);
    }
    try {
      const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.MP_APP_ID,
          client_secret: process.env.MP_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: process.env.MP_REDIRECT_URI,
        }),
      });
      if (!tokenRes.ok) {
        console.error("MP token exchange failed:", await tokenRes.text());
        return res.redirect(`${frontendBase}/settings?mp=error`);
      }
      const data = await tokenRes.json() as any;
      const expiresAt = new Date(Date.now() + (data.expires_in ?? 21600) * 1000);
      await db.update(businessesTable).set({
        mpAccessToken: data.access_token,
        mpRefreshToken: data.refresh_token ?? null,
        mpUserId: String(data.user_id ?? ""),
        mpPublicKey: data.public_key ?? null,
        mpConnectedAt: new Date(),
        mpExpiresAt: expiresAt,
      }).where(eq(businessesTable.id, businessId));
      return res.redirect(`${frontendBase}/settings?mp=connected`);
    } catch (error: any) {
      console.error("MP callback error:", error);
      return res.redirect(`${frontendBase}/settings?mp=error`);
    }
  });

  // DELETE /api/mercadopago/disconnect  — clears all MP* fields for the business
  app.delete("/api/mercadopago/disconnect", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.session.userRole;
      if (role !== "admin" && role !== "sistemas") {
        return res.status(403).json({ message: "Solo administradores pueden desconectar MercadoPago" });
      }
      const businessId = req.session.businessId;
      if (!businessId) return res.status(400).json({ message: "Sin negocio asociado" });
      await db.update(businessesTable).set({
        mpAccessToken: null,
        mpRefreshToken: null,
        mpUserId: null,
        mpPublicKey: null,
        mpConnectedAt: null,
        mpExpiresAt: null,
      }).where(eq(businessesTable.id, businessId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/mercadopago/status  — check if business has MP connected (never exposes tokens)
  app.get("/api/mercadopago/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      if (!businessId) return res.json({ connected: false, mpUserId: null, connectedAt: null });
      const status = await getBusinessMPStatus(businessId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── MercadoPago Payments ─────────────────────────────────────────────────

  // POST /api/mercadopago/create-preference
  app.post("/api/mercadopago/create-preference", requireAuth, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      if (!businessId) return res.status(400).json({ message: "Sin negocio asociado" });
      const { items, paymentMethod } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "items es requerido" });
      }
      const mp = await getMPClientForBusiness(businessId);
      const mpItems = items.map((item: any) => ({
        id: item.productId,
        title: item.productTitle,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        currency_id: "ARS",
      }));
      const backUrl = process.env.MP_BACK_URL || "http://localhost:5000";
      if (paymentMethod === "qr") {
        const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.unitPrice) * Number(item.quantity), 0);
        const pref = await mp.preference.create({
          body: {
            items: mpItems,
            payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
            back_urls: { success: `${backUrl}/sales?mp_status=approved`, failure: `${backUrl}/sales?mp_status=rejected` },
            auto_return: "approved",
          },
        });
        return res.json({
          preferenceId: pref.id,
          initPoint: pref.init_point,
          qrData: pref.init_point,
        });
      } else {
        const pref = await mp.preference.create({
          body: {
            items: mpItems,
            payment_methods: {
              excluded_payment_types: paymentMethod === "debito"
                ? [{ id: "credit_card" }, { id: "ticket" }, { id: "atm" }]
                : [{ id: "debit_card" }, { id: "ticket" }, { id: "atm" }],
            },
            back_urls: { success: `${backUrl}/sales?mp_status=approved`, failure: `${backUrl}/sales?mp_status=rejected` },
            auto_return: "approved",
          },
        });
        return res.json({ preferenceId: pref.id, initPoint: pref.init_point });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/mercadopago/payment-status/:paymentId
  app.get("/api/mercadopago/payment-status/:paymentId", requireAuth, async (req: Request, res: Response) => {
    try {
      const businessId = req.session.businessId;
      if (!businessId) return res.status(400).json({ message: "Sin negocio asociado" });
      const mp = await getMPClientForBusiness(businessId);
      const paymentId = req.params.paymentId;
      const isNumeric = /^\d+$/.test(paymentId);
      if (isNumeric) {
        const payment = await mp.payment.get({ id: Number(paymentId) });
        return res.json({ status: payment.status ?? "pending" });
      }
      // Search by preference_id (for QR/preference-based polling)
      const searchRes = await fetch(
        `https://api.mercadopago.com/v1/payments/search?preference_id=${paymentId}&sort=date_created&criteria=desc&range=date_created&limit=1`,
        { headers: { Authorization: `Bearer ${mp.accessToken}` } }
      );
      if (!searchRes.ok) return res.json({ status: "pending" });
      const searchData = await searchRes.json() as any;
      const latest = searchData?.results?.[0];
      res.json({ status: latest?.status ?? "pending" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Transfer Voucher Upload ──────────────────────────────────────────────

  const vouchersDir = path.join(process.cwd(), "public", "vouchers");
  if (!fs.existsSync(vouchersDir)) fs.mkdirSync(vouchersDir, { recursive: true });

  const voucherStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, vouchersDir),
    filename: (_req, file, cb) => {
      const unique = crypto.randomUUID();
      cb(null, unique + path.extname(file.originalname));
    },
  });
  const voucherUpload = multer({
    storage: voucherStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase())
        && /image/.test(file.mimetype);
      cb(null, ok);
    },
  });

  app.post("/api/sale-orders/:orderId/transfer-voucher", requireAuth, voucherUpload.single("image"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No se recibió imagen" });
      const userId = req.session.userId!;
      const branchId = req.session.branchId;
      const [order] = await db.select().from(saleOrdersTable).where(eq(saleOrdersTable.id, req.params.orderId));
      if (!order) return res.status(404).json({ message: "Orden no encontrada" });
      if (branchId && order.branchId !== branchId && req.session.userRole === "vendedor") {
        return res.status(403).json({ message: "Sin permiso para esta orden" });
      }
      const voucherUrl = `/vouchers/${req.file.filename}`;
      await db.update(saleOrdersTable).set({ transferVoucherUrl: voucherUrl }).where(eq(saleOrdersTable.id, req.params.orderId));
      res.json({ voucherUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
