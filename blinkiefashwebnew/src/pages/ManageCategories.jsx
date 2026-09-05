import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VendorLayout from '../components/VendorLayout';
import { isAdmin, adminHeaders } from '../utils/adminSession';
import { API_API_BASE_URL } from '../apiBase';
import './manageCategories.css';

const ManageCategories = () => {
  const navigate = useNavigate();
  const adminMode = isAdmin();

  if (!adminMode) {
    return <div style={{ padding: '20px' }}>Access Denied. Admin only.</div>;
  }

  const [tab, setTab] = useState('categories'); // categories, subcategories, brands
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Categories
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [editingCategory, setEditingCategory] = useState(null);

  // Subcategories
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoryForm, setSubcategoryForm] = useState({ name: '', category_id: '', description: '' });
  const [editingSubcategory, setEditingSubcategory] = useState(null);

  // Brands
  const [brands, setBrands] = useState([]);
  const [brandForm, setBrandForm] = useState({ name: '' });
  const [editingBrand, setEditingBrand] = useState(null);

  // Fetch all data on mount
  useEffect(() => {
    fetchCategories();
    fetchSubcategories();
    fetchBrands();
  }, []);

  // ===================== CATEGORIES =====================
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_API_BASE_URL}/categories`, {
        headers: adminHeaders(),
      });
      const data = await response.json();
      setCategories(data.categories || data || []);
    } catch (err) {
      setError('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (e) => {
    const { name, value } = e.target;
    setCategoryForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const method = editingCategory ? 'PUT' : 'POST';
      const url = editingCategory
        ? `${API_API_BASE_URL}/admin/categories/${editingCategory.id}`
        : `${API_API_BASE_URL}/admin/categories`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders(),
        },
        body: JSON.stringify(categoryForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save category');
      }

      setSuccess(editingCategory ? 'Category updated!' : 'Category created!');
      setCategoryForm({ name: '', description: '' });
      setEditingCategory(null);
      fetchCategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_API_BASE_URL}/admin/categories/${id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

      setSuccess('Category deleted!');
      fetchCategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===================== SUBCATEGORIES =====================
  const fetchSubcategories = async () => {
    try {
      const response = await fetch(`${API_API_BASE_URL}/subcategories`, {
        headers: adminHeaders(),
      });
      const data = await response.json();
      setSubcategories(data.subcategories || data || []);
    } catch (err) {
      console.error('Failed to fetch subcategories');
    }
  };

  const handleSubcategoryChange = (e) => {
    const { name, value } = e.target;
    setSubcategoryForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubcategorySubmit = async (e) => {
    e.preventDefault();
    if (!subcategoryForm.name.trim() || !subcategoryForm.category_id) {
      setError('Subcategory name and category are required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const method = editingSubcategory ? 'PUT' : 'POST';
      const url = editingSubcategory
        ? `${API_API_BASE_URL}/admin/subcategories/${editingSubcategory.id}`
        : `${API_API_BASE_URL}/admin/subcategories`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders(),
        },
        body: JSON.stringify(subcategoryForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save subcategory');
      }

      setSuccess(editingSubcategory ? 'Subcategory updated!' : 'Subcategory created!');
      setSubcategoryForm({ name: '', category_id: '', description: '' });
      setEditingSubcategory(null);
      fetchSubcategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubcategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subcategory?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_API_BASE_URL}/admin/subcategories/${id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete subcategory');
      }

      setSuccess('Subcategory deleted!');
      fetchSubcategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===================== BRANDS =====================
  const fetchBrands = async () => {
    try {
      const response = await fetch(`${API_API_BASE_URL}/brands`, {
        headers: adminHeaders(),
      });
      const data = await response.json();
      setBrands(data.brands || data || []);
    } catch (err) {
      console.error('Failed to fetch brands');
    }
  };

  const handleBrandChange = (e) => {
    const { name, value } = e.target;
    setBrandForm(prev => ({ ...prev, [name]: value }));
  };

  const handleBrandSubmit = async (e) => {
    e.preventDefault();
    if (!brandForm.name.trim()) {
      setError('Brand name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const method = editingBrand ? 'PUT' : 'POST';
      const url = editingBrand
        ? `${API_API_BASE_URL}/admin/brands/${editingBrand.id}`
        : `${API_API_BASE_URL}/admin/brands`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders(),
        },
        body: JSON.stringify(brandForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save brand');
      }

      setSuccess(editingBrand ? 'Brand updated!' : 'Brand created!');
      setBrandForm({ name: '' });
      setEditingBrand(null);
      fetchBrands();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = async (id) => {
    if (!window.confirm('Are you sure you want to delete this brand?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_API_BASE_URL}/admin/brands/${id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete brand');
      }

      setSuccess('Brand deleted!');
      fetchBrands();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (item) => {
    if (item.key === 'orders') navigate('/vendor/orders');
    if (item.key === 'products') navigate('/vendor/add-product');
    if (item.key === 'edit') navigate('/vendor/edit-product');
    if (item.key === 'stock') navigate('/vendor/stock-monitoring');
    if (item.key === 'analytics') navigate('/vendor/product-analytics');
    if (item.key === 'profile') navigate('/vendor/profile');
    if (item.key === 'create-vendor') navigate('/vendor/create-vendor');
    if (item.key === 'manage-categories') navigate('/vendor/manage-categories');
  };

  return (
    <VendorLayout activeKey="manage-categories" storeName="Admin Panel" onMenuClick={handleMenuClick}>
      <div className="manage-categories-container">
        <h1>Manage Catalog</h1>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${tab === 'categories' ? 'active' : ''}`}
            onClick={() => { setTab('categories'); setError(''); setSuccess(''); }}
          >
            Categories
          </button>
          <button
            className={`tab ${tab === 'subcategories' ? 'active' : ''}`}
            onClick={() => { setTab('subcategories'); setError(''); setSuccess(''); }}
          >
            Subcategories
          </button>
          <button
            className={`tab ${tab === 'brands' ? 'active' : ''}`}
            onClick={() => { setTab('brands'); setError(''); setSuccess(''); }}
          >
            Brands
          </button>
        </div>

        {/* Error & Success Messages */}
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="content-wrapper">
          {/* CATEGORIES TAB */}
          {tab === 'categories' && (
            <div className="tab-content">
              <div className="form-section">
                <h2>{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
                <form onSubmit={handleCategorySubmit}>
                  <div className="form-group">
                    <label>Category Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={categoryForm.name}
                      onChange={handleCategoryChange}
                      placeholder="e.g., Men's Clothing"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={categoryForm.description}
                      onChange={handleCategoryChange}
                      placeholder="Category description"
                      rows="3"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : (editingCategory ? 'Update' : 'Add')} Category
                  </button>
                  {editingCategory && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryForm({ name: '', description: '' });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </form>
              </div>

              <div className="list-section">
                <h3>Categories List</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(cat => (
                        <tr key={cat.id}>
                          <td>{cat.name}</td>
                          <td>{cat.description || '-'}</td>
                          <td>
                            <button
                              className="btn-small btn-edit"
                              onClick={() => {
                                setEditingCategory(cat);
                                setCategoryForm({ name: cat.name, description: cat.description || '' });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-small btn-delete"
                              onClick={() => handleDeleteCategory(cat.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBCATEGORIES TAB */}
          {tab === 'subcategories' && (
            <div className="tab-content">
              <div className="form-section">
                <h2>{editingSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}</h2>
                <form onSubmit={handleSubcategorySubmit}>
                  <div className="form-group">
                    <label>Subcategory Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={subcategoryForm.name}
                      onChange={handleSubcategoryChange}
                      placeholder="e.g., T-Shirts"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      name="category_id"
                      value={subcategoryForm.category_id}
                      onChange={handleSubcategoryChange}
                      required
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={subcategoryForm.description}
                      onChange={handleSubcategoryChange}
                      placeholder="Subcategory description"
                      rows="3"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : (editingSubcategory ? 'Update' : 'Add')} Subcategory
                  </button>
                  {editingSubcategory && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingSubcategory(null);
                        setSubcategoryForm({ name: '', category_id: '', description: '' });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </form>
              </div>

              <div className="list-section">
                <h3>Subcategories List</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subcategories.map(subcat => (
                        <tr key={subcat.id}>
                          <td>{subcat.name}</td>
                          <td>{subcat.category_name || '-'}</td>
                          <td>{subcat.description || '-'}</td>
                          <td>
                            <button
                              className="btn-small btn-edit"
                              onClick={() => {
                                setEditingSubcategory(subcat);
                                setSubcategoryForm({
                                  name: subcat.name,
                                  category_id: subcat.category_id,
                                  description: subcat.description || ''
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-small btn-delete"
                              onClick={() => handleDeleteSubcategory(subcat.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BRANDS TAB */}
          {tab === 'brands' && (
            <div className="tab-content">
              <div className="form-section">
                <h2>{editingBrand ? 'Edit Brand' : 'Add New Brand'}</h2>
                <form onSubmit={handleBrandSubmit}>
                  <div className="form-group">
                    <label>Brand Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={brandForm.name}
                      onChange={handleBrandChange}
                      placeholder="e.g., Nike, Adidas"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : (editingBrand ? 'Update' : 'Add')} Brand
                  </button>
                  {editingBrand && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingBrand(null);
                        setBrandForm({ name: '' });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </form>
              </div>

              <div className="list-section">
                <h3>Brands List</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brands.map(brand => (
                        <tr key={brand.id}>
                          <td>{brand.name}</td>
                          <td>
                            <span className={`badge ${brand.is_active ? 'active' : 'inactive'}`}>
                              {brand.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-small btn-edit"
                              onClick={() => {
                                setEditingBrand(brand);
                                setBrandForm({ name: brand.name });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-small btn-delete"
                              onClick={() => handleDeleteBrand(brand.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
};

export default ManageCategories;
