import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Loader from '../components/Loader';
import { getProductById } from '../api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import './ProductDetail.css';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [data, setData] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getProductById(id)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setSelectedVariant(res.variants?.[0] || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load this product');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <div className="page"><Loader label="Loading product..." /></div>;
  if (error) return <div className="page"><p className="state-msg">{error}</p></div>;
  if (!data) return null;

  const { product, images, variants } = data;
  const price = Number(selectedVariant?.discount_price ?? product.price ?? 0);
  const mrp = Number(selectedVariant?.price ?? price);
  const wishlisted = isWishlisted(product.id);
  const gallery = images?.length ? images : [{ url: null }];

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id || null,
      name: product.name,
      image: gallery[0]?.url,
      price,
      size: selectedVariant?.size,
      color: selectedVariant?.color,
    });
  };

  return (
    <div className="page product-detail-page">
      <button type="button" className="pd-back" onClick={() => navigate(-1)}>
        &larr; Back
      </button>

      <div className="pd-gallery">
        {gallery[activeImage]?.url ? (
          <img src={gallery[activeImage].url} alt={product.name} />
        ) : (
          <div className="pd-placeholder">No image available</div>
        )}
      </div>

      {gallery.length > 1 && (
        <div className="pd-thumbs">
          {gallery.map((img, idx) => (
            <button
              key={img.url || idx}
              type="button"
              className={`pd-thumb${idx === activeImage ? ' active' : ''}`}
              onClick={() => setActiveImage(idx)}
            >
              {img.url && <img src={img.url} alt="" />}
            </button>
          ))}
        </div>
      )}

      <div className="pd-info">
        {product.brand && <p className="pd-brand">{product.brand}</p>}
        <h1>{product.name}</h1>
        <div className="pd-price-row">
          <span className="pd-price">₹{price}</span>
          {mrp > price && <span className="pd-mrp">₹{mrp}</span>}
        </div>

        {variants?.length > 0 && (
          <div className="pd-variants">
            <p className="pd-label">Select size</p>
            <div className="pd-variant-list">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`pd-variant-chip${selectedVariant?.id === v.id ? ' active' : ''}${
                    v.available_stock <= 0 ? ' disabled' : ''
                  }`}
                  disabled={v.available_stock <= 0}
                  onClick={() => setSelectedVariant(v)}
                >
                  {v.size || v.color || 'Default'}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.description && <p className="pd-description">{product.description}</p>}

        <div className="pd-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              toggleWishlist({
                productId: product.id,
                name: product.name,
                image: gallery[0]?.url,
                price,
              })
            }
          >
            {wishlisted ? '♥ Wishlisted' : '♡ Wishlist'}
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={variants?.length > 0 && !selectedVariant}
            onClick={handleAddToCart}
          >
            Add to cart
          </button>
        </div>
        <button
          type="button"
          className="primary-btn pd-buy-now"
          disabled={variants?.length > 0 && !selectedVariant}
          onClick={() => {
            handleAddToCart();
            navigate('/checkout');
          }}
        >
          Buy now
        </button>
      </div>
    </div>
  );
}
