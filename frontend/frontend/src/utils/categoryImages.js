export const CATEGORY_IMAGE_RULES = [
  { keys: ['women', 'ethnic'], img: '/images/Womenethnic.png' },
  { keys: ['women', 'top'], img: '/images/womentopwear.png' },
  { keys: ['men', 'top'], img: '/images/Menstopwear.png' },
  { keys: ['ethnic'], img: '/images/Ethnicwear.png' },
  { keys: ['dress'], img: '/images/dresses.png' },
  { keys: ['bottom'], img: '/images/bottomwear.png' },
  { keys: ['bag'], img: '/images/handbag.png' },
  { keys: ['beauty'], img: '/images/beauty.png' },
  { keys: ['shoe'], img: '/images/shoes.png' },
  { keys: ['footwear'], img: '/images/shoes.png' },
  { keys: ['jewel'], img: '/images/J.png' },
  { keys: ['travel'], img: '/images/travel.png' },
  { keys: ['decor'], img: '/images/homeliving.png' },
  { keys: ['home'], img: '/images/homeliving.png' },
  { keys: ['kid'], img: '/images/kids-section.png' },
  { keys: ['accessor'], img: '/images/Accesories-section.png' },
  { keys: ['men'], img: '/images/Men-section.png' },
  { keys: ['women'], img: '/images/Women-section.png' },
];

export function getCategoryImage(name = '') {
  const lower = name.toLowerCase();
  const match = CATEGORY_IMAGE_RULES.find((rule) => rule.keys.every((k) => lower.includes(k)));
  return match?.img || null;
}
