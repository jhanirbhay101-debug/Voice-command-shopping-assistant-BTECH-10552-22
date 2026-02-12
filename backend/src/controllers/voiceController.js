import { parseVoiceCommandSmart } from "../services/nlpService.js";
import {
  addItem,
  listItems,
  getHistoryAndPreferences,
  removeItemByName,
  setItemQuantityByName
} from "../services/storeService.js";
import { searchCatalog } from "../services/searchService.js";
import {
  buildSubstituteProposal,
  consumeSubstituteConfirmation,
  createSubstituteConfirmation,
  rejectSubstituteConfirmation
} from "../services/substituteService.js";
import {
  buildBrandSelectionProposal,
  consumeBrandSelectionConfirmation,
  createBrandSelectionConfirmation,
  rejectBrandSelectionConfirmation
} from "../services/brandSelectionService.js";
import { findBestCatalogMatch } from "../services/catalogService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const buildSubstitutePrompt = (plan) =>
  `${plan.requestedItem.name} is currently unavailable. I found ${plan.options?.length || 1} alternative option(s). Do you want to add ${plan.suggestedAlternative.name} by ${plan.suggestedAlternative.brand}, or pick another alternative?`;

const processAddOrUpdateAction = async ({ parsed, mode }) => {
  const { preferences: prefs } = await getHistoryAndPreferences();
  const bestHit = findBestCatalogMatch({
    name: parsed.item,
    brand: parsed.brand,
    size: parsed.size
  });

  const subPlan = buildSubstituteProposal({
    item: parsed.item,
    brand: parsed.brand,
    size: parsed.size,
    quantity: parsed.quantity,
    unit: parsed.unit,
    mode,
    preferences: prefs
  });

  if (subPlan) {
    const confirmBox = createSubstituteConfirmation(subPlan);
    return {
      status: 202,
      body: {
        action: parsed.action,
        requiresConfirmation: true,
        message: buildSubstitutePrompt(subPlan),
        confirmation: confirmBox,
        parsed
      }
    };
  }

  if (!bestHit) {
    const list = await listItems();
    return {
      status: 200,
      body: {
        action: parsed.action,
        rejected: true,
        message: `Item "${parsed.item}" was not found in catalog stock. Try another item or brand.`,
        list,
        parsed
      }
    };
  }

  if (!bestHit.inStock) {
    const list = await listItems();
    return {
      status: 200,
      body: {
        action: parsed.action,
        rejected: true,
        message: `"${bestHit.name}" is currently out of stock and no suitable alternatives were found.`,
        list,
        parsed
      }
    };
  }

  const itemName = bestHit.name || parsed.item;
  const brandName = bestHit.brand || parsed.brand;
  const brandTag = brandName ? ` (${brandName})` : "";

  if (mode === "set") {
    const result = await setItemQuantityByName({
      name: parsed.item,
      brand: parsed.brand,
      quantity: parsed.quantity,
      unit: parsed.unit,
      size: parsed.size
    });

    return {
      status: 200,
      body: {
        action: parsed.action,
        message: result.created
          ? `Added ${itemName}${brandTag} with quantity ${parsed.quantity}`
          : `Updated ${itemName}${brandTag} quantity to ${parsed.quantity}`,
        list: result.list,
        parsed
      }
    };
  }

  const list = await addItem({
    name: parsed.item,
    brand: parsed.brand,
    quantity: parsed.quantity,
    unit: parsed.unit,
    size: parsed.size,
    mode: "increment"
  });

  return {
    status: 201,
    body: {
      action: parsed.action,
      message: `Added ${parsed.quantity} ${parsed.unit} of ${itemName}${brandTag}`,
      list,
      parsed
    }
  };
};

export const parseVoice = asyncHandler(async (req, res) => {
  const { transcript, language } = req.body;
  const parsed = await parseVoiceCommandSmart(transcript, language);
  res.json(parsed);
});

