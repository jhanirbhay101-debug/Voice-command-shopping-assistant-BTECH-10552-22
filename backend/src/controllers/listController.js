import {
  addItem,
  listItems,
  removeItemById,
  removeItemByName,
  updateItem
} from "../services/storeService.js";
import { findBestCatalogMatch } from "../services/catalogService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getList = asyncHandler(async (req, res) => {
  const items = await listItems();
  res.json({ list: items });
});

export const addListItem = asyncHandler(async (req, res) => {
  const { name, brand, quantity, unit, size } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Item name is required");
  }

  const hit = findBestCatalogMatch({ name, brand, size });
  if (!hit) {
    res.status(404);
    throw new Error(`Item "${name}" was not found in catalog stock`);
  }

  if (!hit.inStock) {
    res.status(409);
    throw new Error(`"${hit.name}" is currently out of stock`);
  }

  const items = await addItem({ name, brand, quantity, unit, size, mode: "increment" });
  res.status(201).json({ message: "Item added", list: items });
});

export const removeListItemByName = asyncHandler(async (req, res) => {
  const { name, brand, quantity, unit } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Item name is required");
  }

  const out = await removeItemByName({ name, brand, quantity, unit });
  res.json({
    message: out.removed ? "Item removed" : "Item not found",
    list: out.list
  });
});

export const patchListItem = asyncHandler(async (req, res) => {
  const item = await updateItem(req.params.id, req.body);
  if (!item) {
    res.status(404);
    throw new Error("Item not found");
  }
  res.json({ message: "Item updated", item });
});

export const deleteListItem = asyncHandler(async (req, res) => {
  const removed = await removeItemById(req.params.id);
  if (!removed) {
    res.status(404);
    throw new Error("Item not found");
  }
  res.json({ message: "Item deleted" });
});

