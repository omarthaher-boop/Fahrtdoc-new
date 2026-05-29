import nodemailer from "nodemailer";
import { logger } from "./logger";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = "FahrtDoc <noreply@fahrtdoc.app>",
} = process.env;

const hasSmtp = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export async function sendEmailChangeCode(to: string, code: string, newEmail: string): Promise<void> {
  if (!transporter) {
    logger.warn(
      { email: to, code, newEmail },
      "SMTP nicht konfiguriert – E-Mail-Änderungs-Code wird nur geloggt (nur Entwicklung)"
    );
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    replyTo: SMTP_FROM,
    to,
    subject: "FahrtDoc – E-Mail-Adresse ändern",
    text: `Dein Bestätigungscode für die E-Mail-Änderung lautet: ${code}\n\nNeue E-Mail-Adresse: ${newEmail}\n\nDer Code ist 5 Minuten gültig und kann nur einmal verwendet werden.`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:420px;margin:0 auto">
        <div style="background:#0070D8;padding:24px 24px 16px;border-radius:16px 16px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">FahrtDoc</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">E-Mail-Adresse ändern</p>
        </div>
        <div style="background:#fff;padding:28px 24px;border-radius:0 0 16px 16px;border:1px solid #E5E9F0;border-top:none">
          <p style="margin:0 0 8px;color:#0F1419;font-size:15px">Dein Bestätigungscode:</p>
          <div style="font-size:38px;font-weight:800;letter-spacing:10px;padding:20px;background:#EEF6FF;border-radius:12px;text-align:center;color:#0070D8;font-variant-numeric:tabular-nums">
            ${code}
          </div>
          <p style="margin:16px 0 4px;color:#0F1419;font-size:13px">Neue E-Mail-Adresse: <strong>${newEmail}</strong></p>
          <p style="margin:12px 0 0;color:#8B92A3;font-size:13px;line-height:1.5">
            Dieser Code ist <strong>5 Minuten</strong> gültig und kann nur einmal verwendet werden.<br>
            Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordChangeCode(to: string, code: string): Promise<void> {
  if (!transporter) {
    logger.warn(
      { email: to, code },
      "SMTP nicht konfiguriert – Code wird nur geloggt (nur Entwicklung)"
    );
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    replyTo: SMTP_FROM,
    to,
    subject: "FahrtDoc – Dein Bestätigungscode",
    text: `Dein Bestätigungscode lautet: ${code}\n\nDer Code ist 5 Minuten gültig und kann nur einmal verwendet werden.`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:420px;margin:0 auto">
        <div style="background:#0070D8;padding:24px 24px 16px;border-radius:16px 16px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">FahrtDoc</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Passwort ändern</p>
        </div>
        <div style="background:#fff;padding:28px 24px;border-radius:0 0 16px 16px;border:1px solid #E5E9F0;border-top:none">
          <p style="margin:0 0 20px;color:#0F1419;font-size:15px">Dein Bestätigungscode:</p>
          <div style="font-size:38px;font-weight:800;letter-spacing:10px;padding:20px;background:#EEF6FF;border-radius:12px;text-align:center;color:#0070D8;font-variant-numeric:tabular-nums">
            ${code}
          </div>
          <p style="margin:20px 0 0;color:#8B92A3;font-size:13px;line-height:1.5">
            Dieser Code ist <strong>5 Minuten</strong> gültig und kann nur einmal verwendet werden.<br>
            Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.
          </p>
        </div>
      </div>
    `,
  });
}
