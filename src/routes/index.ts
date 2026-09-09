import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { libraryRouter } from "../modules/library/library.routes";
import { plansRouter } from "../modules/plans/plans.routes";
import { subscriptionRouter } from "../modules/subscription/subscription.routes";
import { userRouter } from "../modules/user/user.routes";
import { catalystWebhookController } from "../modules/payment/webhook.controller";
import { classesRouter } from "../modules/classes/classes.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/library", libraryRouter);
router.use("/plans", plansRouter);
router.use("/subscriptions", subscriptionRouter);
router.use("/user", userRouter);
router.use("/classes", classesRouter);
router.post("/transaction-status", catalystWebhookController);
router.post("/status-change", catalystWebhookController);
router.post("/order-created", catalystWebhookController);
router.post("/order-status-change", catalystWebhookController);
// CatalystPay webhook – no auth middleware, signature verified inside controller
router.post("/webhooks/catalyst", catalystWebhookController);

export { router };
