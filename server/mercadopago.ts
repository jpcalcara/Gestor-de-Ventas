import { MercadoPagoConfig, Preference } from "mercadopago";

const accessToken = process.env.MP_ACCESS_TOKEN;

let client: MercadoPagoConfig | null = null;
let preferenceInstance: Preference | null = null;

export function getMPClient(): { client: MercadoPagoConfig; preference: Preference } | null {
  if (!accessToken) return null;
  if (!client) {
    client = new MercadoPagoConfig({ accessToken });
    preferenceInstance = new Preference(client);
  }
  return { client, preference: preferenceInstance! };
}

export function isMPConfigured(): boolean {
  return !!accessToken;
}
