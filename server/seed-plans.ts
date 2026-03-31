import { db } from "./db";
import { plans, features, planFeatures } from "@shared/schema";
import { eq, count } from "drizzle-orm";

export async function seedPlansAndFeatures() {
  const existingPlans = await db.select({ count: count() }).from(plans);
  if (existingPlans[0].count > 0) return;

  console.log("[seed] Creating plans and features...");

  // Create plans
  const [freePlan, starterPlan, proPlan] = await db.insert(plans).values([
    { name: "Free", slug: "free", description: "Para empezar sin costo", price: "0", sortOrder: 1, isActive: true },
    { name: "Starter", slug: "starter", description: "Para negocios en crecimiento", price: "15000", sortOrder: 2, isActive: true },
    { name: "Pro", slug: "pro", description: "Para negocios consolidados", price: "35000", sortOrder: 3, isActive: true },
  ]).returning();

  // Create features
  const featureList = [
    { key: "multisucursal", name: "Múltiples sucursales", description: "Gestionar más de una sucursal", category: "usuarios" },
    { key: "usuarios_ilimitados", name: "Usuarios ilimitados", description: "Sin límite de usuarios en el sistema", category: "usuarios" },
    { key: "reportes_basicos", name: "Reportes de ventas", description: "Reportes básicos de ventas", category: "reportes" },
    { key: "reportes_avanzados", name: "Reportes avanzados", description: "Análisis avanzado de ventas y stock", category: "reportes" },
    { key: "exportar_excel", name: "Exportar a Excel", description: "Exportar datos a formato Excel/CSV", category: "reportes" },
    { key: "auditoria", name: "Log de auditoría", description: "Historial completo de acciones del sistema", category: "seguridad" },
    { key: "invitaciones", name: "Invitar usuarios", description: "Enviar invitaciones por email a nuevos usuarios", category: "usuarios" },
    { key: "qr_cobros", name: "QR de cobros", description: "Generar QR para cobros con Mercado Pago", category: "integraciones" },
  ];

  await db.insert(features).values(featureList);

  // Assign features per plan
  const planFeatureMatrix = [
    // Free: 1 branch, 2 users, only basic reports
    { planId: freePlan.id, featureKey: "multisucursal", enabled: false, limit: 1 },
    { planId: freePlan.id, featureKey: "usuarios_ilimitados", enabled: false, limit: 2 },
    { planId: freePlan.id, featureKey: "reportes_basicos", enabled: true, limit: null },
    { planId: freePlan.id, featureKey: "reportes_avanzados", enabled: false, limit: null },
    { planId: freePlan.id, featureKey: "exportar_excel", enabled: false, limit: null },
    { planId: freePlan.id, featureKey: "auditoria", enabled: false, limit: null },
    { planId: freePlan.id, featureKey: "invitaciones", enabled: false, limit: null },
    { planId: freePlan.id, featureKey: "qr_cobros", enabled: false, limit: null },
    // Starter: 3 branches, 10 users
    { planId: starterPlan.id, featureKey: "multisucursal", enabled: true, limit: 3 },
    { planId: starterPlan.id, featureKey: "usuarios_ilimitados", enabled: false, limit: 10 },
    { planId: starterPlan.id, featureKey: "reportes_basicos", enabled: true, limit: null },
    { planId: starterPlan.id, featureKey: "reportes_avanzados", enabled: true, limit: null },
    { planId: starterPlan.id, featureKey: "exportar_excel", enabled: true, limit: null },
    { planId: starterPlan.id, featureKey: "auditoria", enabled: true, limit: null },
    { planId: starterPlan.id, featureKey: "invitaciones", enabled: true, limit: null },
    { planId: starterPlan.id, featureKey: "qr_cobros", enabled: false, limit: null },
    // Pro: unlimited
    { planId: proPlan.id, featureKey: "multisucursal", enabled: true, limit: null },
    { planId: proPlan.id, featureKey: "usuarios_ilimitados", enabled: true, limit: null },
    { planId: proPlan.id, featureKey: "reportes_basicos", enabled: true, limit: null },
    { planId: proPlan.id, featureKey: "reportes_avanzados", enabled: true, limit: null },
    { planId: proPlan.id, featureKey: "exportar_excel", enabled: true, limit: null },
    { planId: proPlan.id, featureKey: "auditoria", enabled: true, limit: null },
    { planId: proPlan.id, featureKey: "invitaciones", enabled: true, limit: null },
    { planId: proPlan.id, featureKey: "qr_cobros", enabled: true, limit: null },
  ];

  await db.insert(planFeatures).values(planFeatureMatrix);

  console.log("[seed] Plans and features created successfully.");
}
