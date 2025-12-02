import { storage } from "./storage";
import { hashPassword } from "./auth";
import { log } from "./vite";

export async function bootstrapAdmin() {
  try {
    const sistemasEmail = "sistemas@jota.com";
    const sistemasPassword = "Sistemas123!";
    
    const existingSistemas = await storage.getUserByEmail(sistemasEmail);
    
    if (!existingSistemas) {
      const hashedPassword = await hashPassword(sistemasPassword);
      
      await storage.createUser({
        email: sistemasEmail,
        password: hashedPassword,
        firstName: "Usuario",
        lastName: "Sistemas",
        role: "sistemas",
        isActive: true,
      });
      
      log(`[Bootstrap] Default sistemas user created: ${sistemasEmail}`);
      log(`[Bootstrap] Default password: ${sistemasPassword}`);
      log(`[Bootstrap] IMPORTANT: Change the sistemas password after first login!`);
    } else if (existingSistemas.role !== "sistemas") {
      await storage.updateUser(existingSistemas.id, { role: "sistemas" });
      log(`[Bootstrap] Updated ${sistemasEmail} role to sistemas`);
    }

    const adminEmail = process.env.ADMIN_EMAIL || "admin@inventory.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminFirstName = process.env.ADMIN_FIRST_NAME || "Admin";
    const adminLastName = process.env.ADMIN_LAST_NAME || "User";

    const existingAdmin = await storage.getUserByEmail(adminEmail);
    
    if (!existingAdmin) {
      const hashedPassword = await hashPassword(adminPassword);
      
      await storage.createUser({
        email: adminEmail,
        password: hashedPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: "admin",
        avatar: "default",
      });
      
      log(`[Bootstrap] Default admin user created: ${adminEmail}`);
      log(`[Bootstrap] Default password: ${adminPassword}`);
      log(`[Bootstrap] IMPORTANT: Change the admin password after first login!`);
    }
  } catch (error: any) {
    log(`[Bootstrap] Error creating default users: ${error.message}`);
  }
}
