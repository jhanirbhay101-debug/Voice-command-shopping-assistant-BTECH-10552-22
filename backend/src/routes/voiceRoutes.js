import express from "express";
import {
  confirmBrandSelection,
  confirmSubstitute,
  executeVoice,
  parseVoice
} from "../controllers/voiceController.js";

const router = express.Router();

router.post("/parse", parseVoice);
router.post("/execute", executeVoice);
router.post("/confirm-brand", confirmBrandSelection);
router.post("/confirm-substitute", confirmSubstitute);

export default router;


