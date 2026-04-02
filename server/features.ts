import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { plans, planFeatures, features } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

// In-memory cache: businessId -> { features, limits, cachedAt }
const featureCache = new Map<string, {
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  cachedAt: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateFeatureCache(businessId?: string) {
  if (businessId) {
    featureCache.delete(businessId);
  } else {
    featureCache.clear();
  }
}

export async function getBusinessFeatures(businessId: string): Promise<{
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
}> {
  const cached = featureCache.get(businessId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return { features: cached.features, limits: cached.limits };
  }

  const business = await storage.getBusiness(businessId);
  if (!business) return { features: {}, limits: {} };

  // Get all features from the catalogue
  const allFeatures = await db.select().from(features);

  // If no planId, check plan slug to find the plan
  let planId = business.planId;
  if (!planId && business.plan) {
    const matchedPlan = await db.select().from(plans).where(eq(plans.slug, business.plan)).limit(1);
    if (matchedPlan.length > 0) planId = matchedPlan[0].id;
  }

  if (!planId) {
    // Default: all features disabled
    const featMap: Record<string, boolean> = {};
    const limMap: Record<string, number | null> = {};
    for (const f of allFeatures) {
      featMap[f.key] = false;
      limMap[f.key] = null;
    }
    featureCache.set(businessId, { features: featMap, limits: limMap, cachedAt: Date.now() });
    return { features: featMap, limits: limMap };
  }

  const pFeatures = await db.select().from(planFeatures).where(eq(planFeatures.planId, planId));

  const featMap: Record<string, boolean> = {};
  const limMap: Record<string, number | null> = {};

  // Start with all features as false; respect enabledGlobally
  for (const f of allFeatures) {
    featMap[f.key] = false;
    limMap[f.key] = null;
  }

  // Apply plan features, but gate on enabledGlobally
  const featureGlobalMap = new Map(allFeatures.map(f => [f.key, (f as any).enabledGlobally !== false]));
  for (const pf of pFeatures) {
    const globallyEnabled = featureGlobalMap.get(pf.featureKey) !== false;
    featMap[pf.featureKey] = globallyEnabled && pf.enabled;
    if (pf.limit !== null && pf.limit !== undefined) {
      limMap[pf.featureKey] = pf.limit;
    }
  }

  featureCache.set(businessId, { features: featMap, limits: limMap, cachedAt: Date.now() });
  return { features: featMap, limits: limMap };
}

export async function isFeatureEnabledForBusiness(featureKey: string, businessId: string): Promise<boolean> {
  const { features: featMap } = await getBusinessFeatures(businessId);
  return featMap[featureKey] === true;
}

export async function checkFeatureLimit(
  businessId: string,
  featureKey: string,
  currentCount: number
): Promise<{ allowed: boolean; limit: number | null }> {
  const { limits } = await getBusinessFeatures(businessId);
  const limit = limits[featureKey] ?? null;
  if (limit === null) return { allowed: true, limit: null };
  return { allowed: currentCount < limit, limit };
}

export function requireFeatureMiddleware(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.session.userRole === "sistemas") return next();

    const businessId = req.session.businessId;
    if (!businessId) return res.status(403).json({ message: "Sin negocio en sesión" });

    const business = await storage.getBusiness(businessId);
    if (business?.subscriptionStatus === "suspended") {
      return res.status(402).json({
        message: "Suscripción suspendida. Por favor renovar el plan.",
        code: "SUBSCRIPTION_SUSPENDED",
      });
    }

    const { features: businessFeatures } = await getBusinessFeatures(businessId);
    if (!businessFeatures[featureKey]) {
      return res.status(403).json({
        message: "Esta funcionalidad no está disponible en tu plan actual.",
        code: "FEATURE_NOT_IN_PLAN",
        feature: featureKey,
      });
    }
    next();
  };
}

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (req.session.userRole === "sistemas") return next();

  const businessId = req.session.businessId;
  if (!businessId) return next();

  const business = await storage.getBusiness(businessId);
  if (!business) return next();

  if (business.subscriptionStatus === "suspended") {
    return res.status(402).json({
      message: "Tu suscripción está suspendida. Por favor renovar el plan.",
      code: "SUBSCRIPTION_SUSPENDED",
    });
  }
  next();
}
