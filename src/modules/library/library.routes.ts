import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware";
import {
    getLibraryCategoriesController,
    getLibraryController,
    getPaginatedLibraryItemsController,
    importEbooksController,
} from "./library.controller";

const libraryRouter = Router();

libraryRouter.use(authMiddleware);
libraryRouter.get("/", getLibraryController);
libraryRouter.get("/categories", getLibraryCategoriesController);
libraryRouter.get("/items", getPaginatedLibraryItemsController);
libraryRouter.post("/import-ebooks",importEbooksController);

export { libraryRouter };
