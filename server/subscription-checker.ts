import { storage } from "./storage";

export async function checkExpiredGracePeriods() {
  try {
    const expired = await storage.getBusinessesWithExpiredGrace();
    for (const business of expired) {
      await storage.updateBusiness(business.id, {
        subscriptionStatus: "suspended",
        isActive: false,
      } as any);
      await storage.createSubscriptionEvent({
        businessId: business.id,
        type: "suspended",
        description: "Cuenta suspendida por vencimiento del período de gracia",
      } as any);
    }
    if (expired.length > 0) {
      console.log(`[subscription-checker] Suspended ${expired.length} business(es) with expired grace period`);
    }
  } catch (err) {
    console.error("[subscription-checker] Error checking expired grace periods:", err);
  }
}
