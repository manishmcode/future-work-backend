import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../../common/middlewares/auth.middleware";
import {
    assignPlanController,
    createPaymentSessionController,
    retryPaymentSessionController,
    validateIbanController,
    submitPaymentController,
    verifyPaymentController,
    getPaymentStatusController,
    getMyCurrentPlanController,
    getMySubscriptionHistoryController,
    unsubscribeController,
} from "./subscription.controller";

const subscriptionRouter = Router();

subscriptionRouter.post("/unsubscribe", unsubscribeController);
subscriptionRouter.post("/validate-iban", optionalAuthMiddleware, validateIbanController);
subscriptionRouter.use(authMiddleware);
subscriptionRouter.post("/assign-plan", assignPlanController);
subscriptionRouter.post("/create-payment-session", createPaymentSessionController);
subscriptionRouter.post("/retry-payment-session", retryPaymentSessionController);
subscriptionRouter.post("/submit-payment", submitPaymentController);
subscriptionRouter.post("/verify-payment", verifyPaymentController);
subscriptionRouter.get("/payment-status/:sessionToken", getPaymentStatusController);
subscriptionRouter.get("/my-plan", getMyCurrentPlanController);
subscriptionRouter.get("/history", getMySubscriptionHistoryController);

export { subscriptionRouter };
