import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware";
import { getUserDashboardController, updateUserProfileController } from "./user.controller";

const userRouter = Router();

userRouter.use(authMiddleware);
userRouter.get("/dashboard", getUserDashboardController);
userRouter.put("/profile", updateUserProfileController);

export { userRouter };
