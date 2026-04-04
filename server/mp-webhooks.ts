import { storage } from "./storage";
import { db } from "./db";
import { businesses, plans } from "@shared/schema";
import { eq } from "drizzle-orm";
import { invalidateFeatureCache } from "./features";

export async function processMPWebhook(event: {
  type: string;
  data?: { id?: string };
  action?: string;
}) {
  const { type, data, action } = event;

  if (type === "payment") {
    const paymentId = data?.id;
    if (!paymentId) return;

    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) return;

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });
    if (!res.ok) return;

    const payment = await res.json();
    const status = payment.status;
    const subscriptionId = payment.metadata?.preapproval_id || payment.external_reference;

    const [business] = await db.select().from(businesses)
      .where(eq(businesses.mpSubscriptionId, subscriptionId));
    if (!business) return;

    if (status === "approved") {
      const now = new Date();
      const nextPaymentAt = new Date(now);
      nextPaymentAt.setDate(nextPaymentAt.getDate() + 30);

      await storage.updateBusiness(business.id, {
        subscriptionStatus: "active",
        lastPaymentAt: now,
        nextPaymentAt,
        graceEndsAt: null,
        mpStatus: "authorized",
      } as any);

      await storage.createSubscriptionEvent({
        businessId: business.id,
        type: "payment_success",
        mpPaymentId: String(paymentId),
        amount: String(payment.transaction_amount),
        description: `Pago aprobado: $${payment.transaction_amount}`,
      } as any);

      // Aplicar downgrade pendiente si existe
      if (business.pendingPlanId) {
        const [pendingPlan] = await db.select().from(plans).where(eq(plans.id, business.pendingPlanId));
        if (pendingPlan) {
          await storage.updateBusiness(business.id, {
            planId: business.pendingPlanId,
            plan: pendingPlan.slug,
            pendingPlanId: null,
          } as any);
          await storage.createSubscriptionEvent({
            businessId: business.id,
            type: "plan_downgrade_applied",
            description: `Plan cambiado a ${pendingPlan.name} al inicio del nuevo ciclo`,
          } as any);
          invalidateFeatureCache(business.id);
        }
      }

    } else if (status === "rejected" || status === "cancelled") {
      if (business.subscriptionStatus !== "grace_period") {
        const graceEnds = new Date();
        graceEnds.setDate(graceEnds.getDate() + (business.gracePeriodDays || 7));

        await storage.updateBusiness(business.id, {
          subscriptionStatus: "grace_period",
          graceEndsAt: graceEnds,
          mpStatus: "paused",
        } as any);

        await storage.createSubscriptionEvent({
          businessId: business.id,
          type: "payment_failed",
          mpPaymentId: String(paymentId),
          description: `Pago rechazado. Período de gracia hasta ${graceEnds.toLocaleDateString("es-AR")}`,
        } as any);

        await storage.createSubscriptionEvent({
          businessId: business.id,
          type: "grace_period_started",
          description: `Período de gracia iniciado: ${business.gracePeriodDays} días`,
        } as any);
      }
    }
  } else if (type === "subscription_preapproval") {
    const subId = data?.id;
    if (!subId) return;

    const [business] = await db.select().from(businesses)
      .where(eq(businesses.mpSubscriptionId, String(subId)));
    if (!business) return;

    if (action === "updated") {
      const mpAccessToken = process.env.MP_ACCESS_TOKEN;
      if (!mpAccessToken) return;

      const res = await fetch(`https://api.mercadopago.com/preapproval/${subId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });
      if (!res.ok) return;
      const sub = await res.json();

      if (sub.status === "cancelled") {
        await storage.updateBusiness(business.id, {
          subscriptionStatus: "cancelled",
          isActive: false,
          mpStatus: "cancelled",
        } as any);
        await storage.createSubscriptionEvent({
          businessId: business.id,
          type: "subscription_cancelled",
          description: "Suscripción cancelada en Mercado Pago",
        } as any);
      } else if (sub.status === "paused") {
        const graceEnds = new Date();
        graceEnds.setDate(graceEnds.getDate() + (business.gracePeriodDays || 7));
        await storage.updateBusiness(business.id, {
          subscriptionStatus: "grace_period",
          graceEndsAt: graceEnds,
          mpStatus: "paused",
        } as any);
      }
    }
  }
}
