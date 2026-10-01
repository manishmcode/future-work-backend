import cors from "cors";
import express from "express";
import { errorMiddleware } from "./common/middlewares/error.middleware";
import { notFoundMiddleware } from "./common/middlewares/not-found.middleware";
import { sendSuccess } from "./common/utils/api-response";
import { router } from "./routes";


const app = express();

app.use(cors());
// Webhook route needs the raw Buffer body for HMAC signature verification.
// This MUST be registered before express.json() so the body is not pre-parsed.
app.use("/learntech-api/webhooks", express.raw({ type: "application/json" }));
app.use("/learntech-api/transaction-status", express.raw({ type: "application/json" }));
app.use("/learntech-api/status-change", express.raw({ type: "application/json" }));



app.use(express.json());

app.get("/", (_req, res) => {
    sendSuccess(res, "API is running", { service: "learntech-backend" });
});

// Compatibility endpoints for webhook URLs configured directly as root paths.

app.use("/learntech-api", router);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
