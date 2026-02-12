import express from "express";
import {
  addListItem,
  deleteListItem,
  getList,
  patchListItem,
  removeListItemByName
} from "../controllers/listController.js";

const router = express.Router();

router.get("/", getList);
router.post("/add", addListItem);
router.post("/remove-by-name", removeListItemByName);
router.patch("/:id", patchListItem);
router.delete("/:id", deleteListItem);

export default router;


