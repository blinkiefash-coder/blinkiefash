const BRAND_BANNER_FALLBACKS = {
  puma: 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1788755316/ChatGPT_Image_Sep_6_2026_09_26_23_AM_vsxsjn.png',
  'dhanista boutique': 'https://res.cloudinary.com/vu2qpoeq/image/upload/v1787657759/file_00000000eae882079e6b5c085825a239.png',
  fcuk: 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1788773474/file_00000000bb6881fbb527b24d809c28cb_tzhzpj.png',
  mk: 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1788755317/ChatGPT_Image_Sep_6_2026_10_10_52_AM_iyv2vm.png',
};

function normalizeBrandName(value) {
  return (value || '').toString().toLowerCase().replace(/\./g, '').trim();
}

export function getBrandBanner(brand) {
  return (
    brand?.banner_url ||
    brand?.banner ||
    brand?.cover_image ||
    BRAND_BANNER_FALLBACKS[normalizeBrandName(brand?.name)] ||
    null
  );
}