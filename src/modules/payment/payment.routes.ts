import { Router } from "express";
import { AppError } from "../../common/errors/app-error";
import { sendSuccess } from "../../common/utils/api-response";
import { validateCatalystIban } from "./catalyst.service";

const paymentRouter = Router();

paymentRouter.get("/validate-iban", (_req, res) => {
    sendSuccess(res, "IBAN validation endpoint is available. Submit an IBAN with POST.");
});

paymentRouter.post("/validate-iban", async (req, res, next) => {
    try {
        const iban = typeof req.body?.iban === "string" ? req.body.iban.replace(/\s+/g, "").toUpperCase() : "";

        if (!iban || iban.length < 15 || iban.length > 34 || !/^[A-Z0-9]+$/.test(iban)) {
            throw new AppError("Provide a valid IBAN", 422);
        }

        const result = await validateCatalystIban(iban);
        sendSuccess(res, "IBAN validation completed", {
            valid: result.valid,
            bankName: result.bankName,
            bic: result.bic,
            message: result.error,
        });
    } catch (error) {
        next(error);
    }
});

export { paymentRouter };
