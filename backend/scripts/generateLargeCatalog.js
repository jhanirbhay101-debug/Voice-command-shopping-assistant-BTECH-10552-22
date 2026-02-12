import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rp = (value) => Math.max(0.45, Number(value.toFixed(2)));

const hash = (value = "") => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const slug = (value = "", length = 5) => {
  const clean = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (!clean) return "X".repeat(length);
  return clean.slice(0, length).padEnd(length, "X");
};

const CATEGORY_CODE = {
  produce: "PRD",
  dairy: "DRY",
  bakery: "BKR",
  grains: "GRN",
  protein: "PRT",
  beverages: "BEV",
  snacks: "SNK",
  personal_care: "PCR",
  household: "HSD"
};

const SIZES = {
  produceWeight: [
    { label: "500g", multiplier: 0.55 },
    { label: "1kg", multiplier: 1 },
    { label: "2kg", multiplier: 1.9 }
  ],
  produceLeafy: [
    { label: "100g", multiplier: 0.45 },
    { label: "250g", multiplier: 1 },
    { label: "500g", multiplier: 1.8 }
  ],
  watermelon: [
    { label: "1kg", multiplier: 0.7 },
    { label: "2kg", multiplier: 1.2 },
    { label: "4kg", multiplier: 2.2 }
  ],
  milk: [
    { label: "500ml", multiplier: 0.6 },
    { label: "1L", multiplier: 1 },
    { label: "2L", multiplier: 1.85 }
  ],
  yogurt: [
    { label: "400g", multiplier: 0.8 },
    { label: "900g", multiplier: 1.65 }
  ],
  paneer: [
    { label: "200g", multiplier: 0.65 },
    { label: "500g", multiplier: 1.45 }
  ],
  cheese: [
    { label: "200g", multiplier: 0.85 },
    { label: "400g", multiplier: 1.6 }
  ],
  butter: [
    { label: "100g", multiplier: 0.55 },
    { label: "500g", multiplier: 2.25 }
  ],
  bread: [
    { label: "300g", multiplier: 0.8 },
    { label: "450g", multiplier: 1 },
    { label: "700g", multiplier: 1.45 }
  ],
  buns: [
    { label: "4 pack", multiplier: 0.9 },
    { label: "8 pack", multiplier: 1.65 }
  ],
  flour: [
    { label: "1kg", multiplier: 1 },
    { label: "5kg", multiplier: 4.65 },
    { label: "10kg", multiplier: 8.95 }
  ],
  rice: [
    { label: "1kg", multiplier: 1 },
    { label: "5kg", multiplier: 4.75 },
    { label: "10kg", multiplier: 9.2 }
  ],
  pulses: [
    { label: "500g", multiplier: 0.58 },
    { label: "1kg", multiplier: 1 },
    { label: "2kg", multiplier: 1.92 }
  ],
  pasta: [
    { label: "500g", multiplier: 1 },
    { label: "1kg", multiplier: 1.9 }
  ],
  eggs: [
    { label: "6 pack", multiplier: 0.65 },
    { label: "12 pack", multiplier: 1 },
    { label: "30 pack", multiplier: 2.4 }
  ],
  meat: [
    { label: "250g", multiplier: 0.62 },
    { label: "500g", multiplier: 1 },
    { label: "1kg", multiplier: 1.9 }
  ],
  tofu: [
    { label: "200g", multiplier: 0.72 },
    { label: "450g", multiplier: 1.45 }
  ],
  beverageBottle: [
    { label: "500ml", multiplier: 0.62 },
    { label: "1L", multiplier: 1 },
    { label: "2L", multiplier: 1.78 }
  ],
  teaCoffee: [
    { label: "100g", multiplier: 0.62 },
    { label: "250g", multiplier: 1 },
    { label: "500g", multiplier: 1.85 }
  ],
  canPack: [
    { label: "250ml", multiplier: 0.72 },
    { label: "4 pack", multiplier: 2.55 }
  ],
  snackPack: [
    { label: "50g", multiplier: 0.45 },
    { label: "100g", multiplier: 1 },
    { label: "200g", multiplier: 1.9 }
  ],
  biscuitPack: [
    { label: "100g", multiplier: 0.6 },
    { label: "250g", multiplier: 1 },
    { label: "500g", multiplier: 1.88 }
  ],
  chocolate: [
    { label: "38g", multiplier: 0.55 },
    { label: "75g", multiplier: 1 },
    { label: "150g", multiplier: 1.9 }
  ],
  noodles: [
    { label: "70g", multiplier: 0.58 },
    { label: "280g", multiplier: 2.05 }
  ],
  toothpaste: [
    { label: "100g", multiplier: 0.78 },
    { label: "150g", multiplier: 1 },
    { label: "200g", multiplier: 1.28 }
  ],
  liquidCare: [
    { label: "200ml", multiplier: 0.58 },
    { label: "400ml", multiplier: 1 },
    { label: "750ml", multiplier: 1.72 }
  ],
  shampoo: [
    { label: "180ml", multiplier: 0.75 },
    { label: "340ml", multiplier: 1 },
    { label: "650ml", multiplier: 1.82 }
  ],
  soap: [
    { label: "100g", multiplier: 1 },
    { label: "4x100g", multiplier: 3.7 }
  ],
  unit: [
    { label: "1 unit", multiplier: 1 },
    { label: "2 units", multiplier: 1.95 }
  ],
  householdLiquid: [
    { label: "500ml", multiplier: 0.65 },
    { label: "1L", multiplier: 1 },
    { label: "2L", multiplier: 1.85 }
  ],
  householdPowder: [
    { label: "1kg", multiplier: 1 },
    { label: "2kg", multiplier: 1.88 },
    { label: "4kg", multiplier: 3.6 }
  ],
  householdPack: [
    { label: "1 pack", multiplier: 0.72 },
    { label: "3 pack", multiplier: 1.95 },
    { label: "6 pack", multiplier: 3.7 }
  ],
  wraps: [
    { label: "25m", multiplier: 0.8 },
    { label: "50m", multiplier: 1 },
    { label: "100m", multiplier: 1.86 }
  ]
};

