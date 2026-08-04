/**
 * 46elks som SmsProvider.
 *
 * Svensk leverantör, svensk datalagring - vilket är skälet att den är
 * vald och inte en global. Uppgifterna i ett aviserings-SMS är sparsamma
 * med flit (se src/lib/notifications/messages.ts), men numret i sig
 * säger att någon har ett ärende hos CLEARANCE, och det är i sammanhanget
 * en uppgift värd att hålla inom EU.
 *
 * Nyckeln ligger i integration_secrets under 'elks46' som
 * "användarnamn:lösenord" - leverantörens API använder HTTP Basic, och
 * valvet lagrar en sträng per leverantör.
 */

import type { SmsProvider, SmsResult } from "./provider";

const ENDPOINT = "https://api.46elks.com/a1/sms";

/**
 * Avsändarnamnet. Alfanumeriskt, högst elva tecken hos operatörerna -
 * längre kapas, och ett kapat avsändarnamn ser ut som skräppost.
 */
export const SENDER = "CLEARANCE";

export const splitCredentials = (secret: string): { user: string; password: string } | null => {
  const at = secret.indexOf(":");
  if (at <= 0 || at === secret.length - 1) return null;
  return { user: secret.slice(0, at), password: secret.slice(at + 1) };
};

export const elksProvider = (secret: string, fetchImpl: typeof fetch = fetch): SmsProvider => {
  const creds = splitCredentials(secret);
  if (!creds) {
    throw new Error('46elks-nyckeln ska vara "användarnamn:lösenord".');
  }
  const auth = Buffer.from(`${creds.user}:${creds.password}`).toString("base64");

  return {
    name: "46elks",
    async send(to: string, body: string): Promise<SmsResult> {
      const res = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Basic ${auth}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ from: SENDER, to, message: body }).toString(),
      });

      if (!res.ok) {
        // Svarstexten med, men klippt: leverantörens felmeddelanden är
        // korta, och en hel HTML-sida i last_error gör driftpanelen
        // oläslig.
        const text = (await res.text().catch(() => "")).slice(0, 300);
        throw new Error(`46elks svarade ${res.status}: ${text}`);
      }

      const json = (await res.json().catch(() => null)) as { id?: string; status?: string } | null;
      if (!json?.id) throw new Error("46elks svarade utan meddelande-id.");
      return { id: json.id };
    },
  };
};
