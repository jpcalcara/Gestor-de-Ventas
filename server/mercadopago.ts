import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { db } from "./db";
import { businesses } from "@shared/schema";
import { eq } from "drizzle-orm";

export function getMPClient(): { client: MercadoPagoConfig; preference: Preference } | null {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return null;
  const client = new MercadoPagoConfig({ accessToken });
  return { client, preference: new Preference(client) };
}

export function isMPConfigured(): boolean {
  return !!process.env.MP_ACCESS_TOKEN;
}

export async function getMPClientForBusiness(businessId: string): Promise<{
  client: MercadoPagoConfig;
  preference: Preference;
  payment: Payment;
  accessToken: string;
}> {
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!business) throw new Error("Negocio no encontrado");
  if (!business.mpAccessToken) {
    throw new Error("El negocio no tiene MercadoPago conectado. El administrador debe conectar su cuenta primero.");
  }

  let accessToken = business.mpAccessToken;

  if (business.mpExpiresAt) {
    const expiresAt = new Date(business.mpExpiresAt);
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    if (expiresAt < oneHourFromNow && business.mpRefreshToken) {
      try {
        const refreshRes = await fetch("https://api.mercadopago.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: process.env.MP_APP_ID,
            client_secret: process.env.MP_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: business.mpRefreshToken,
          }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json() as any;
          const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 21600) * 1000);
          await db.update(businesses).set({
            mpAccessToken: data.access_token,
            mpRefreshToken: data.refresh_token ?? business.mpRefreshToken,
            mpExpiresAt: newExpiresAt,
          }).where(eq(businesses.id, businessId));
          accessToken = data.access_token;
        }
      } catch (err) {
        console.error("Error refreshing MP token:", err);
      }
    }
  }

  const client = new MercadoPagoConfig({ accessToken });
  return {
    client,
    preference: new Preference(client),
    payment: new Payment(client),
    accessToken,
  };
}

export async function getBusinessMPStatus(businessId: string): Promise<{
  connected: boolean;
  mpUserId: string | null;
  connectedAt: string | null;
}> {
  const [business] = await db.select({
    mpAccessToken: businesses.mpAccessToken,
    mpUserId: businesses.mpUserId,
    mpConnectedAt: businesses.mpConnectedAt,
  }).from(businesses).where(eq(businesses.id, businessId));

  if (!business || !business.mpAccessToken) {
    return { connected: false, mpUserId: null, connectedAt: null };
  }
  return {
    connected: true,
    mpUserId: business.mpUserId,
    connectedAt: business.mpConnectedAt ? business.mpConnectedAt.toISOString() : null,
  };
}
