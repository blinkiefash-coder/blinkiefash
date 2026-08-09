import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';
import { getProducts } from '../api';
import '../components/ProductCard.css';
import './Shop.css';

export default function Shop() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categoryId = searchParams.get('category_id') || '';
  const search = searchParams.get('search') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const sort = searchParams.get('sort') || '';

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    getProducts({ category_id: categoryId, search, max_price: maxPrice, sort, limit: 40 })
      .then((data) => {
        if (!cancelled) setProducts(data.products || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load products');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId, search, maxPrice, sort]);

  return (
    <div className="page shop-page">
      <AppHeader />
      <div className="shop-title">
        <h2>{search ? `Results for "${search}"` : 'All products'}</h2>
        <span>{products.length} items</span>
      </div>

      {loading && <Loader label="Loading products..." />}
      {!loading && error && <p className="state-msg">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="state-msg">No products found.</p>
      )}

      {!loading && products.length > 0 && (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
