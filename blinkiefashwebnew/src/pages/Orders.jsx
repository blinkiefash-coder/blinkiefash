import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrders } from '../api';
import Loader from '../components/Loader';
import './Orders.css';

export default function Orders() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    getOrders(user.id)
      .then((res) => setOrders(res.orders || []))
      .catch((err) => setError(err.message || 'Could not load orders'))
      .finally(() => setLoading(false));
  }, [isLoggedIn, user]);

  if (!isLoggedIn) {
    return (
      <div className="page">
        <h1 className="cart-title">Your orders</h1>
        <p className="state-msg">Log in to view your orders.</p>
        <button type="button" className="primary-btn" onClick={() => navigate('/login')}>
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="cart-title">Your orders</h1>
      {loading && <Loader label="Loading orders..." />}
      {!loading && error && <p className="state-msg">{error}</p>}
      {!loading && !error && orders.length === 0 && <p className="state-msg">No orders yet.</p>}
      <div className="orders-list">
        {orders.map((order) => (
          <div className="order-card" key={order.id}>
            <div className="order-card-head">
              <span className="order-status">{order.status}</span>
              <span>₹{order.final_amount ?? order.total_amount}</span>
            </div>
            <p className="order-meta">
              {order.items?.length || 0} item(s) · {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