const CATEGORY_CONFIG = {
  produce: {
    brands: [
      "FreshFarm",
      "Farm2Home",
      "GreenBasket",
      "LocalMandi",
      "Nature's Basket",
      "KisanKart",
      "Organic India",
      "Reliance Fresh",
      "BigBasket Farm",
      "DailyMart"
    ],
    brandCount: 4,
    defaultSizes: SIZES.produceWeight
  },
  dairy: {
    brands: [
      "Amul",
      "Mother Dairy",
      "Nestle",
      "Britannia",
      "Epigamia",
      "Danone",
      "Sofit",
      "NutriLife",
      "MilkyMist",
      "CountryDelight",
      "Aavin",
      "Nandini"
    ],
    brandCount: 3,
    defaultSizes: SIZES.milk
  },
  bakery: {
    brands: [
      "Britannia",
      "Harvest Gold",
      "Modern",
      "The Baker's Dozen",
      "English Oven",
      "Bonn",
      "Bagrrys",
      "BakersVille"
    ],
    brandCount: 3,
    defaultSizes: SIZES.bread
  },
  grains: {
    brands: [
      "Aashirvaad",
      "Fortune",
      "India Gate",
      "Tata Sampann",
      "24 Mantra",
      "Daawat",
      "Organic Tattva",
      "Patanjali",
      "BB Popular",
      "MTR"
    ],
    brandCount: 3,
    defaultSizes: SIZES.rice
  },
  protein: {
    brands: [
      "Licious",
      "FreshToHome",
      "Godrej Real Good",
      "Venky's",
      "Tata Sampann",
      "Nutrela",
      "Pintola",
      "BB Royal",
      "Organic India",
      "ProNature"
    ],
    brandCount: 3,
    defaultSizes: SIZES.pulses
  },
  beverages: {
    brands: [
      "Bisleri",
      "Aquafina",
      "Kinley",
      "Real",
      "Tropicana",
      "Paper Boat",
      "Coca-Cola",
      "Pepsi",
      "Red Bull",
      "Monster",
      "Nescafe",
      "Tata Tea",
      "Lipton",
      "Bru"
    ],
    brandCount: 3,
    defaultSizes: SIZES.beverageBottle
  },
  snacks: {
    brands: [
      "Lay's",
      "Kurkure",
      "Haldiram",
      "Bingo",
      "Cadbury",
      "Nestle",
      "Parle",
      "Sunfeast",
      "Too Yumm",
      "Unibic",
      "Balaji",
      "ITC",
      "Pringles",
      "Kellogg's"
    ],
    brandCount: 3,
    defaultSizes: SIZES.snackPack
  },
  personal_care: {
    brands: [
      "Colgate",
      "Pepsodent",
      "Dove",
      "Lux",
      "Lifebuoy",
      "Dettol",
      "Pears",
      "Nivea",
      "Himalaya",
      "Mamaearth",
      "Pantene",
      "Head & Shoulders",
      "Clinic Plus",
      "Vaseline",
      "Gillette",
      "Whisper",
      "Johnson's"
    ],
    brandCount: 3,
    defaultSizes: SIZES.liquidCare
  },
  household: {
    brands: [
      "Surf Excel",
      "Ariel",
      "Tide",
      "Vim",
      "Pril",
      "Lizol",
      "Harpic",
      "Colin",
      "Scotch-Brite",
      "Origami",
      "Godrej",
      "Mr. Clean",
      "SafeWrap",
      "Good Knight"
    ],
    brandCount: 3,
    defaultSizes: SIZES.householdLiquid
  }
};

