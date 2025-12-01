import { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";

declare module "express-session" {
  interface SessionData {
    userId: string;
    userEmail: string;
    userName: string;
    userRole: string;
    branchId: string;
    branchName: string;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "No autenticado" });
  }
  
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Sesión inválida" });
  }
  
  req.session.userRole = user.role;
  req.session.userName = `${user.firstName} ${user.lastName}`;
  
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "No autenticado" });
  }
  
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Sesión inválida" });
  }
  
  if (user.role !== "admin") {
    return res.status(403).json({ message: "Acceso denegado. Se requiere rol de administrador" });
  }
  
  req.session.userRole = user.role;
  req.session.userName = `${user.firstName} ${user.lastName}`;
  
  next();
}

export function registerAuthRoutes(app: any) {
  app.post("/api/auth/register", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      if (!result.data.password && !result.data.googleId) {
        return res.status(400).json({ message: "La contraseña es requerida (Google OAuth no está disponible aún)" });
      }

      const existing = await storage.getUserByEmail(result.data.email);
      if (existing) {
        return res.status(400).json({ message: "El email ya está registrado" });
      }

      const userData = {
        ...result.data,
        password: result.data.password ? await hashPassword(result.data.password) : undefined,
      };

      const user = await storage.createUser(userData);
      
      res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email y contraseña son requeridos" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userName = `${user.firstName} ${user.lastName}`;
      req.session.userRole = user.role;

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { avatar, password } = req.body;
      const updates: any = {};

      if (avatar) {
        updates.avatar = avatar;
      }

      if (password) {
        if (password.length < 6) {
          return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
        }
        updates.password = await hashPassword(password);
      }

      const user = await storage.updateUser(req.session.userId!, updates);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
