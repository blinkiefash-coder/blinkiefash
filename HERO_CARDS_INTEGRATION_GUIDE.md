# Hero Cards Manager Integration Guide

## Quick Start - Adding Hero Cards Manager to Admin Dashboard

### Step 1: Import the Component
Add this to your admin dashboard file (e.g., `src/pages/Admin.jsx`, `src/pages/AdminDashboard.jsx`, etc.):

```jsx
import HeroCardsManager from './HeroCardsManager';
```

### Step 2: Add Route
If using React Router, add a new route:

```jsx
import { Routes, Route } from 'react-router-dom';

export default function AdminDashboard() {
  return (
    <Routes>
      {/* Your existing routes */}
      <Route path="/admin/hero-cards" element={<HeroCardsManager />} />
      {/* Other admin routes */}
    </Routes>
  );
}
```

### Step 3: Add Navigation Link
Add this to your admin sidebar or navigation menu:

```jsx
<nav className="admin-nav">
  {/* Existing nav items */}
  <li>
    <Link to="/admin/hero-cards">
      🎨 Hero Cards Manager
    </Link>
  </li>
  {/* Other nav items */}
</nav>
```

### Step 4: Verify API Base URL
Ensure `API_BASE_URL` is properly configured in your codebase. The component expects:
- File: `src/apiBase.js` (or similar)
- Export: `API_BASE_URL` constant

Example:
```javascript
// src/apiBase.js
export const API_BASE_URL = 'https://your-api-domain.com';
```

### Step 5: Check Authentication
The component uses `localStorage.getItem('token')` for authentication. Make sure:
1. Your login flow stores auth token in localStorage as 'token'
2. The token is a valid JWT or auth token format
3. Backend validates this token and checks `is_admin` flag

## Component Props Reference

The `HeroCardsManager` component does NOT accept any props. It is standalone and:
- Fetches admin token from localStorage
- Manages all state internally
- Calls API endpoints directly
- Displays loading/error states

## Component Features

### List View
- Displays all hero cards (active and inactive)
- Shows card image, title, reference type, position
- Active/inactive badge
- Edit and Delete buttons

### Create Form
- Title input (required)
- Image URL input (required)
- Reference Type dropdown (brand, category, search, link)
- Reference Value input (required)
- Position input (0-14, required)
- Active checkbox
- Submit and Cancel buttons
- Real-time image preview

### Edit Form
- Pre-populated form with existing card data
- All fields editable
- Updates only changed fields
- Cancel returns to list view

### Delete
- Confirmation dialog
- Prevents accidental deletion
- Removes card from database

## API Endpoints Required

The component assumes your backend has these endpoints:

```
GET  /api/hero-cards/admin/all        (Requires admin auth)
POST /api/hero-cards/admin            (Requires admin auth)
PUT  /api/hero-cards/admin/:id        (Requires admin auth)
DELETE /api/hero-cards/admin/:id      (Requires admin auth)
```

Response Format Expected:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "image_url": "string",
      "reference_type": "brand|category|search|link",
      "reference_value": "string",
      "position": 0-14,
      "is_active": boolean,
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

## Styling Integration

The component includes its own CSS file (`HeroCardsManager.css`). Make sure:
1. CSS file is in same directory as JSX component
2. Import is correctly set: `import './HeroCardsManager.css'`
3. No conflicting global styles override component styles

If you have global CSS conflicts, you can:
- Use CSS modules: `import styles from './HeroCardsManager.module.css'`
- Add CSS nesting to avoid conflicts
- Adjust z-index and specificity in global styles

## Responsive Design

Component is fully responsive:
- **Desktop** (>1200px): 3-column grid
- **Tablet** (768px-1200px): 2-column grid
- **Mobile** (<768px): 1-column grid, stacked form

## Error Handling

The component handles these error scenarios:
- Network errors when fetching data
- 403 Forbidden (user not admin)
- 404 Not Found (card doesn't exist)
- Validation errors (required fields missing)
- Server errors (5xx responses)

All errors display in a red banner at top of page.

## Security Considerations

1. **Token Storage**
   - Token stored in localStorage (client-side)
   - Ensure token has appropriate expiration
   - Implement token refresh if needed

2. **Admin Verification**
   - Backend must verify `is_admin` flag before each operation
   - Consider additional permission checks

3. **Input Validation**
   - Component validates on client side
   - Backend should validate again (never trust client)
   - Image URLs should be from trusted CDNs only

4. **Image URLs**
   - Only accept HTTPS URLs
   - Validate CDN domain whitelist if possible
   - Consider using S3/Cloudinary for image uploads

## Testing Checklist

- [ ] Can create new hero card
- [ ] Can edit existing hero card
- [ ] Can delete hero card (with confirmation)
- [ ] Can toggle active/inactive status
- [ ] Image preview displays correctly
- [ ] Form validation works (required fields)
- [ ] Position validation works (0-14)
- [ ] Error messages display properly
- [ ] Loading state shows while fetching
- [ ] Component works on desktop, tablet, mobile
- [ ] Admin can see list of all cards
- [ ] Non-admin users cannot access (403 error)

## Troubleshooting

### "Failed to fetch hero cards"
- Check browser console for error message
- Verify API endpoint is correct in apiBase.js
- Verify admin token is present in localStorage
- Check CORS headers on backend

### Images not showing in preview
- Verify image URL is accessible
- Check browser console for image 404 errors
- Ensure URL is HTTP/HTTPS (not relative path)
- Check if image domain needs CORS headers

### "403 Forbidden" error
- Verify user `is_admin` flag is true in database
- Check auth token is valid and not expired
- Verify backend middleware is checking isAdmin correctly

### Form not submitting
- Check browser console for validation errors
- Ensure all required fields are filled
- Verify position is between 0-14
- Check if position already exists (must be unique)

### Component not showing
- Verify route is correctly configured
- Check navigation link is pointing to correct path
- Ensure component import is correct
- Check for JavaScript console errors

## File Structure

```
blinkiefashwebnew/src/
├── pages/
│   ├── HeroCardsManager.jsx       (Main component)
│   ├── HeroCardsManager.css       (Styles)
│   ├── Admin.jsx                   (Admin dashboard - your file)
│   └── ...
├── apiBase.js                      (API configuration)
└── ...
```

## Next Steps

1. ✅ Copy `HeroCardsManager.jsx` to your pages directory
2. ✅ Copy `HeroCardsManager.css` to your pages directory  
3. ✅ Update your admin dashboard to import and route the component
4. ✅ Add navigation link to access the manager
5. ✅ Deploy and test
6. ⭐ (Optional) Enhance with drag-to-reorder, image upload, etc.

## Support & Documentation

- Full API documentation: See [DYNAMIC_HERO_CARDS_GUIDE.md](DYNAMIC_HERO_CARDS_GUIDE.md)
- Implementation overview: See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- Backend code: [backend/routes/heroCards.js](../backend/routes/heroCards.js)
- Database schema: [backend/sql/hero_cards_schema.sql](../backend/sql/hero_cards_schema.sql)
