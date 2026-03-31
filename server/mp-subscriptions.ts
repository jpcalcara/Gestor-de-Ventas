import { getMPClient, isMPConfigured } from "./mercadopago";
import { storage } from "./storage";

export async function createMPSubscription(params: {
  businessId: string;
  planId: string;
  payerEmail: string;
  planName: string;
  amount: number;
}): Promise<{ subscriptionId: string; checkoutUrl: string }> {
  if (!isMPConfigured()) {
    throw new Error("Mercado Pago no está configurado. Configure MP_ACCESS_TOKEN.");
  }

  const mp = getMPClient()!;
  const backUrl = process.env.MP_BACK_URL || "http://localhost:5000";

  const response = await mp.preApproval.create({
    body: {
      reason: `Suscripción ${planName}`,
      external_reference: params.businessId,
      payer_email: params.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: params.amount,
        currency_id: "ARS",
      },
      back_url: `${backUrl}/subscription/success`,
      status: "pending",
    },
  });

  const subscriptionId = response.id!;
  const checkoutUrl = response.init_point!;

  // Save mpSubscriptionId and mpPayerId to business
  await storage.updateBusiness(params.businessId, {
    mpSubscriptionId: subscriptionId,
    subscriptionStatus: "pending",
  } as any);

  return { subscriptionId, checkoutUrl };
}

export async function cancelMPSubscription(subscriptionId: string): Promise<void> {
  if (!isMPConfigured()) return;
  const mp = getMPClient()!;
  await mp.preApproval.update({
    id: subscriptionId,
    body: { status: "cancelled" },
  });
}