const seed = (category, name, basePrice, options = {}) => ({
  category,
  name,
  basePrice,
  ...options
});

const produce = (name, basePrice, seasonMonths = [], group = "", options = {}) =>
  seed("produce", name, basePrice, { seasonMonths, group: group || name, ...options });

const dairy = (name, basePrice, group = "", options = {}) =>
  seed("dairy", name, basePrice, { group: group || name, ...options });

const bakery = (name, basePrice, group = "", options = {}) =>
  seed("bakery", name, basePrice, { group: group || name, ...options });

const grains = (name, basePrice, group = "", options = {}) =>
  seed("grains", name, basePrice, { group: group || name, ...options });

const protein = (name, basePrice, group = "", options = {}) =>
  seed("protein", name, basePrice, { group: group || name, ...options });

const beverage = (name, basePrice, seasonMonths = [], group = "", options = {}) =>
  seed("beverages", name, basePrice, { seasonMonths, group: group || name, ...options });

const snack = (name, basePrice, group = "", options = {}) =>
  seed("snacks", name, basePrice, { group: group || name, ...options });

const care = (name, basePrice, group = "", options = {}) =>
  seed("personal_care", name, basePrice, { group: group || name, ...options });

const household = (name, basePrice, group = "", options = {}) =>
  seed("household", name, basePrice, { group: group || name, ...options });

