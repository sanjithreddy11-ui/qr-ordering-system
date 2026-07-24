// Mirrors src/lib/menu-data.ts from the frontend so the database starts
// with the same menu you've already been designing against.
// If you edit the frontend mock later, update this file to match.
const RESTAURANT_ID = "maxibrew";

const rawMenu = [
  // ===================== NEW CATEGORIES (from Maxi Brew menu) =====================
  {
    id: "iced-coffee",
    title: "Iced Coffee",
    items: [
      { id: "banana-iced-latte", name: "Banana Iced Latte", description: "Chilled banana blend swirled through a smooth iced latte.", price: 229, diet: "veg", image: "/fooditems/ic1.png" },
      { id: "sundown-coffee", name: "Sundown Coffee", description: "Our house special iced coffee blend, poured over ice.", price: 269, diet: "veg", image: "/fooditems/ic2.png" },
      { id: "biscoff-iced-latte", name: "Biscoff Iced Latte", description: "Caramelized Biscoff syrup stirred into a creamy iced latte.", price: 249, diet: "veg", image: "/fooditems/ic3.png" },
      { id: "caramel-iced-latte", name: "Caramel Iced Latte", description: "Silky iced latte layered with a rich caramel drizzle.", price: 219, diet: "veg", image: "/fooditems/ic4.png" },
      { id: "cranberry-coffee", name: "Cranberry Coffee", description: "Tart cranberry notes meet bold, chilled coffee.", price: 249, diet: "veg", image: "/fooditems/ic5.png" },
      { id: "green-matcha-iced-latte", name: "Green Matcha Iced Latte", description: "Earthy matcha whisked into a cool, creamy iced latte.", price: 209, diet: "veg", image: "/fooditems/ic6.png" },
      { id: "iced-americano", name: "Iced Americano", description: "Bold espresso poured over ice for a crisp, clean finish.", price: 199, diet: "veg", image: "/fooditems/ic7.png" },
      { id: "iced-cappuccino", name: "Iced Cappuccino", description: "Chilled espresso and milk foam served over ice.", price: 219, diet: "veg", image: "/fooditems/ic8.png" },
      { id: "iced-irish-black-coffee", name: "Iced Irish Black Coffee", description: "Strong black coffee served chilled with a hint of spice.", price: 189, diet: "veg", image: "/fooditems/ic9.png" },
      { id: "iced-latte", name: "Iced Latte", description: "Smooth espresso and cold milk poured over ice.", price: 219, diet: "veg", image: "/fooditems/ic10.png" },
      { id: "iced-mocha", name: "Iced Mocha", description: "Chocolate and espresso blended and served chilled.", price: 229, diet: "veg", image: "/fooditems/ic11.png" },
      { id: "vanilla-iced-latte", name: "Vanilla Iced Latte", description: "Sweet vanilla syrup swirled into a chilled, creamy latte.", price: 219, diet: "veg", image: "/fooditems/ic12.png" },
    ],
  },
  {
    id: "dirty-coffee",
    title: "Dirty Coffee",
    items: [
      { id: "iced-vietnamese", name: "Iced Vietnamese", description: "Bold Vietnamese-style coffee sweetened with condensed milk over ice.", price: 279, diet: "veg", image: "/fooditems/dc1.png" },
      { id: "iced-spanish-latte-cinnamon-spiced", name: "Iced Spanish Latte (Cinnamon Spiced)", description: "Sweet condensed milk latte finished with a warm cinnamon spice.", price: 279, diet: "veg", image: "/fooditems/dc2.png" },
    ],
  },
  {
    id: "iced-tea",
    title: "Iced Tea",
    items: [
      { id: "blueberry-iced-tea", name: "Blueberry Iced Tea", description: "Chilled black tea infused with sweet, juicy blueberry.", price: 229, diet: "veg", image: "/fooditems/it1.png" },
      { id: "cranberry-iced-tea", name: "Cranberry Iced Tea", description: "Tart cranberry steeped through refreshing iced tea.", price: 239, diet: "veg", image: "/fooditems/it2.png" },
      { id: "lemon-iced-tea", name: "Lemon Iced Tea", description: "Classic iced tea brightened with fresh lemon.", price: 219, diet: "veg", image: "/fooditems/it3.png" },
      { id: "mango-iced-tea", name: "Mango Iced Tea", description: "Sweet mango pulp stirred into chilled black tea.", price: 239, diet: "veg", image: "/fooditems/it4.png" },
      { id: "orange-iced-tea", name: "Orange Iced Tea", description: "Zesty orange infused through a cool glass of iced tea.", price: 219, diet: "veg", image: "/fooditems/it5.png" },
      { id: "passion-fruit-iced-tea", name: "Passion Fruit Iced Tea", description: "Tangy passion fruit steeped into a refreshing iced tea.", price: 219, diet: "veg", image: "/fooditems/it6.png" },
      { id: "peach-iced-tea", name: "Peach Iced Tea", description: "Juicy peach flavour infused through chilled iced tea.", price: 239, diet: "veg", image: "/fooditems/it7.png" },
    ],
  },
  {
    id: "all-day-breakfast",
    title: "All Day Breakfast",
    items: [
      { id: "mexican-omlette", name: "Mexican Omlette", description: "Fluffy omelette loaded with peppers, onions and a mexican-spiced kick.", price: 119, diet: "veg", image: "/fooditems/adb1.png" },
      { id: "scrambled-eggs", name: "Scrambled Eggs", description: "Soft, buttery scrambled eggs cooked to order.", price: 99, diet: "veg", image: "/fooditems/adb2.png" },
      { id: "sunny-side-up-eggs", name: "Sunny Side Up Eggs", description: "Classic sunny side up eggs with a runny, golden yolk.", price: 99, diet: "veg", image: "/fooditems/adb3.png" },
      { id: "cheese-omlette", name: "Cheese Omlette", description: "Fluffy omelette folded with generous melted cheese.", price: 119, diet: "veg", image: "/fooditems/adb4.png" },
      { id: "pan-cakes", name: "Pan Cakes", description: "Soft, fluffy pancakes served warm off the griddle.", price: 99, diet: "veg", image: "/fooditems/adb5.png" },
      { id: "cheese-omlette-large", name: "Cheese Omlette (Large)", description: "A bigger serving of our fluffy, cheese-loaded omelette.", price: 239, diet: "veg", image: "/fooditems/adb6.png" },
      { id: "chicken-sausage-omlette-platter", name: "Chicken Sausage Omlette Platter", description: "Cheesy omelette paired with grilled chicken sausages on the side.", price: 259, diet: "non-veg", image: "/fooditems/adb7.png" },
    ],
  },
  {
    id: "pizzas-9-inch",
    title: "Pizzas (9 Inch)",
    items: [
      { id: "farm-fresh-pizza", name: "Farm Fresh Pizza", description: "A 9-inch pizza loaded with garden-fresh vegetables and cheese.", price: 399, diet: "veg", image: "/fooditems/pz1.png" },
      { id: "peri-peri-paneer-pizza", name: "Peri Peri Paneer Pizza", description: "Spicy peri peri paneer over a cheesy 9-inch base.", price: 419, diet: "veg", image: "/fooditems/pz2.png" },
      { id: "bbq-chicken-pizza", name: "BBQ Chicken Pizza", description: "Smoky BBQ chicken piled onto a 9-inch cheesy pizza.", price: 499, diet: "non-veg", image: "/fooditems/pz3.png" },
      { id: "chicken-tikka-pizza", name: "Chicken Tikka Pizza", description: "Tandoori chicken tikka over a melty 9-inch cheese pizza.", price: 499, diet: "non-veg", image: "/fooditems/pz4.png" },
      { id: "peri-peri-chicken-pizza", name: "Peri Peri Chicken Pizza", description: "Fiery peri peri chicken on a cheesy 9-inch pizza base.", price: 499, diet: "non-veg", image: "/fooditems/pz5.png" },
      { id: "margherita-pizza", name: "Margherita Pizza", description: "Classic tomato and mozzarella on a 9-inch pizza base.", price: 399, diet: "veg", image: "/fooditems/pz6.png" },
      { id: "mushroom-cheese-pizza", name: "Mushroom & Cheese Pizza", description: "Sautéed mushrooms and melted cheese over a 9-inch base.", price: 399, diet: "veg", image: "/fooditems/pz7.png" },
      { id: "paneer-keema-pizza", name: "Paneer Keema Pizza", description: "Spiced paneer keema puff-style pizza with a cheesy finish.", price: 499, diet: "veg", image: "/fooditems/pz8.png" },
      { id: "maxibrew-special-chicken-keema-pizza", name: "Maxibrew Special Chicken Keema Pizza", description: "Our signature spiced chicken keema puff-style pizza.", price: 519, diet: "non-veg", image: "/fooditems/pz9.png" },
    ],
  },
  {
    id: "sandwiches",
    title: "Sandwiches (Veg / Non-Veg)",
    items: [
      { id: "veg-club-sandwich", name: "Club Sandwich", description: "Layered veggies, cheese and toasted bread, classic club-style.", price: 149, diet: "veg", image: "/fooditems/sw1.png" },
      { id: "mushroom-cheese-sandwich", name: "Mushroom & Cheese Sandwich", description: "Sautéed mushrooms and melted cheese between toasted bread.", price: 249, diet: "veg", image: "/fooditems/sw2.png" },
      { id: "spinach-corn-cheese-sandwich", name: "Spinach & Corn Cheese Sandwich", description: "Creamy spinach and sweet corn with melted cheese, toasted.", price: 279, diet: "veg", image: "/fooditems/sw3.png" },
      { id: "spicy-paneer-sandwich", name: "Spicy Paneer Sandwich", description: "Spiced paneer filling grilled between toasted bread slices.", price: 279, diet: "veg", image: "/fooditems/sw4.png" },
      { id: "paneer-tikka-sandwich", name: "Paneer Tikka Sandwich", description: "Smoky tikka-spiced paneer grilled into a toasted sandwich.", price: 279, diet: "veg", image: "/fooditems/sw5.png" },
      { id: "non-veg-club-sandwich", name: "Club Sandwich", description: "Layered chicken, veggies and cheese in a toasted club sandwich.", price: 179, diet: "non-veg", image: "/fooditems/sw6.png" },
      { id: "bbq-sweet-chicken-sandwich", name: "BBQ Sweet Chicken Sandwich", description: "Smoky-sweet BBQ chicken grilled into a toasted sandwich.", price: 289, diet: "non-veg", image: "/fooditems/sw7.png" },
      { id: "chicken-keema-sandwich", name: "Chicken Keema Sandwich", description: "Spiced minced chicken keema grilled between toasted bread.", price: 289, diet: "non-veg", image: "/fooditems/sw8.png" },
      { id: "chicken-tikka-sandwich", name: "Chicken Tikka Sandwich", description: "Tandoori chicken tikka grilled into a toasted sandwich.", price: 289, diet: "non-veg", image: "/fooditems/sw9.png" },
      { id: "peri-peri-chicken-sandwich", name: "Peri Peri Chicken Sandwich", description: "Fiery peri peri chicken grilled into a toasted sandwich.", price: 299, diet: "non-veg", image: "/fooditems/sw10.png" },
    ],
  },
  {
    id: "cold-coffee",
    title: "Cold Coffee (Icecream Blended)",
    items: [
      { id: "hazelnut-cold-coffee", name: "Hazelnut Cold Coffee", description: "Cold coffee blended with ice cream and nutty hazelnut flavour.", price: 279, diet: "veg", image: "/fooditems/cc1.png" },
      { id: "banana-cold-coffee", name: "Banana Cold Coffee", description: "Cold coffee blended with ice cream and ripe banana.", price: 279, diet: "veg", image: "/fooditems/cc2.png" },
      { id: "brownie-cold-coffee", name: "Brownie", description: "Cold coffee blended with ice cream and chunks of fudgy brownie.", price: 259, diet: "veg", image: "/fooditems/cc3.png" },
      { id: "choco-cold-coffee", name: "Choco", description: "Cold coffee blended with ice cream and rich chocolate.", price: 259, diet: "veg", image: "/fooditems/cc4.png" },
      { id: "classic-cold-coffee", name: "Classic Cold Coffee", description: "The original — cold coffee blended smooth with ice cream.", price: 229, diet: "veg", image: "/fooditems/cc5.png" },
      { id: "irish-cold-coffee", name: "Irish", description: "Cold coffee blended with ice cream and a warm Irish coffee twist.", price: 259, diet: "veg", image: "/fooditems/cc6.png" },
      { id: "lotus-biscoff-cold-coffee", name: "Lotus Biscoff", description: "Cold coffee blended with ice cream and caramelized Biscoff.", price: 279, diet: "veg", image: "/fooditems/cc7.png" },
      { id: "nutella-cold-coffee", name: "Nutella", description: "Cold coffee blended with ice cream and rich Nutella.", price: 279, diet: "veg", image: "/fooditems/cc8.png" },
      { id: "oreo-cold-coffee", name: "Oreo", description: "Cold coffee blended with ice cream and crushed Oreo cookies.", price: 279, diet: "veg", image: "/fooditems/cc9.png" },
      { id: "peanut-butter-cold-coffee", name: "Peanut Butter", description: "Cold coffee blended with ice cream and smooth peanut butter.", price: 279, diet: "veg", image: "/fooditems/cc10.png" },
    ],
  },
  {
    id: "hot-coffee",
    title: "Hot Coffee",
    items: [
      { id: "espresso", name: "Espresso (Single/Double)", description: "A concentrated shot of freshly pulled espresso.", price: 109, diet: "veg", image: "/fooditems/hc1.png" },
      { id: "americano-black-coffee", name: "Americano (Black Coffee)", description: "Espresso lengthened with hot water for a smooth black coffee.", price: 199, diet: "veg", image: "/fooditems/hc2.png" },
      { id: "cappuccino", name: "Cappuccino (Single/Double)", description: "Espresso topped with steamed milk and a thick layer of foam.", price: 239, diet: "veg", image: "/fooditems/hc3.png" },
      { id: "cafe-latte", name: "Cafe Latte (Single/Double)", description: "Espresso balanced with generous steamed milk.", price: 219, diet: "veg", image: "/fooditems/hc4.png" },
      { id: "flat-white", name: "Flat White", description: "Espresso with velvety micro-foamed milk for a smooth finish.", price: 219, diet: "veg", image: "/fooditems/hc5.png" },
      { id: "hot-irish-black-coffee", name: "Hot Irish Black Coffee", description: "Bold black coffee with a warm hint of Irish spice.", price: 239, diet: "veg", image: "/fooditems/hc6.png" },
      { id: "hazelnut-mocha", name: "Hazelnut Mocha", description: "Espresso, chocolate and steamed milk with a nutty hazelnut twist.", price: 249, diet: "veg", image: "/fooditems/hc7.png" },
      { id: "cortado", name: "Cortado (Small Cappuccino)", description: "A small, strong cortado balancing espresso and warm milk.", price: 179, diet: "veg", image: "/fooditems/hc8.png" },
      { id: "cinnamon-cappuccino", name: "Cinnamon Cappuccino", description: "Classic cappuccino dusted with warm ground cinnamon.", price: 249, diet: "veg", image: "/fooditems/hc9.png" },
      { id: "hot-cinnamon-mocha", name: "Hot Cinnamon Mocha", description: "Chocolate and espresso finished with a warm cinnamon spice.", price: 250, diet: "veg", image: "/fooditems/hc10.png" },
      { id: "cafe-mocha", name: "Cafe Mocha", description: "Espresso and chocolate blended with steamed milk.", price: 239, diet: "veg", image: "/fooditems/hc11.png" },
      { id: "caramel-cappuccino", name: "Caramel Cappuccino", description: "Classic cappuccino layered with sweet caramel.", price: 249, diet: "veg", image: "/fooditems/hc12.png" },
      { id: "caramel-mocha", name: "Caramel Mocha", description: "Espresso, chocolate and caramel topped with steamed milk.", price: 239, diet: "veg", image: "/fooditems/hc13.png" },
      { id: "irish-cappuccino", name: "Irish Cappuccino", description: "Classic cappuccino finished with a warm Irish coffee twist.", price: 249, diet: "veg", image: "/fooditems/hc14.png" },
      { id: "vanilla-cappuccino", name: "Vanilla Cappuccino", description: "Classic cappuccino sweetened with smooth vanilla syrup.", price: 249, diet: "veg", image: "/fooditems/hc15.png" },
      { id: "hot-chocolate-regular", name: "Regular", description: "Rich, warm hot chocolate made with melted chocolate and milk.", price: 249, diet: "veg", image: "/fooditems/hc16.png" },
      { id: "hot-chocolate-brownie", name: "Brownie", description: "Warm hot chocolate topped with chunks of fudgy brownie.", price: 279, diet: "veg", image: "/fooditems/hc17.png" },
      { id: "hot-chocolate-nutella", name: "Nutella", description: "Warm hot chocolate swirled with rich Nutella.", price: 279, diet: "veg", image: "/fooditems/hc18.png" },
    ],
  },
  {
    id: "hot-tea",
    title: "Hot Tea",
    items: [
      { id: "chamomile-tea", name: "Chamomile Tea", description: "A soothing, floral chamomile tea served hot.", price: 159, diet: "veg", image: "/fooditems/ht1.png" },
      { id: "ginger-lemon-tea", name: "Ginger Lemon Tea", description: "Warm tea infused with zesty ginger and fresh lemon.", price: 149, diet: "veg", image: "/fooditems/ht2.png" },
      { id: "green-matcha-vanilla-tea", name: "Green Matcha Vanilla Tea", description: "Earthy matcha tea sweetened with smooth vanilla.", price: 199, diet: "veg", image: "/fooditems/ht3.png" },
      { id: "lemon-tea", name: "Lemon Tea", description: "Classic hot tea brightened with fresh lemon.", price: 149, diet: "veg", image: "/fooditems/ht4.png" },
    ],
  },
  // ===================== EXISTING CATEGORIES =====================
  {
    id: "mojitos",
    title: "Mojitos",
    items: [
      { id: "cranberry-sparkler-mocktail", name: "Cranberry Sparkler Mocktail", description: "Tart cranberry and fresh mint muddled with a fizzy citrus finish.", price: 249, diet: "veg", image: "/fooditems/mj1.png" },
      { id: "blueberry-mojito", name: "Blueberry Mojito", description: "Muddled blueberries and mint over crushed ice with a soda splash.", price: 229, diet: "veg", image: "/fooditems/mj2.png" },
      { id: "blue-lagoon-mojito", name: "Blue Lagoon", description: "Vibrant blue curaçao mocktail with mint and a citrus sparkle.", price: 239, diet: "veg", image: "/fooditems/mj3.png" },
      { id: "fruit-punch-mojito", name: "Fruit Punch Mojito", description: "A lively medley of tropical fruits, mint and soda over ice.", price: 239, diet: "veg", image: "/fooditems/mj4.png" },
      { id: "green-apple-mojito", name: "Green Apple Mojito", description: "Crisp green apple and muddled mint with a refreshing fizzy lift.", price: 229, diet: "veg", image: "/fooditems/mj5.png" },
      { id: "kiwi-mojito", name: "Kiwi Mojito", description: "Fresh kiwi muddled with mint and lime for a zesty sip.", price: 229, diet: "veg", image: "/fooditems/mj6.png" },
      { id: "lime-mojito", name: "Lime Mojito", description: "The classic — fresh lime, mint and soda over crushed ice.", price: 219, diet: "veg", image: "/fooditems/mj7.png" },
      { id: "mango-mojito", name: "Mango Mojito", description: "Ripe mango pulp muddled with mint and a citrus soda top-up.", price: 239, diet: "veg", image: "/fooditems/mj8.png" },
      { id: "orange-mojito", name: "Orange Mojito", description: "Fresh orange and mint muddled with a bright, tangy fizz.", price: 229, diet: "veg", image: "/fooditems/mj9.png" },
      { id: "peach-mojito", name: "Peach Mojito", description: "Juicy peach muddled with mint and lime for a summery sip.", price: 229, diet: "veg", image: "/fooditems/mj10.png" },
      { id: "strawberry-mojito", name: "Strawberry Mojito", description: "Muddled strawberries, mint and lime topped with chilled soda.", price: 239, diet: "veg", image: "/fooditems/mj11.png" },
    ],
  },
  {
    id: "shakes",
    title: "Shakes",
    items: [
      { id: "nutella-shake", name: "Nutella Shake", description: "Rich Nutella blended with vanilla ice cream into a velvety shake.", price: 259, diet: "veg", image: "/fooditems/sh1.png" },
      { id: "banana-almond-shake", name: "Banana & Almond Shake", description: "Creamy banana blended with almonds for a nutty, wholesome shake.", price: 279, diet: "veg", image: "/fooditems/sh2.png" },
      { id: "blueberry-shake", name: "Blueberry Shake", description: "Fresh blueberries blended with ice cream into a fruity, creamy shake.", price: 249, diet: "veg", image: "/fooditems/sh3.png" },
      { id: "brownie-shake", name: "Brownie Shake", description: "Chunks of fudgy brownie blended into a thick, indulgent shake.", price: 279, diet: "veg", image: "/fooditems/sh4.png" },
      { id: "chocolate-shake", name: "Chocolate Shake", description: "Classic rich chocolate blended smooth with creamy vanilla ice cream.", price: 249, diet: "veg", image: "/fooditems/sh5.png" },
      { id: "kitkat-shake", name: "KitKat Shake", description: "Crushed KitKat blended into a chocolatey, crunchy-smooth shake.", price: 249, diet: "veg", image: "/fooditems/sh6.png" },
      { id: "kiwi-shake", name: "Kiwi Shake", description: "Fresh kiwi blended with ice cream for a tangy, creamy treat.", price: 249, diet: "veg", image: "/fooditems/sh7.png" },
      { id: "lotus-biscoff-shake", name: "Lotus Biscoff Shake", description: "Caramelized Biscoff cookies blended into a spiced, creamy shake.", price: 279, diet: "veg", image: "/fooditems/sh8.png" },
      { id: "mango-shake", name: "Mango Shake", description: "Sweet ripe mango blended with ice cream into a tropical shake.", price: 249, diet: "veg", image: "/fooditems/sh9.png" },
      { id: "nutella-brownie-shake", name: "Nutella Brownie Shake", description: "Fudgy brownie and Nutella blended into a decadent double treat.", price: 279, diet: "veg", image: "/fooditems/sh10.png" },
      { id: "oreo-shake", name: "Oreo Shake", description: "Crushed Oreo cookies blended into a creamy, chocolatey shake.", price: 249, diet: "veg", image: "/fooditems/sh11.png" },
      { id: "peanut-banana-almond-shake", name: "Peanut & Banana Almond Shake", description: "Banana, almond and peanut blended into a rich, nutty shake.", price: 289, diet: "veg", image: "/fooditems/sh12.png" },
      { id: "peanut-butter-shake", name: "Peanut Butter Shake", description: "Smooth peanut butter blended with ice cream into a nutty shake.", price: 249, diet: "veg", image: "/fooditems/sh13.png" },
      { id: "raspberry-shake", name: "Raspberry Shake", description: "Tart raspberries blended with ice cream for a fruity, creamy shake.", price: 249, diet: "veg", image: "/fooditems/sh14.png" },
      { id: "strawberry-shake", name: "Strawberry Shake", description: "Fresh strawberries blended with vanilla ice cream into a classic shake.", price: 249, diet: "veg", image: "/fooditems/sh15.png" },
      { id: "caramel-popcorn-shake", name: "Caramel Popcorn Shake", description: "Sweet caramel popcorn blended into a fun, indulgent dessert shake.", price: 259, diet: "veg", image: "/fooditems/sh16.png" },
    ],
  },
  {
    id: "appetizers",
    title: "Appetizers",
    items: [
      { id: "paneer-ghee-roast", name: "Paneer Ghee Roast", description: "Pan-seared paneer tossed in a fiery, ghee-roasted spice blend.", price: 409, diet: "veg", image: "/fooditems/ap1.png" },
      { id: "cheese-french-fries", name: "Cheese French Fries", description: "Golden fries loaded with melted cheese for a comforting bite.", price: 219, diet: "veg", image: "/fooditems/ap2.png" },
      { id: "french-fries", name: "French Fries", description: "Classic crispy golden fries, lightly salted and served hot.", price: 209, diet: "veg", image: "/fooditems/ap3.png" },
      { id: "masala-french-fries", name: "Masala French Fries", description: "Crispy fries tossed in a bold, tangy masala spice mix.", price: 219, diet: "veg", image: "/fooditems/ap4.png" },
      { id: "maxibrew-special-zucchini-fries", name: "Maxibrew Special Zucchini Fries", description: "Crisp-fried zucchini batons with our house special seasoning.", price: 219, diet: "veg", image: "/fooditems/ap5.png" },
      { id: "peri-peri-french-fries", name: "Peri Peri French Fries", description: "Golden fries tossed in fiery, tangy peri peri seasoning.", price: 229, diet: "veg", image: "/fooditems/ap6.png" },
      { id: "peri-peri-potato-wedges", name: "Peri Peri Potato Wedges", description: "Thick-cut potato wedges roasted with zesty peri peri spice.", price: 239, diet: "veg", image: "/fooditems/ap7.png" },
      { id: "potato-wedges", name: "Potato Wedges", description: "Crispy-edged, fluffy-centred potato wedges, seasoned and golden fried.", price: 219, diet: "veg", image: "/fooditems/ap8.png" },
      { id: "veg-paprika-cheese-balls", name: "Veg Paprika Cheese Balls", description: "Molten cheese balls dusted with smoky paprika, fried till golden.", price: 249, diet: "veg", image: "/fooditems/ap9.png" },
      { id: "bbq-sweet-chicken-wings", name: "BBQ Sweet Chicken Wings", description: "Juicy chicken wings glazed in a smoky-sweet barbecue sauce.", price: 319, diet: "non-veg", image: "/fooditems/ap10.png" },
      { id: "chicken-and-cheese-balls", name: "Chicken and Cheese Balls", description: "Crispy fried balls of minced chicken and melted cheese.", price: 299, diet: "non-veg", image: "/fooditems/ap11.png" },
      { id: "fish-and-chips", name: "Fish & Chips", description: "Golden battered fish fillet served with crisp, salted fries.", price: 399, diet: "non-veg", image: "/fooditems/ap12.png" },
      { id: "honey-chilli-chicken-wings", name: "Honey Chilli Chicken Wings", description: "Crispy wings glazed in a sweet-spicy honey chilli coating.", price: 319, diet: "non-veg", image: "/fooditems/ap13.png" },
      { id: "mangalorean-chicken-ghee-roast", name: "Mangalorean Chicken Ghee Roast", description: "Fiery Mangalorean-style chicken roasted in aromatic ghee and spices.", price: 459, diet: "non-veg", image: "/fooditems/ap14.png" },
      { id: "peri-peri-spicy-chicken-wings", name: "Peri Peri Spicy Chicken Wings", description: "Chicken wings tossed in bold, fiery peri peri seasoning.", price: 319, diet: "non-veg", image: "/fooditems/ap15.png" },
    ],
  },
  {
    id: "bread",
    title: "Bread",
    items: [
      { id: "cheese-garlic-bread", name: "Cheese Garlic Bread", description: "Toasted garlic bread loaded with a generous layer of melted cheese.", price: 119, diet: "veg", image: "/fooditems/br1.png" },
      { id: "garlic-bread", name: "Garlic Bread", description: "Toasted bread brushed with garlic butter and herbs.", price: 99, diet: "veg", image: "/fooditems/br2.png" },
    ],
  },
  {
    id: "burgers",
    title: "Burgers",
    items: [
      { id: "bbq-chicken-burger", name: "BBQ Chicken Burger", description: "Grilled chicken patty glazed with smoky BBQ sauce, served with fries.", price: 279, diet: "non-veg", image: "/fooditems/bg1.png" },
      { id: "maxi-brew-special-chicken-burger", name: "Maxi Brew Spl Chicken Burger", description: "Our signature chicken burger with house sauce, served with fries.", price: 279, diet: "non-veg", image: "/fooditems/bg2.png" },
      { id: "mushroom-and-cheese-burger", name: "Mushroom & Cheese Burger", description: "A savoury mushroom patty topped with melted cheese, served with fries.", price: 239, diet: "veg", image: "/fooditems/bg3.png" },
      { id: "paneer-tikka-burger", name: "Paneer Tikka Burger", description: "Smoky tikka-spiced paneer patty in a soft bun, served with fries.", price: 259, diet: "veg", image: "/fooditems/bg4.png" },
    ],
  },
  {
    id: "large-plate",
    title: "Large Plate",
    items: [
      { id: "butter-garlic-prawns-with-mashed-potato", name: "Butter Garlic Prawns with Mashed Potato", description: "Succulent prawns sautéed in butter garlic sauce with creamy mash.", price: 489, diet: "non-veg", image: "/fooditems/lp1.png" },
      { id: "chicken-with-herb-rice", name: "Chicken with Herb Rice", description: "Tender grilled chicken served over fragrant, herb-infused rice.", price: 479, diet: "non-veg", image: "/fooditems/lp2.png" },
      { id: "fish-with-herb-rice", name: "Fish with Herb Rice", description: "Pan-seared fish fillet paired with aromatic herb-infused rice.", price: 489, diet: "non-veg", image: "/fooditems/lp3.png" },
      { id: "grilled-fish-in-butter-garlic-sauce", name: "Grilled Fish in Butter Garlic Sauce", description: "Flaky grilled fish finished in a rich butter garlic sauce.", price: 499, diet: "non-veg", image: "/fooditems/lp4.png" },
      { id: "spicy-cajun-grilled-chicken", name: "Spicy Cajun Grilled Chicken", description: "Chicken breast rubbed in bold Cajun spice and char-grilled.", price: 459, diet: "non-veg", image: "/fooditems/lp5.png" },
    ],
  },
  {
    id: "pasta",
    title: "Pasta",
    items: [
      { id: "chicken-penne-in-spinach-alfredo-pasta", name: "Chicken Penne in Spinach Alfredo Pasta", description: "Penne and tender chicken tossed in a creamy spinach Alfredo sauce.", price: 419, diet: "non-veg", image: "/fooditems/ps1.png" },
      { id: "chicken-spaghetti-in-spinach-alfredo-pasta", name: "Chicken Spaghetti in Spinach Alfredo Pasta", description: "Spaghetti and chicken coated in a rich spinach Alfredo sauce.", price: 389, diet: "non-veg", image: "/fooditems/ps2.png" },
      { id: "chicken-penne-pasta", name: "Chicken Penne Pasta", description: "Penne pasta tossed with tender chicken in a classic sauce.", price: 389, diet: "non-veg", image: "/fooditems/ps3.png" },
      { id: "maxibrew-special-handmade-gnocchi-pasta", name: "Maxibrew Special Handmade Gnocchi Pasta", description: "Soft handmade gnocchi tossed in our house special signature sauce.", price: 319, diet: "veg", image: "/fooditems/ps4.png" },
      { id: "spaghetti-mushroom-aglio-olio-chicken", name: "Spaghetti Mushroom Aglio Olio Chicken", description: "Spaghetti tossed with chicken, mushroom, garlic and olive oil.", price: 399, diet: "non-veg", image: "/fooditems/ps5.png" },
      { id: "veg-penne-in-spinach-alfredo-pasta", name: "Veg Penne in Spinach Alfredo Pasta", description: "Penne pasta tossed in a creamy spinach Alfredo sauce.", price: 349, diet: "veg", image: "/fooditems/ps6.png" },
      { id: "veg-spaghetti-in-spinach-alfredo-pasta", name: "Veg Spaghetti in Spinach Alfredo Pasta", description: "Spaghetti coated in a rich, creamy spinach Alfredo sauce.", price: 349, diet: "veg", image: "/fooditems/ps7.png" },
      { id: "veg-penne-pasta", name: "Veg Penne Pasta", description: "Classic penne pasta tossed in a flavourful house sauce.", price: 329, diet: "veg", image: "/fooditems/ps8.png" },
    ],
  },
  {
    id: "salads",
    title: "Salads",
    items: [
      { id: "cesar-salad", name: "Cesar Salad", description: "Crisp romaine lettuce tossed in classic Caesar dressing and croutons.", price: 249, diet: "veg", image: "/fooditems/sl1.png" },
      { id: "grilled-chicken-salad", name: "Grilled Chicken Salad", description: "Fresh greens topped with tender, char-grilled chicken slices.", price: 359, diet: "non-veg", image: "/fooditems/sl2.png" },
    ],
  },
  {
    id: "desserts",
    title: "Desserts",
    items: [
      { id: "plain-brownie", name: "Plain Brownie", description: "A rich, fudgy chocolate brownie baked to a dense, gooey finish.", price: 149, diet: "veg", image: "/fooditems/ds1.png" },
      { id: "affogato", name: "Affogato", description: "Vanilla ice cream drowned in a shot of hot espresso.", price: 199, diet: "veg", image: "/fooditems/ds2.png" },
      { id: "brownie-with-ice-cream-and-chocolate-syrup", name: "Brownie with Ice Cream & Chocolate Syrup", description: "Warm fudgy brownie topped with ice cream and chocolate syrup.", price: 199, diet: "veg", image: "/fooditems/ds3.png" },
      { id: "chocolate-waffle", name: "Chocolate Waffle", description: "Crisp golden waffle drizzled generously with warm chocolate sauce.", price: 229, diet: "veg", image: "/fooditems/ds4.png" },
      { id: "nutella-waffle", name: "Nutella Waffle", description: "Golden waffle layered with rich, silky Nutella spread.", price: 259, diet: "veg", image: "/fooditems/ds5.png" },
    ],
  },
  {
    id: "water-bottle",
    title: "Water Bottle",
    items: [
      { id: "water-bottle", name: "Water Bottle", description: "Chilled packaged drinking water.", price: 20, diet: "veg", image: "/fooditems/wb1.png" },
    ],
  },
  {
    id: "small-bites",
    title: "Small Bites",
    items: [
      { id: "cheese-loaded-nachos", name: "Cheese Loaded Nachos", description: "Crunchy nachos piled high with generous melted cheese.", price: 189, diet: "veg", image: "/fooditems/sb1.png" },
    ],
  },
  {
    id: "add-ons",
    title: "Add Ons",
    items: [
      { id: "extra-parota", name: "Extra Parota", description: "An additional flaky, layered parota served on the side.", price: 59, diet: "veg", image: "/fooditems/ao1.png" },
      { id: "ice-cream-scoop", name: "Ice Cream Scoop", description: "A single scoop of creamy vanilla ice cream.", price: 69, diet: "veg", image: "/fooditems/ao2.png" },
    ],
  },
];

// Flatten into MenuItem documents
function buildMenuItemDocs() {
  const docs = [];
  rawMenu.forEach((category, categoryIdx) => {
    category.items.forEach((item, idx) => {
      docs.push({
        id: item.id,
        restaurantId: RESTAURANT_ID,
        categoryId: category.id,
        categoryTitle: category.title,
        categorySortOrder: categoryIdx,
        name: item.name,
        description: item.description,
        price: item.price,
        diet: item.diet,
        image: item.image,
        isAvailable: true,
        sortOrder: idx,
      });
    });
  });
  return docs;
}

module.exports = { RESTAURANT_ID, buildMenuItemDocs };