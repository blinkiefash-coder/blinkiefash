import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../apiBase';
import './HeroCardsManager.css';

export default function HeroCardsManager() {
  const [heroCards, setHeroCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    reference_type: 'brand',
    reference_value: '',
    position: 0,
    is_active: true,
  });

  // Fetch hero cards
  const fetchHeroCards = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/hero-cards/admin/all`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch hero cards');
      }

      const data = await response.json();
      setHeroCards(data.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Error loading hero cards');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeroCards();
  }, []);

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name === 'position' ? parseInt(value) || 0 : value,
    }));
  };

  // Handle create/update
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.image_url || !formData.reference_value) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.position < 0 || formData.position > 14) {
      setError('Position must be between 0 and 14');
      return;
    }

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `${API_BASE_URL}/api/hero-cards/admin/${editingId}`
        : `${API_BASE_URL}/api/hero-cards/admin`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save hero card');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        title: '',
        image_url: '',
        reference_type: 'brand',
        reference_value: '',
        position: 0,
        is_active: true,
      });

      await fetchHeroCards();
    } catch (err) {
      setError(err.message);
      console.error(err);
    }
  };

  // Handle edit
  const handleEdit = (card) => {
    setFormData(card);
    setEditingId(card.id);
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this hero card?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/hero-cards/admin/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete hero card');
      }

      await fetchHeroCards();
    } catch (err) {
      setError(err.message);
      console.error(err);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      title: '',
      image_url: '',
      reference_type: 'brand',
      reference_value: '',
      position: 0,
      is_active: true,
    });
  };

  if (loading) {
    return <div className="hcm-loading">Loading hero cards...</div>;
  }

  return (
    <div className="hcm-container">
      <div className="hcm-header">
        <h1>🎨 Hero Cards Manager</h1>
        <p>Manage dynamic hero banners for home page (Max 15 cards)</p>
      </div>

      {error && <div className="hcm-error">{error}</div>}

      {!showForm && (
        <button className="hcm-btn-primary" onClick={() => setShowForm(true)}>
          + Create New Hero Card
        </button>
      )}

      {showForm && (
        <div className="hcm-form-container">
          <h2>{editingId ? 'Edit' : 'Create'} Hero Card</h2>
          <form onSubmit={handleSubmit}>
            <div className="hcm-form-group">
              <label>Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Nike Collection"
                required
              />
            </div>

            <div className="hcm-form-group">
              <label>Image URL *</label>
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleInputChange}
                placeholder="https://example.com/image.jpg"
                required
              />
              {formData.image_url && (
                <div className="hcm-image-preview">
                  <img src={formData.image_url} alt={formData.title} onError={(e) => e.target.style.display = 'none'} />
                </div>
              )}
            </div>

            <div className="hcm-form-row">
              <div className="hcm-form-group">
                <label>Reference Type *</label>
                <select
                  name="reference_type"
                  value={formData.reference_type}
                  onChange={handleInputChange}
                >
                  <option value="brand">Brand</option>
                  <option value="category">Category</option>
                  <option value="search">Search Query</option>
                  <option value="link">Custom Link</option>
                </select>
              </div>

              <div className="hcm-form-group">
                <label>Reference Value *</label>
                <input
                  type="text"
                  name="reference_value"
                  value={formData.reference_value}
                  onChange={handleInputChange}
                  placeholder={
                    formData.reference_type === 'brand'
                      ? 'e.g., Nike'
                      : formData.reference_type === 'category'
                      ? 'e.g., Men'
                      : formData.reference_type === 'search'
                      ? 'e.g., men footwear'
                      : 'https://... or /path'
                  }
                  required
                />
              </div>
            </div>

            <div className="hcm-form-row">
              <div className="hcm-form-group">
                <label>Position (0-14) *</label>
                <input
                  type="number"
                  name="position"
                  min="0"
                  max="14"
                  value={formData.position}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="hcm-form-group hcm-checkbox">
                <label>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="hcm-form-actions">
              <button type="submit" className="hcm-btn-primary">
                {editingId ? 'Update' : 'Create'} Card
              </button>
              <button type="button" className="hcm-btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="hcm-list">
        <h2>Hero Cards ({heroCards.length}/15)</h2>
        {heroCards.length === 0 ? (
          <p className="hcm-empty">No hero cards created yet</p>
        ) : (
          <div className="hcm-cards-grid">
            {heroCards.map(card => (
              <div key={card.id} className={`hcm-card ${!card.is_active ? 'hcm-card-inactive' : ''}`}>
                <div className="hcm-card-image">
                  <img src={card.image_url} alt={card.title} onError={(e) => e.target.style.display = 'none'} />
                </div>
                <div className="hcm-card-content">
                  <h3>{card.title}</h3>
                  <p className="hcm-card-type">
                    <strong>Type:</strong> {card.reference_type}
                  </p>
                  <p className="hcm-card-value">
                    <strong>Value:</strong> {card.reference_value}
                  </p>
                  <p className="hcm-card-position">
                    <strong>Position:</strong> {card.position}
                  </p>
                  <span className={`hcm-badge ${card.is_active ? 'hcm-badge-active' : 'hcm-badge-inactive'}`}>
                    {card.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="hcm-card-actions">
                  <button
                    className="hcm-btn-edit"
                    onClick={() => handleEdit(card)}
                  >
                    Edit
                  </button>
                  <button
                    className="hcm-btn-delete"
                    onClick={() => handleDelete(card.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