const CATALOG_SEEDS = [
  produce("regular apples", 2.8, [8, 9, 10, 11], "apples"),
  produce("organic apples", 4.2, [9, 10, 11], "apples"),
  produce("green apples", 3.4, [8, 9, 10], "apples"),
  produce("bananas", 1.9, [], "bananas"),
  produce("organic bananas", 2.9, [], "bananas"),
  produce("oranges", 2.6, [11, 12, 1, 2], "oranges"),
  produce("mandarins", 3.2, [11, 12, 1], "oranges"),
  produce("mangoes", 3.8, [4, 5, 6, 7], "mangoes"),
  produce("alphonso mangoes", 6.5, [4, 5, 6], "mangoes"),
  produce("kesar mangoes", 5.4, [4, 5, 6], "mangoes"),
  produce("pomegranates", 4.3, [9, 10, 11, 12], "pomegranate"),
  produce("green grapes", 3.6, [1, 2, 3], "grapes"),
  produce("black grapes", 4.1, [1, 2, 3], "grapes"),
  produce("guava", 2.4, [8, 9, 10, 11], "guava"),
  produce("papaya", 2.1, [], "papaya"),
  produce("pineapple", 3.1, [4, 5, 6, 7], "pineapple"),
  produce("watermelon", 1.6, [3, 4, 5, 6], "melon", { sizes: SIZES.watermelon }),
  produce("muskmelon", 2.2, [3, 4, 5, 6], "melon", { sizes: SIZES.watermelon }),
  produce("strawberries", 5.8, [12, 1, 2], "berries", { sizes: SIZES.produceLeafy }),
  produce("blueberries", 8.5, [12, 1, 2], "berries", { sizes: SIZES.produceLeafy }),
  produce("kiwi", 6.2, [11, 12, 1, 2], "kiwi"),
  produce("pears", 3.7, [8, 9, 10], "pears"),
  produce("peaches", 4.1, [5, 6, 7], "peaches"),
  produce("plums", 4.4, [6, 7, 8], "plums"),
  produce("avocados", 7.3, [7, 8, 9], "avocado"),
  produce("lemons", 1.7, [], "citrus"),
  produce("limes", 1.8, [], "citrus"),
  produce("dragon fruit", 7.9, [6, 7, 8, 9], "dragon fruit"),
  produce("potatoes", 1.5, [], "potato"),
  produce("onions", 1.4, [], "onion"),
  produce("tomatoes", 1.8, [], "tomato"),
  produce("cherry tomatoes", 3.2, [], "tomato", { sizes: SIZES.produceLeafy }),
  produce("cucumbers", 1.9, [], "cucumber"),
  produce("carrots", 2.1, [10, 11, 12, 1], "carrot"),
  produce("spinach", 2.4, [], "leafy greens", { sizes: SIZES.produceLeafy }),
  produce("coriander leaves", 2.6, [], "leafy greens", { sizes: SIZES.produceLeafy }),
  produce("mint leaves", 2.8, [], "leafy greens", { sizes: SIZES.produceLeafy }),
  produce("broccoli", 3.6, [11, 12, 1, 2], "cruciferous"),
  produce("cauliflower", 2.7, [11, 12, 1, 2], "cruciferous"),
  produce("cabbage", 2.1, [11, 12, 1, 2], "cruciferous"),
  produce("green peas", 2.8, [11, 12, 1], "peas"),
  produce("sweet corn", 2.6, [7, 8, 9], "corn"),
  produce("okra", 2.4, [5, 6, 7, 8, 9], "okra"),
  produce("eggplant", 2.2, [], "eggplant"),
  produce("bottle gourd", 2.0, [6, 7, 8, 9], "gourd"),
  produce("ridge gourd", 2.1, [6, 7, 8, 9], "gourd"),
  produce("ginger", 2.9, [], "aromatics", { sizes: SIZES.produceLeafy }),
  produce("garlic", 3.1, [], "aromatics", { sizes: SIZES.produceLeafy }),
  produce("green chili", 2.7, [], "aromatics", { sizes: SIZES.produceLeafy }),

  dairy("whole milk", 2.8, "milk", { sizes: SIZES.milk }),
  dairy("toned milk", 2.4, "milk", { sizes: SIZES.milk }),
  dairy("skim milk", 2.6, "milk", { sizes: SIZES.milk }),
  dairy("almond milk", 4.2, "plant milk", { sizes: SIZES.milk, brands: ["Sofit", "NutriLife", "Raw Pressery"] }),
  dairy("oat milk", 4.0, "plant milk", { sizes: SIZES.milk, brands: ["Sofit", "NutriLife", "Raw Pressery"] }),
  dairy("soy milk", 3.6, "plant milk", { sizes: SIZES.milk, brands: ["Sofit", "Nestle", "ProVita"] }),
  dairy("curd", 1.6, "curd", { sizes: SIZES.yogurt }),
  dairy("greek yogurt", 2.9, "yogurt", { sizes: SIZES.yogurt }),
  dairy("plain yogurt", 2.0, "yogurt", { sizes: SIZES.yogurt }),
  dairy("paneer", 5.2, "paneer", { sizes: SIZES.paneer }),
  dairy("cheddar cheese slices", 4.8, "cheese", { sizes: SIZES.cheese }),
  dairy("mozzarella cheese", 4.6, "cheese", { sizes: SIZES.cheese }),
  dairy("processed cheese block", 4.4, "cheese", { sizes: SIZES.cheese }),
  dairy("salted butter", 3.4, "butter", { sizes: SIZES.butter }),
  dairy("ghee", 7.4, "ghee", { sizes: SIZES.butter }),
  dairy("fresh cream", 2.7, "cream", { sizes: SIZES.liquidCare }),
  dairy("buttermilk", 1.8, "fermented drink", { sizes: SIZES.milk }),
  dairy("lassi sweet", 2.1, "fermented drink", { sizes: SIZES.milk }),
  dairy("lassi salted", 2.0, "fermented drink", { sizes: SIZES.milk }),

  bakery("white bread", 2.0, "bread", { sizes: SIZES.bread }),
  bakery("brown bread", 2.2, "bread", { sizes: SIZES.bread }),
  bakery("multigrain bread", 2.6, "bread", { sizes: SIZES.bread }),
  bakery("whole wheat bread", 2.4, "bread", { sizes: SIZES.bread }),
  bakery("burger buns", 1.9, "buns", { sizes: SIZES.buns }),
  bakery("pav buns", 1.8, "buns", { sizes: SIZES.buns }),
  bakery("hot dog buns", 2.0, "buns", { sizes: SIZES.buns }),
  bakery("whole wheat tortillas", 2.9, "flatbread", { sizes: SIZES.buns }),
  bakery("pizza base", 3.0, "flatbread", { sizes: SIZES.buns }),
  bakery("garlic bread", 2.8, "bread", { sizes: SIZES.bread }),
  bakery("croissant pack", 3.6, "pastry", { sizes: SIZES.buns }),
  bakery("tea rusk", 2.5, "rusk", { sizes: SIZES.biscuitPack }),

  grains("basmati rice", 4.9, "rice", { sizes: SIZES.rice }),
  grains("sona masoori rice", 3.8, "rice", { sizes: SIZES.rice }),
  grains("brown rice", 4.4, "rice", { sizes: SIZES.rice }),
  grains("jasmine rice", 5.2, "rice", { sizes: SIZES.rice }),
  grains("whole wheat flour", 2.6, "flour", { sizes: SIZES.flour }),
  grains("all purpose flour", 2.4, "flour", { sizes: SIZES.flour }),
  grains("semolina", 2.2, "flour", { sizes: SIZES.flour }),
  grains("chickpea flour", 3.0, "flour", { sizes: SIZES.flour }),
  grains("corn flour", 2.8, "flour", { sizes: SIZES.flour }),
  grains("rolled oats", 3.6, "oats", { sizes: SIZES.pasta }),
  grains("steel cut oats", 4.0, "oats", { sizes: SIZES.pasta }),
  grains("quinoa", 5.8, "quinoa", { sizes: SIZES.pasta }),
  grains("vermicelli", 2.4, "pasta", { sizes: SIZES.pasta }),
  grains("poha thick", 2.1, "poha", { sizes: SIZES.pasta }),
  grains("poha thin", 2.0, "poha", { sizes: SIZES.pasta }),
  grains("penne pasta", 3.1, "pasta", { sizes: SIZES.pasta }),
  grains("spaghetti pasta", 3.2, "pasta", { sizes: SIZES.pasta }),
  grains("macaroni pasta", 2.9, "pasta", { sizes: SIZES.pasta }),
  grains("ragi flour", 2.7, "millet flour", { sizes: SIZES.flour }),
  grains("jowar flour", 2.8, "millet flour", { sizes: SIZES.flour }),
  grains("bajra flour", 2.9, "millet flour", { sizes: SIZES.flour }),

  protein("eggs white", 2.7, "eggs", { sizes: SIZES.eggs }),
  protein("eggs brown", 3.0, "eggs", { sizes: SIZES.eggs }),
  protein("chicken breast boneless", 6.8, "chicken", { sizes: SIZES.meat }),
  protein("chicken curry cut", 5.9, "chicken", { sizes: SIZES.meat }),
  protein("fish fillet basa", 6.4, "fish", { sizes: SIZES.meat }),
  protein("fish fillet rohu", 5.8, "fish", { sizes: SIZES.meat }),
  protein("prawns cleaned", 8.2, "seafood", { sizes: SIZES.meat }),
  protein("tofu firm", 3.4, "tofu", { sizes: SIZES.tofu }),
  protein("soya chunks", 2.4, "soy protein", { sizes: SIZES.pulses }),
  protein("chickpeas dry", 2.6, "legumes", { sizes: SIZES.pulses }),
  protein("black chickpeas", 2.8, "legumes", { sizes: SIZES.pulses }),
  protein("kidney beans", 2.9, "legumes", { sizes: SIZES.pulses }),
  protein("black beans", 3.1, "legumes", { sizes: SIZES.pulses }),
  protein("masoor dal", 2.3, "lentils", { sizes: SIZES.pulses }),
  protein("moong dal", 2.5, "lentils", { sizes: SIZES.pulses }),
  protein("toor dal", 2.7, "lentils", { sizes: SIZES.pulses }),
  protein("chana dal", 2.4, "lentils", { sizes: SIZES.pulses }),
  protein("peanut butter crunchy", 4.3, "spreads", { sizes: SIZES.pasta, brands: ["Pintola", "Alpino", "MyFitness"] }),

  beverage("mineral water", 0.9, [], "water", { sizes: SIZES.beverageBottle }),
  beverage("sparkling water", 1.6, [], "water", { sizes: SIZES.beverageBottle }),
  beverage("coconut water", 1.8, [3, 4, 5, 6], "hydration", { sizes: SIZES.canPack }),
  beverage("orange juice", 2.3, [11, 12, 1], "juice", { sizes: SIZES.beverageBottle }),
  beverage("apple juice", 2.4, [8, 9, 10], "juice", { sizes: SIZES.beverageBottle }),
  beverage("mixed fruit juice", 2.6, [], "juice", { sizes: SIZES.beverageBottle }),
  beverage("pomegranate juice", 3.1, [9, 10, 11], "juice", { sizes: SIZES.beverageBottle }),
  beverage("cola soda", 1.4, [], "soda", { sizes: SIZES.beverageBottle }),
  beverage("lemon soda", 1.5, [3, 4, 5, 6], "soda", { sizes: SIZES.beverageBottle }),
  beverage("ginger ale", 1.9, [], "soda", { sizes: SIZES.beverageBottle }),
  beverage("green tea", 3.4, [], "tea", { sizes: SIZES.teaCoffee }),
  beverage("black tea", 3.0, [], "tea", { sizes: SIZES.teaCoffee }),
  beverage("masala tea", 3.2, [], "tea", { sizes: SIZES.teaCoffee }),
  beverage("instant coffee", 4.1, [], "coffee", { sizes: SIZES.teaCoffee }),
  beverage("ground coffee", 4.8, [], "coffee", { sizes: SIZES.teaCoffee }),
  beverage("cold coffee can", 1.9, [], "coffee", { sizes: SIZES.canPack }),
  beverage("sports drink", 1.7, [4, 5, 6, 7], "energy", { sizes: SIZES.canPack }),
  beverage("energy drink", 2.2, [], "energy", { sizes: SIZES.canPack }),
  beverage("iced tea lemon", 1.8, [3, 4, 5, 6], "tea", { sizes: SIZES.canPack }),

  snack("potato chips classic", 1.4, "chips", { sizes: SIZES.snackPack }),
  snack("potato chips masala", 1.5, "chips", { sizes: SIZES.snackPack }),
  snack("tortilla chips nacho", 1.8, "chips", { sizes: SIZES.snackPack }),
  snack("popcorn butter", 1.7, "popcorn", { sizes: SIZES.snackPack }),
  snack("roasted peanuts salted", 1.6, "nuts", { sizes: SIZES.snackPack }),
  snack("roasted almonds", 3.9, "nuts", { sizes: SIZES.snackPack }),
  snack("cashew nuts roasted", 4.4, "nuts", { sizes: SIZES.snackPack }),
  snack("trail mix nuts", 4.1, "nuts", { sizes: SIZES.snackPack }),
  snack("digestive biscuits", 2.2, "biscuits", { sizes: SIZES.biscuitPack }),
  snack("cream biscuits vanilla", 2.0, "biscuits", { sizes: SIZES.biscuitPack }),
  snack("oat cookies", 2.8, "cookies", { sizes: SIZES.biscuitPack }),
  snack("chocolate cookies", 3.0, "cookies", { sizes: SIZES.biscuitPack }),
  snack("namkeen mixture", 2.4, "namkeen", { sizes: SIZES.snackPack }),
  snack("bhujia sev", 2.3, "namkeen", { sizes: SIZES.snackPack }),
  snack("instant noodles masala", 0.9, "noodles", { sizes: SIZES.noodles }),
  snack("instant noodles atta", 1.0, "noodles", { sizes: SIZES.noodles }),
  snack("kitkat chocolate", 1.4, "chocolate", { sizes: SIZES.chocolate, brands: ["Nestle"] }),
  snack("perk chocolate", 1.2, "chocolate", { sizes: SIZES.chocolate, brands: ["Cadbury"] }),
  snack("dairy milk chocolate", 1.5, "chocolate", { sizes: SIZES.chocolate, brands: ["Cadbury"] }),
  snack("munch chocolate", 1.3, "chocolate", { sizes: SIZES.chocolate, brands: ["Nestle"] }),
  snack("five star chocolate", 1.4, "chocolate", { sizes: SIZES.chocolate, brands: ["Cadbury"] }),
  snack("dark chocolate bar", 2.2, "chocolate", { sizes: SIZES.chocolate, brands: ["Amul", "Cadbury", "Lindt"] }),
  snack("granola bar nuts", 1.9, "bars", { sizes: SIZES.noodles }),
  snack("peanut chikki", 1.6, "bars", { sizes: SIZES.noodles }),

  care("toothpaste", 2.4, "toothpaste", { sizes: SIZES.toothpaste }),
  care("herbal toothpaste", 2.8, "toothpaste", { sizes: SIZES.toothpaste }),
  care("sensitive toothpaste", 3.1, "toothpaste", { sizes: SIZES.toothpaste }),
  care("toothbrush soft", 1.1, "toothbrush", { sizes: SIZES.unit }),
  care("toothbrush medium", 1.1, "toothbrush", { sizes: SIZES.unit }),
  care("mouthwash mint", 3.0, "mouthwash", { sizes: SIZES.liquidCare }),
  care("bath soap", 1.3, "soap", { sizes: SIZES.soap }),
  care("moisturizing soap", 1.6, "soap", { sizes: SIZES.soap }),
  care("handwash liquid", 2.0, "handwash", { sizes: SIZES.liquidCare }),
  care("shampoo anti dandruff", 3.1, "shampoo", { sizes: SIZES.shampoo }),
  care("shampoo smooth", 2.9, "shampoo", { sizes: SIZES.shampoo }),
  care("conditioner smooth", 3.0, "conditioner", { sizes: SIZES.shampoo }),
  care("hair oil coconut", 2.6, "hair oil", { sizes: SIZES.liquidCare }),
  care("face wash neem", 2.7, "face wash", { sizes: SIZES.liquidCare }),
  care("body lotion", 3.3, "body lotion", { sizes: SIZES.liquidCare }),
  care("deodorant spray", 3.6, "deodorant", { sizes: SIZES.canPack }),
  care("shaving cream", 2.5, "shaving", { sizes: SIZES.toothpaste }),
  care("sanitary pads", 3.5, "sanitary", { sizes: SIZES.unit }),
  care("baby wipes", 2.3, "baby care", { sizes: SIZES.unit }),
  care("sunscreen lotion", 4.1, "skin care", { sizes: SIZES.liquidCare }),

  household("dishwash liquid", 1.8, "dishwash", { sizes: SIZES.householdLiquid }),
  household("dishwash bar", 1.2, "dishwash", { sizes: SIZES.unit }),
  household("laundry detergent powder", 3.4, "laundry", { sizes: SIZES.householdPowder }),
  household("laundry liquid detergent", 3.6, "laundry", { sizes: SIZES.householdLiquid }),
  household("fabric conditioner", 2.8, "laundry", { sizes: SIZES.householdLiquid }),
  household("floor cleaner", 2.5, "cleaner", { sizes: SIZES.householdLiquid }),
  household("toilet cleaner", 2.7, "cleaner", { sizes: SIZES.householdLiquid }),
  household("glass cleaner spray", 2.4, "cleaner", { sizes: SIZES.householdLiquid }),
  household("kitchen cleaner spray", 2.6, "cleaner", { sizes: SIZES.householdLiquid }),
  household("disinfectant spray", 3.2, "cleaner", { sizes: SIZES.canPack }),
  household("trash bags medium", 1.9, "trash bags", { sizes: SIZES.householdPack }),
  household("trash bags large", 2.2, "trash bags", { sizes: SIZES.householdPack }),
  household("aluminum foil", 2.1, "kitchen wrap", { sizes: SIZES.wraps }),
  household("cling wrap", 1.9, "kitchen wrap", { sizes: SIZES.wraps }),
  household("paper towels", 2.0, "paper products", { sizes: SIZES.householdPack }),
  household("tissue box", 1.7, "paper products", { sizes: SIZES.householdPack }),
  household("scrub sponge", 1.1, "cleaning tools", { sizes: SIZES.unit }),
  household("mosquito repellent refill", 2.7, "pest control", { sizes: SIZES.unit }),
  household("air freshener spray", 2.9, "freshener", { sizes: SIZES.canPack }),
  household("toilet paper roll", 1.8, "paper products", { sizes: SIZES.householdPack })
];

