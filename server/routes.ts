import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertSaleSchema, updateSaleSchema, updateCompanySettingsSchema, insertBranchSchema, updateBranchSchema, insertBranchStockSchema, updateUserBranchesSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { registerAuthRoutes, requireAuth, requireAdmin, hashPassword } from "./auth";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

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
  
  app.get("/api/products", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      const products = await storage.getProducts(branchId);
      res.json(products);
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

      const product = await storage.createProduct({ ...result.data, branchId });
      
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

      const product = await storage.updateProduct(req.params.id, result.data, branchId);
      if (!product) {
        return res.status(404).json({ message: "Producto no encontrado en esta sucursal" });
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

  app.get("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "Debe seleccionar una sucursal primero" });
      }
      const sales = await storage.getSalesByBranch(branchId);
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

  app.get("/api/users", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const users = await storage.getUsers();
      const safeUsers = users.map(u => ({
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

  app.get("/api/audit-logs", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/company-settings", async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getCompanySettings();
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

      const settings = await storage.updateCompanySettings(result.data);
      
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
      const settings = await storage.updateCompanySettings({ logoUrl });
      
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
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;
      
      const branchesList = await storage.getBranchesForUser(userId, userRole);
      const branchesWithAdmin = await Promise.all(
        branchesList.map(async (branch) => {
          if (branch.adminUserId) {
            const adminUser = await storage.getUser(branch.adminUserId);
            return {
              ...branch,
              adminUser: adminUser ? {
                id: adminUser.id,
                email: adminUser.email,
                firstName: adminUser.firstName,
                lastName: adminUser.lastName,
                role: adminUser.role,
              } : undefined,
            };
          }
          return branch;
        })
      );
      res.json(branchesWithAdmin);
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
      // Solo sistemas puede crear sucursales
      if (req.session.userRole !== "sistemas") {
        return res.status(403).json({ message: "Solo usuarios sistemas pueden crear sucursales" });
      }

      const result = insertBranchSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const branch = await storage.createBranch(result.data);
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "crear_sucursal",
        "sucursal",
        branch.id,
        `Sucursal creada: ${branch.name}`
      );
      
      res.status(201).json(branch);
    } catch (error: any) {
      if (error.message?.includes("duplicate key")) {
        return res.status(400).json({ message: "El número de sucursal ya existe" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/branches/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Solo sistemas puede editar sucursales
      if (req.session.userRole !== "sistemas") {
        return res.status(403).json({ message: "Solo usuarios sistemas pueden editar sucursales" });
      }

      const result = updateBranchSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const branch = await storage.updateBranch(req.params.id, result.data);
      if (!branch) {
        return res.status(404).json({ message: "Sucursal no encontrada" });
      }
      
      await createAuditLog(
        req.session.userId!,
        req.session.userName!,
        "editar_sucursal",
        "sucursal",
        branch.id,
        `Sucursal editada: ${branch.name}`
      );

      res.json(branch);
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

      res.json({ branchId, branchName: branch.name });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/session/branch", requireAuth, async (req: Request, res: Response) => {
    try {
      const branchId = req.session.branchId;
      const branchName = req.session.branchName;
      
      if (!branchId) {
        return res.json({ branchId: null, branchName: null });
      }

      res.json({ branchId, branchName });
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
      const logs = await storage.getAuditLogsByBranch(req.params.branchId);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
