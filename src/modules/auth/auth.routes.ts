import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware";
import { changePasswordController, getMeController, loginController, signupController } from "./auth.controller";

const authRouter = Router();

authRouter.post("/signup", signupController);
authRouter.post("/login", loginController);
authRouter.post("/change-password", authMiddleware, changePasswordController);
authRouter.get("/me", authMiddleware, getMeController);

export { authRouter };
