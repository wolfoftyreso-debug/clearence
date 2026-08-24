/**
 * MEJLTRANSPORTEN: SES eller SMTP, valt med MAIL_TRANSPORT.
 *
 * AWS SES fungerar inte i ett helt egenhostat kluster. Därför en transport
 * till: vanlig SMTP (nodemailer), som varje egen mejlrelä talar. Valet är en
 * driftparameter, inte en kodgren man byter i källan:
 *
 *   MAIL_TRANSPORT=smtp   (standard)  -> SMTP. SMTP_HOST/PORT/USER/PASS/SECURE.
 *   MAIL_TRANSPORT=ses                -> SES. SES_REGION styr. Kräver att
 *                                        @aws-sdk/client-ses är installerat
 *                                        och att AWS-uppgifter finns i miljön.
 *
 * STANDARDEN ÄR SMTP, INTE SES, och det är ett byte som gjordes när driften
 * flyttade till Vercel. SES var rätt standard i ett AWS-kluster där rollen
 * redan fanns. På Vercel finns ingen AWS-roll, och @aws-sdk/client-ses är
 * inte ens ett beroende - en SES-standard hade betytt att utkorgen kraschar
 * på första mejlet i en helt normal installation. En standard ska vara det
 * som fungerar utan extra steg.
 *
 * `resolveMailConfig` är REN och prövad: den läser miljön och säger vilken
 * transport som gäller och med vilka värden, utan att röra nätet. Själva
 * sändaren byggs av `makeMailSender`, och nodemailer laddas LAT (dynamisk
 * import) bara när smtp valts - en SES-drift behöver aldrig ens ha paketet.
 */

/**
 * Formen på den valfria SES-modulen.
 *
 * Skriven här i stället för importerad: paketet är inte ett beroende, och
 * `import type` från något som inte finns installerat gör typkontrollen
 * röd i varje installation som inte kör SES.
 */
interface SesModul {
  SESClient: new (opt: { region: string }) => { send: (kommando: unknown) => Promise<unknown> };
  SendEmailCommand: new (indata: unknown) => unknown;
}

export interface EmailPayload {
  recipient: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

export type MailSender = (payload: EmailPayload) => Promise<void>;

export type MailConfig =
  | { kind: "ses"; from: string; region: string }
  | {
      kind: "smtp";
      from: string;
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
    };

/** Läser miljön och bestämmer transporten. Ren - inga sidoeffekter. */
export const resolveMailConfig = (env: NodeJS.ProcessEnv): MailConfig => {
  const from = (env.MAIL_FROM ?? "").trim();
  const transport = (env.MAIL_TRANSPORT ?? "smtp").trim().toLowerCase();

  if (transport === "smtp") {
    const host = (env.SMTP_HOST ?? "").trim();
    if (!host) {
      throw new Error("MAIL_TRANSPORT=smtp kräver SMTP_HOST.");
    }
    const port = Number(env.SMTP_PORT ?? "587");
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error("SMTP_PORT måste vara ett positivt tal.");
    }
    // 465 är implicit TLS; annars STARTTLS om inte annat sägs.
    const secure = (env.SMTP_SECURE ?? (port === 465 ? "true" : "false")).trim().toLowerCase() === "true";
    const user = (env.SMTP_USER ?? "").trim();
    return {
      kind: "smtp",
      from,
      host,
      port,
      secure,
      user: user.length > 0 ? user : undefined,
      pass: user.length > 0 ? (env.SMTP_PASS ?? "") : undefined,
    };
  }

  return { kind: "ses", from, region: (env.SES_REGION ?? "eu-north-1").trim() };
};

/**
 * Bygger sändaren. SES-vägen konstruerar SES-klienten (creds i miljön/rollen);
 * SMTP-vägen laddar nodemailer LAT och öppnar en transport. Returnerar en
 * enda funktion så anroparen inte behöver veta vilken väg som gäller.
 */
export const makeMailSender = async (config: MailConfig): Promise<MailSender> => {
  if (config.kind === "smtp") {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
    return async (payload) => {
      await transport.sendMail({
        from: config.from,
        to: payload.recipient,
        subject: payload.subject,
        text: payload.bodyText,
        html: payload.bodyHtml,
      });
    };
  }

  /*
   * IMPORTEN GÅR VIA EN VARIABEL MED FLIT.
   *
   * @aws-sdk/client-ses är inget beroende i package.json - det är valfritt,
   * för den som kör mot SES. Ett bokstavligt `import("@aws-sdk/client-ses")`
   * hade buntaren löst upp vid BYGGET, och Vercel-bygget hade fallit på ett
   * paket som en SMTP-drift aldrig behöver.
   *
   * Priset är att felet flyttar till körtiden. Därför fångas det och
   * översätts till ett besked som säger vad som ska göras.
   */
  const paket = "@aws-sdk/client-ses";
  let modul: SesModul;
  try {
    modul = (await import(/* @vite-ignore */ paket)) as SesModul;
  } catch {
    throw new Error(
      `MAIL_TRANSPORT=ses kräver att ${paket} är installerat. ` +
        "Kör `npm install @aws-sdk/client-ses`, eller sätt MAIL_TRANSPORT=smtp.",
    );
  }
  const { SESClient, SendEmailCommand } = modul;
  const ses = new SESClient({ region: config.region });
  return async (payload) => {
    await ses.send(
      new SendEmailCommand({
        Source: config.from,
        Destination: { ToAddresses: [payload.recipient] },
        Message: {
          Subject: { Data: payload.subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: payload.bodyText, Charset: "UTF-8" },
            Html: { Data: payload.bodyHtml, Charset: "UTF-8" },
          },
        },
      }),
    );
  };
};
