import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware";
import { createPlanController, getPlansController, updatePlanController } from "./plans.controller";

const plansRouter = Router();

plansRouter.get("/", getPlansController);
plansRouter.post("/", authMiddleware, createPlanController);
plansRouter.put("/:id", authMiddleware, updatePlanController);

export { plansRouter };
