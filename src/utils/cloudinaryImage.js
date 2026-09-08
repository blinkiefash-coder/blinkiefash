// Builds Cloudinary transformation URLs so product images are served at the
// size/format/density they're actually displayed at, instead of the raw
// vendor upload. No-ops for any URL that isn't a Cloudinary /upload/ URL
// (e.g. relative API paths, external placeholder images) so it's safe to
// wrap every product image call site with this.

const CLOUDINARY_UPLOAD_MARKER = '/upload/';

function insertTransform(url, transform) {
  if (!url || typeof url !== 'string') return url;
  const idx = url.indexOf(CLOUDINARY_UPLOAD_MARKER);
  if (idx === -1) return url;
  const insertAt = idx + CLOUDINARY_UPLOAD_MARKER.length;
  return `${url.slice(0, insertAt)}${transform}/${url.slice(insertAt)}`;
}

/**
 * Single responsive product-card image URL.
 * f_auto  -> best format for the requesting browser (WebP/AVIF)
 * q_auto  -> perceptual quality auto-compression
 * c_fill,g_auto -> crop to the target box using content-aware gravity
 * dpr_auto -> serves 2x/3x pixel density on retina screens automatically
 */
export function productImageUrl(url, width, height) {
  if (!url) return url;
  const h = height || Math.round(width * (4 / 3));
  return insertTransform(url, `f_auto,q_auto,c_fill,g_auto,w_${width},h_${h},dpr_auto`);
}

/**
 * srcSet string across a few common card widths so the browser picks the
 * smallest asset that still covers the rendered box * device pixel ratio.
 */
export function productImageSrcSet(url, widths = [240, 320, 400, 600]) {
  if (!url) return undefined;
  return widths.map((w) => `${productImageUrl(url, w)} ${w}w`).join(', ');
}

/**
 * Non-cropped variant (object-fit: contain use cases, e.g. flat lay /
 * full-garment shots where cropping would cut off the product).
 */
export function productImageUrlContain(url, width, height) {
  if (!url) return url;
  const h = height || width;
  return insertTransform(url, `f_auto,q_auto,c_fit,w_${width},h_${h},dpr_auto`);
}

export function productImageSrcSetContain(url, widths = [240, 320, 400, 600], ratio = 4 / 3) {
  if (!url) return undefined;
  return widths
    .map((w) => `${productImageUrlContain(url, w, Math.round(w * ratio))} ${w}w`)
    .join(', ');
}