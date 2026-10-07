export const restaurant = {
  name: "Chennai Palace",
  phone: "08 7086 6880",
  phoneHref: "tel:+61870866880",
  address: "550 North East Road",
  locality: "Holden Hill, SA 5088",
  maps: "https://www.google.com/maps/search/?api=1&query=Chennai+Palace+550+North+East+Road+Holden+Hill+SA+5088",
  description: "South Indian favourites, Chettinadu curries and aromatic biryani. Discover Chennai Palace in Holden Hill, Adelaide, for dining, takeaway and celebrations.",
  hours: [
    { day: "Monday, Wednesday & Thursday", time: "5:00 pm – 10:00 pm" },
    { day: "Friday & Saturday", time: "12:00 pm – 2:30 pm / 5:00 pm – 10:00 pm" },
    { day: "Sunday", time: "5:00 pm – 10:00 pm" },
  ],
};

export const navigation = [
  { label: "Our story", href: "/#story" },
  { label: "The menu", href: "/menu" },
  { label: "Experiences", href: "/#experiences" },
  { label: "Visit us", href: "/#visit" },
];

export const signatures = [
  { number: "01", label: "FROM THE GRIDDLE", title: "Golden. Crisp. Classic.", description: "Dosa, idli and vada. South Indian favourites, with sambar and chutneys ready at the table.", image: "/images/dosa.webp", alt: "Golden dosa with sambar, chutneys, idli and vada", href: "/menu?category=dosa", link: "Discover South Indian" },
  { number: "02", label: "FROM THE SPICE KITCHEN", title: "A feast worth sharing.", description: "Chettinadu curries, aromatic biryani and warm naan. Generous flavours for good company.", image: "/images/feast.webp", alt: "A feast of chicken biryani, Chettinadu curry and naan", href: "/menu?category=curries", link: "Explore our curries" },
  { number: "03", label: "ONE LAST POUR", title: "Stay a little longer.", description: "A South Indian filter coffee, something sweet, and a little more time around the table.", image: "/images/coffee.webp", alt: "South Indian filter coffee poured into a traditional tumbler", href: "/menu?category=desserts", link: "Find your sweet finish" },
];

export const experiences = [
  { title: "At our table", label: "DINE IN", description: "Settle in for South Indian specialities and Indian classics, served at your table. Come for a favourite. Stay for another conversation.", action: "Book a table", image: "/images/feast.webp" },
  { title: "Good food. Your people.", label: "GROUP DINING", description: "Bring family, friends or colleagues together over a meal made for sharing. Call ahead and let us help plan your gathering.", action: "Plan a group visit", image: "/images/dosa.webp" },
  { title: "Make an occasion of it.", label: "CELEBRATIONS & CATERING", description: "Birthdays, family gatherings and special occasions deserve a memorable table. Speak to us about our function space and catering.", action: "Enquire about your event", image: "/images/feast.webp" },
  { title: "A little Palace, at home.", label: "TAKEAWAY", description: "Your favourite dishes, wherever your evening takes you. Explore the menu and call the restaurant to arrange your takeaway order.", action: "Call to order", image: "/images/dosa.webp" },
];
