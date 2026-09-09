import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { AppError } from "../errors/app-error";

function validateSmtpConfig(): void {
    if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM) {
        throw new AppError(
            "SMTP configuration is missing. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM",
            500,
        );
    }
}

export async function sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
}): Promise<void> {
    validateSmtpConfig();

    console.log("[mailer] Sending email", {
        to: params.to,
        subject: params.subject,
        smtp_host: env.SMTP_HOST,
        smtp_port: env.SMTP_PORT,
        mail_from: env.MAIL_FROM,
    });

    const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE ?? true,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const fromName = env.MAIL_FROM_NAME?.trim();
    const fromAddress = fromName ? `${fromName} <${env.MAIL_FROM}>` : env.MAIL_FROM;

    try {
        const info = await transporter.sendMail({
            from: fromAddress,
            to: params.to,
            subject: params.subject,
            text: params.text,
            html: params.html,
        });

        console.log("[mailer] Email sent successfully", {
            to: params.to,
            subject: params.subject,
            message_id: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response,
        });
    } catch (error) {
        console.error("[mailer] Failed to send email", {
            to: params.to,
            subject: params.subject,
            error,
        });

        throw error;
    }
}