const pickBr = (seedData) => {
  if (Array.isArray(seedData.brands) && seedData.brands.length > 0) {
    return seedData.brands;
  }

  const config = CATEGORY_CONFIG[seedData.category];
  const pool = config.brands;
  const requested = seedData.brandCount || config.brandCount || 3;
  const start = hash(seedData.name) % pool.length;
  const selected = [];

  for (let i = 0; i < requested; i += 1) {
    selected.push(pool[(start + i) % pool.length]);
  }

  return [...new Set(selected)];
};

const normKey = (value = "") => value.toLowerCase().trim();

const seasonMonthsOr = (seedData) =>
  Array.isArray(seedData.seasonMonths) ? seedData.seasonMonths : [];

const makeCat = () => {
  const generated = [];
  let sequence = 1;

  CATALOG_SEEDS.forEach((seedData) => {
    const config = CATEGORY_CONFIG[seedData.category];
    const sizes = seedData.sizes || config.defaultSizes;
    const brands = pickBr(seedData);
    const seasonMonths = seasonMonthsOr(seedData);

    brands.forEach((brand) => {
      sizes.forEach((sizeData) => {
        const identity = `${seedData.name}|${brand}|${sizeData.label}|${sequence}`;
        const hash = hash(identity);
        const sizeFactor = sizeData.multiplier;
        const marketFactor = 1 + ((hash % 19) - 9) / 100;
        const brandFactor = 1 + ((hash(brand) % 9) - 4) / 100;

        const price = rp(seedData.basePrice * sizeFactor * marketFactor * brandFactor);

        const onSale = hash % 5 === 0;
        const discount = 0.08 + (hash % 11) / 100;
        const salePrice = onSale ? rp(price * (1 - discount)) : null;
        const inStock = hash % 9 !== 0;

        const sku = [
          CATEGORY_CODE[seedData.category] || "CAT",
          slug(seedData.name, 5),
          slug(brand, 4),
          slug(sizeData.label, 4),
          String(sequence).padStart(4, "0")
        ].join("-");

        generated.push({
          sku,
          name: seedData.name,
          brand,
          size: sizeData.label,
          price,
          salePrice,
          onSale,
          category: seedData.category,
          inStock,
          seasonMonths,
          substitutes: [],
          _group: normKey(seedData.group || seedData.name)
        });

        sequence += 1;
      });
    });
  });

  return generated;
};

