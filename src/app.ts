import cors from "cors";
import express from "express";
import { errorMiddleware } from "./common/middlewares/error.middleware";
import { authMiddleware } from "./common/middlewares/auth.middleware";
import { notFoundMiddleware } from "./common/middlewares/not-found.middleware";
import { sendSuccess } from "./common/utils/api-response";
import { getSignedLibraryAssetController } from "./modules/library/library.controller";
import { router } from "./routes";


const app = express();

app.use(cors());
// Webhook route needs the raw Buffer body for HMAC signature verification.
// This MUST be registered before express.json() so the body is not pre-parsed.
app.use("/future-work-api/webhooks", express.raw({ type: "application/json" }));
app.use("/future-work-api/transaction-status", express.raw({ type: "application/json" }));
app.use("/future-work-api/status-change", express.raw({ type: "application/json" }));



app.use(express.json());

app.get("/", (_req, res) => {
    sendSuccess(res, "API is running", { service: "future-work-backend" });
});

app.get(
    ["/v/:token", "/future-work-api/v/:token"],
    authMiddleware,
    getSignedLibraryAssetController
);
// Compatibility endpoints for webhook URLs configured directly as root paths.

app.use("/future-work-api", router);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
