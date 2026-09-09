import { Router } from "express";
import { adminMiddleware, authMiddleware } from "../../common/middlewares/auth.middleware";
import {
    createClassController,
    createClassJoinController,
    deleteClassController,
    getClassesController,
    redirectClassJoinController,
    updateClassController,
} from "./classes.controller";

const classesRouter = Router();

classesRouter.get("/:id/join/:token", redirectClassJoinController);
classesRouter.use(authMiddleware);
classesRouter.get("/", getClassesController);
classesRouter.post("/:id/join", createClassJoinController);
classesRouter.post("/", adminMiddleware, createClassController);
classesRouter.put("/:id", adminMiddleware, updateClassController);
classesRouter.delete("/:id", adminMiddleware, deleteClassController);

export { classesRouter };
