# Dynamic Hero Cards Implementation Guide

## Overview
Hero cards are now stored in the database and can be managed by super admins through the admin panel. This allows real-time updates to home page hero banners without code changes.

## Database Schema

### `hero_cards` Table
```sql
- id (UUID, PK)
- title (VARCHAR) - Card display name
- image_url (TEXT) - Card image URL
- reference_type (VARCHAR) - 'brand', 'category', 'search', 'link'
- reference_value (TEXT) - Brand name, category name, search query, or URL
- position (INT) - Display order (0-14, max 15 cards)
- is_active (BOOLEAN) - Enable/disable without deleting
- created_by (UUID FK) - Admin who created
- created_at, updated_at (TIMESTAMP)
```

## API Endpoints

### Public
- `GET /api/hero-cards` - Get all active hero cards (sorted by position)

### Admin Only (requires is_admin=true)
- `GET /api/hero-cards/admin/all` - Get all cards (including inactive)
- `POST /api/hero-cards/admin` - Create new card (max 15)
- `PUT /api/hero-cards/admin/:id` - Update card
- `DELETE /api/hero-cards/admin/:id` - Delete card
- `POST /api/hero-cards/admin/reorder` - Reorder multiple cards

## Reference Types

1. **brand** - Search products by brand name
   - reference_value: "Puma", "Nike", "MK", etc.
   - Navigates to `/shop?search={brand_name}`

2. **category** - Filter by category
   - reference_value: "Men", "Women", "Kids", "Beauty", "Footwear"
   - Navigates to category with products

3. **search** - Direct search query
   - reference_value: "men footwear", "women clothing", etc.
   - Navigates to `/shop?search={query}`

4. **link** - Custom URL or deep link
   - reference_value: "https://...", "/path", etc.
   - Navigates to custom destination

## Frontend Integration

### Mobile (Flutter - `blinkiefashmob/lib/pages/home_screen.dart`)
- `_loadHeroCards()` - Fetches from `/api/hero-cards`
- Converts to Flutter Map<String, dynamic> objects
- Uses `image_url` field for image display
- `_handleHeroTap()` - Routes based on reference_type

### Web (React - `blinkiefashwebnew/src/pages/Home.jsx`)
- `useEffect` hook loads hero cards on mount
- Converts database format to display format
- Uses `image_url` for display
- Click handler navigates based on reference_type

## Usage Examples

### Creating a Hero Card
```bash
POST /api/hero-cards/admin
{
  "title": "Nike Collection",
  "image_url": "https://example.com/nike.png",
  "reference_type": "brand",
  "reference_value": "Nike",
  "position": 2
}
```

### Updating a Card
```bash
PUT /api/hero-cards/admin/{id}
{
  "title": "Updated Title",
  "is_active": true,
  "position": 5
}
```

### Reordering Cards
```bash
POST /api/hero-cards/admin/reorder
{
  "cards": [
    { "id": "uuid-1", "position": 0 },
    { "id": "uuid-2", "position": 1 },
    { "id": "uuid-3", "position": 2 }
  ]
}
```

## Limits
- **Maximum 15 hero cards** per system
- **Position must be unique** (0-14)
- **Only admins** can manage hero cards
- Cards display in position order (ascending)

## Admin Panel Features Needed
- List all hero cards with preview
- Create new card with image upload
- Edit card details and image
- Reorder cards (drag & drop or position input)
- Bulk activate/deactivate
- Delete cards
- Search/filter cards

## Notes
- Inactive cards are not shown to users
- Image URLs should be CDN URLs (Cloudinary, etc.)
- Changes appear immediately (no caching)
- Mobile and web both fetch live data on every app load
- Fallback to default cards if API is unavailable