export const executeVoice = asyncHandler(async (req, res) => {
  const { transcript, language } = req.body;
  const parsed = await parseVoiceCommandSmart(transcript, language);

  if (!parsed.item && parsed.action !== "search") {
    res.status(400);
    throw new Error("Could not detect an item in voice command");
  }

  if (parsed.action === "remove") {
    const result = await removeItemByName({
      name: parsed.item,
      brand: parsed.brand,
      quantity: parsed.quantityProvided ? parsed.quantity : null,
      unit: parsed.unit
    });

    return res.json({
      action: parsed.action,
      message: result.removed
        ? `Updated list after removing ${parsed.item}`
        : `${parsed.item} was not in your list`,
      list: result.list,
      parsed
    });
  }

  if (parsed.action === "search") {
    const results = searchCatalog({
      query: parsed.filters.query,
      brand: parsed.filters.brand,
      size: parsed.filters.size,
      maxPrice: parsed.filters.maxPrice,
      minPrice: parsed.filters.minPrice
    });

    const queryText =
      parsed.filters?.query ||
      [parsed.brand, parsed.item, parsed.size].filter(Boolean).join(" ") ||
      "your query";

    return res.json({
      action: parsed.action,
      message:
        results.length > 0
          ? `Found ${results.length} matching product(s).`
          : `No products found for "${queryText}".`,
      found: results.length > 0,
      results,
      parsed
    });
  }

  const mode = parsed.action === "update" ? "set" : "increment";

  const brandPlan = buildBrandSelectionProposal({
    item: parsed.item,
    brand: parsed.brand,
    size: parsed.size,
    quantity: parsed.quantity,
    unit: parsed.unit,
    action: parsed.action
  });

  if (brandPlan) {
    const brandConfirm = createBrandSelectionConfirmation({
      proposal: brandPlan,
      parsed,
      mode
    });

    return res.status(202).json({
      action: parsed.action,
      requiresBrandSelection: true,
      message: `Multiple brands are available for ${parsed.item}. Please select a brand and price to continue.`,
      brandSelection: brandConfirm,
      parsed
    });
  }

  const out = await processAddOrUpdateAction({ parsed, mode });
  return res.status(out.status).json(out.body);
});

export const confirmBrandSelection = asyncHandler(async (req, res) => {
  const { token, selectedSku, cancel } = req.body;

  if (!token) {
    res.status(400);
    throw new Error("Brand selection token is required");
  }

  if (cancel) {
    const rejected = rejectBrandSelectionConfirmation(token);
    if (!rejected) {
      res.status(404);
      throw new Error("Brand selection request expired or not found");
    }

    return res.json({
      confirmed: false,
      message: "No brand was selected. Nothing was added."
    });
  }

  if (!selectedSku) {
    res.status(400);
    throw new Error("Selected SKU is required");
  }

  const saved = consumeBrandSelectionConfirmation(token);
  if (!saved) {
    res.status(404);
    throw new Error("Brand selection request expired or not found");
  }

  const pickedOpt = saved.proposal.options.find((entry) => entry.sku === selectedSku);
  if (!pickedOpt) {
    res.status(400);
    throw new Error("Selected brand option is invalid");
  }

  const nextCmd = {
    ...saved.parsed,
    item: pickedOpt.name,
    brand: pickedOpt.brand,
    size: pickedOpt.size || saved.parsed.size || "",
    filters: {
      ...(saved.parsed.filters || {}),
      query: pickedOpt.name,
      brand: pickedOpt.brand,
      size: pickedOpt.size || ""
    }
  };

  const out = await processAddOrUpdateAction({
    parsed: nextCmd,
    mode: saved.mode
  });

  return res.status(out.status).json({
    ...out.body,
    selectedOption: pickedOpt
  });
});

export const confirmSubstitute = asyncHandler(async (req, res) => {
  const { token, approve, selectedSku } = req.body;
  if (!token) {
    res.status(400);
    throw new Error("Confirmation token is required");
  }

  if (!approve) {
    const rejected = rejectSubstituteConfirmation(token);
    if (!rejected) {
      res.status(404);
      throw new Error("Confirmation request expired or not found");
    }
    return res.json({
      confirmed: false,
      message: "No problem, I did not add the alternative item."
    });
  }

  const saved = consumeSubstituteConfirmation(token);
  if (!saved) {
    res.status(404);
    throw new Error("Confirmation request expired or not found");
  }

  let pickedAlt = saved.suggestedAlternative;
  if (selectedSku) {
    const matched = (saved.options || []).find((entry) => entry.sku === selectedSku);
    if (!matched) {
      res.status(400);
      throw new Error("Selected substitute option is invalid");
    }
    pickedAlt = matched;
  }

  if (!pickedAlt) {
    res.status(400);
    throw new Error("No valid substitute option is available for confirmation");
  }

  if (saved.mode === "set") {
    const result = await setItemQuantityByName({
      name: pickedAlt.name,
      brand: pickedAlt.brand,
      quantity: saved.quantity,
      unit: saved.unit,
      size: pickedAlt.size || ""
    });

    return res.json({
      confirmed: true,
      action: "update",
      message: `Added alternative ${pickedAlt.name} by ${pickedAlt.brand}.`,
      list: result.list,
      appliedItem: pickedAlt
    });
  }

  const list = await addItem({
    name: pickedAlt.name,
    brand: pickedAlt.brand,
    quantity: saved.quantity,
    unit: saved.unit,
    size: pickedAlt.size || "",
    mode: "increment"
  });

  return res.json({
    confirmed: true,
    action: "add",
    message: `Added alternative ${pickedAlt.name} by ${pickedAlt.brand}.`,
    list,
    appliedItem: pickedAlt
  });
});


