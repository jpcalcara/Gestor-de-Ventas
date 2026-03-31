import { MercadoPagoConfig, PreApproval } from "mercadopago";

const accessToken = process.env.MP_ACCESS_TOKEN;

let client: MercadoPagoConfig | null = null;
let preApprovalInstance: PreApproval | null = null;

export function getMPClient(): { client: MercadoPagoConfig; preApproval: PreApproval } | null {
  if (!accessToken) return null;
  if (!client) {
    client = new MercadoPagoConfig({ accessToken });
    preApprovalInstance = new PreApproval(client);
  }
  return { client, preApproval: preApprovalInstance! };
}

export function isMPConfigured(): boolean {
  return !!accessToken;
}