const addSubs = (entries) => {
  const namesByGroup = new Map();
  const namesByCategory = new Map();

  entries.forEach((entry) => {
    if (!namesByGroup.has(entry._group)) {
      namesByGroup.set(entry._group, new Set());
    }
    namesByGroup.get(entry._group).add(entry.name);

    if (!namesByCategory.has(entry.category)) {
      namesByCategory.set(entry.category, new Set());
    }
    namesByCategory.get(entry.category).add(entry.name);
  });

  entries.forEach((entry) => {
    const sameGroup = [...(namesByGroup.get(entry._group) || [])].filter((name) => name !== entry.name);
    const sameCategory = [...(namesByCategory.get(entry.category) || [])].filter(
      (name) => name !== entry.name && !sameGroup.includes(name)
    );

    const candidates = [...sameGroup, ...sameCategory];
    candidates.sort((a, b) => hash(`${entry.sku}:${a}`) - hash(`${entry.sku}:${b}`));

    entry.substitutes = candidates.slice(0, 3);
    delete entry._group;
  });

  return entries;
};

const sortCat = (entries) =>
  entries.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    return a.size.localeCompare(b.size);
  });

const run = async () => {
  const outputArg = process.argv[2] || "../src/data/catalog.large.json";
  const outputPath = path.resolve(__dirname, outputArg);

  const generated = makeCat();
  const withSubstitutes = addSubs(generated);
  const sorted = sortCat(withSubstitutes);

  await fs.writeFile(outputPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf-8");

  const categoryCounts = sorted.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {});

  console.log(`Generated ${sorted.length} catalog items -> ${outputPath}`);
  console.log("Category counts:", categoryCounts);
};

await run();


