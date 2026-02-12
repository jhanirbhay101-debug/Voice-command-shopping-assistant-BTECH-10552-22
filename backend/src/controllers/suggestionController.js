import { buildSuggestions } from "../services/suggestionService.js";
import { getHistoryAndPreferences, listItems } from "../services/storeService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getSuggestions = asyncHandler(async (req, res) => {
  const { item } = req.query;
  const items = await listItems();
  const { history, preferences } = await getHistoryAndPreferences();

  const grouped = await buildSuggestions({
    history,
    preferences,
    list: items,
    focusItem: item
  });

  const {
    productRecommendations,
    seasonalRecommendations,
    substituteRecommendations,
    suggestions
  } = grouped;

  res.json({
    productRecommendationsCount: productRecommendations.length,
    seasonalRecommendationsCount: seasonalRecommendations.length,
    substituteRecommendationsCount: substituteRecommendations.length,
    productRecommendations,
    seasonalRecommendations,
    substituteRecommendations,
    count: suggestions.length,
    suggestions
  });
});

