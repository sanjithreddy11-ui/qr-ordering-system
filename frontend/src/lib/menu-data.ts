export type Diet = "veg" | "non-veg";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  diet: Diet;
  image: string;
}

export interface MenuCategory {
  id: string;
  title: string;
  items: MenuItem[];
}

export const menu: MenuCategory[] = [
  {
    id: "starters",
    title: "Starters",
    items: [
      {
        id: "chicken-popcorn",
        name: "Chicken PopCorn",
        description:
          "Crispy bite-sized chicken pieces tossed in our house special spices.",
        price: 329,
        diet: "non-veg",
        image: "/fooditems/starter1.png",
      },
      {
        id: "nachos-chicken",
        name: "Nachos Chicken",
        description:
          "Crispy nachos topped with chicken, cheese and our signature sauce.",
        price: 309,
        diet: "non-veg",
        image: "/fooditems/s2.png",
      },
      {
        id: "prawns-lemon-garlic",
        name: "Prawns Lemon Garlic",
        description: "Succulent prawns tossed with garlic, lemon and herbs.",
        price: 329,
        diet: "non-veg",
        image: "/fooditems/s3.png",
      },
      {
        id: "Lime basil chicken",
        name: "Lime Basil Chicken",
        description: "Tender chicken pieces cooked in a vibrant sauce infused with lime and basil.",
        price: 309,
        diet: "non-veg",
        image: "/fooditems/s4.png",
      },

    ],
  },
  {
    id: "mains",
    title: "Main Dishes",
    items: [
      {
        id: "Chicken-lasagne",
        name: "Chicken Lasagne",
        description:
          "Layered pasta baked with shredded chicken, béchamel sauce, and a blend of cheeses.",
        price: 419,
        diet: "non-veg",
        image: "/fooditems/m1.png",
      },
      {
        id: "Nasi Goreng",
        name: "Nasi Goreng",
        description: "Fried rice with a delightful mix of vegetables and spices.",
        price: 379,
        diet: "non-veg",
        image: "/fooditems/m2.png",
      },
       {
        id: "Paneer Afghani with Ghee Rice",
        name: "Paneer Afghani with Ghee Rice",
        description: "Aromatic rice dish with tender paneer in a rich, spiced sauce.",
        price: 379,
        diet: "non-veg",
        image: "/fooditems/m3.png",
      },
       {
        id: "Thai Chicken Curry with Jasmine Rice",
        name: "Thai Chicken Curry with Jasmine Rice",
        description: "Fragrant red curry, tender chicken and jasmine rice, infused with Thai herbs and spices.",
        price: 419,
        diet: "non-veg",
        image: "/fooditems/m4.png",
      },

    ],
  },
  {
    id: "desserts",
    title: "Desserts",
    items: [
      {
        id: "Brownie With Ice Cream",
        name: "Brownie With Ice Cream",
        description: "Rich chocolate brownie served with a scoop of vanilla ice cream.",
        price: 219,
        diet: "veg",
        image: "/fooditems/d1.png",
      },
      {
        id: "Apricot Delight",
        name: "Apricot Delight",
        description: "A delightful blend of apricot and vanilla ice cream.",
        price: 219,
        diet: "veg",
        image: "/fooditems/d2.png",
      },
      {
        id: "San Sebastian Cheesecake",
        name: "San Sebastian Cheesecake",
        description: "A creamy cheesecake with a hint of vanilla and a crispy crust.",
        price: 359,
        diet: "veg",
        image: "/fooditems/d3.png",
      },
      {
        id: "Nutella Cheesecake",
        name: "Nutella Cheesecake",
        description: "A decadent cheesecake infused with rich Nutella and a crispy crust.",
        price: 239,
        diet: "veg",
        image: "/fooditems/d4.png",
      },
    ],
  },
  {
    id: "beverages",
    title: "Beverages",
    items: [
      {
        id: "Blueberry Bubble Tea",
        name: "Blueberry Bubble Tea",
        description: "A refreshing blend of blueberry syrup and bubble tea  .",
        price: 269,
        diet: "veg",
        image: "/fooditems/b1.png",
      },
       {
        id: "Virgin Mojito",
        name: "Virgin Mojito",
        description: "A refreshing blend of mint, lime, and bubble tea.",
        price: 219,
        diet: "veg",
        image: "/fooditems/b2.png",
      },
       {
        id: "Nutella Cold Coffee",
        name: "Nutella Cold Coffee",
        description: "A delicious blend of Nutella and cold coffee.",
        price: 289,
        diet: "veg",
        image: "/fooditems/b3.png",
      },
       {
        id: "Orange Juice (Cold-Pressed)",
        name: "Orange Juice (Cold-Pressed)",
        description: "A refreshing blend of fresh orange juice, cold-pressed.",
        price: 199,
        diet: "veg",
        image: "/fooditems/b4.png",
      },
    ],
  },
];
