import { getMPClient, isMPConfigured } from "./mercadopago";
import { storage } from "./storage";

export async function createMPSubscription(params: {
  businessId: string;
  planId: string;
  payerEmail: string;
  planName: string;
  amount: number;
}): Promise<{ checkoutUrl: string }> {
  if (!isMPConfigured()) {
    throw new Error("Mercado Pago no está configurado. Configure MP_ACCESS_TOKEN.");
  }

  const mp = getMPClient()!;
  const backUrl = process.env.MP_BACK_URL || "http://localhost:5000";

  const response = await mp.preference.create({
    body: {
      items: [
        {
          id: params.planId,
          title: `Suscripción ${params.planName}`,
          quantity: 1,
          unit_price: params.amount,
          currency_id: "ARS",
        },
      ],
      payer: {
        email: params.payerEmail,
      },
      external_reference: params.businessId,
      back_urls: {
        success: `${backUrl}/api/subscription/success`,
        failure: `${backUrl}/api/subscription/failure`,
        pending: `${backUrl}/api/subscription/pending`,
      },
      auto_return: "approved",
      metadata: {
        businessId: params.businessId,
        planId: params.planId,
        planSlug: params.planName,
      },
    },
  });

  const checkoutUrl = response.init_point!;

  await storage.updateBusiness(params.businessId, {
    subscriptionStatus: "pending",
  } as any);

  return { checkoutUrl };
}

export async function cancelMPSubscription(_subscriptionId: string): Promise<void> {
  // Preference-based payments don't have cancellable subscriptions via API
  return;
}
