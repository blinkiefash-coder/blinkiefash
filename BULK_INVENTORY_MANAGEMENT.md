# 📊 Bulk Inventory Management System

## Overview
Vendors can now download their inventory as an Excel file, make bulk updates locally, and re-upload to automatically sync all stock changes to the database. This replaces the need to manually update each product one-by-one.

## Features

### 1. **Download Inventory as Excel**
Vendors can export their complete inventory (all products and variants) to an Excel file.

**Excel Columns (in order):**
| Column | Purpose | Editable? |
|--------|---------|-----------|
| **Variant ID** | Unique identifier for product variant (PRIMARY) | ❌ NO |
| **Product ID** | Unique identifier for product | ❌ NO |
| **Product Name** | Name of the product | ❌ NO |
| **SKU** | Stock Keeping Unit code | ❌ NO |
| **Brand** | Brand name | ❌ NO |
| **Category** | Product category | ❌ NO |
| **Price (₹)** | Product price | ❌ NO |
| **Size** | Variant size | ❌ NO |
| **Color** | Variant color | ❌ NO |
| **Barcode** | Product barcode | ❌ NO |
| **Current Quantity** | Stock level at your store | ✅ **YES** |

**File Format:** `.xlsx` (Excel 2007+)
**File Name:** `inventory_[StoreName]_[Date].xlsx`

**How to download:**
1. Go to **Vendor Dashboard → Stock Monitoring**
2. Click **⬇ Download Inventory** button
3. File will be saved to your Downloads folder

---

### 2. **Update Inventory Locally**
Edit the downloaded Excel file with your updates:

**Editable Columns:**
- ✅ **Current Quantity** - Update stock levels for each variant ONLY

**Important Rules:**
- ⚠️ **NEVER modify:** Variant ID, Product ID, Product Name, SKU, Barcode
- ⚠️ **DO NOT** change or delete the header row
- ⚠️ **DO NOT** reorder columns
- ✓ Only update "Current Quantity" column
- ✓ Quantities must be whole numbers (no decimals, letters, or special characters)
- ✓ You can leave rows with no changes (quantity unchanged)
- ✓ Save as `.xlsx` format (Excel's default)

**Why Variant ID matters:**
- Each product can have multiple variants (different sizes/colors)
- Barcode numbers can sometimes be similar or duplicated
- **Variant ID uniquely identifies each variant** - this prevents stock updates going to the wrong variant
- You will get an error if Variant ID is missing or invalid

**Example changes:**
```
Variant ID | Product Name    | Current Quantity
12345      | T-Shirt Blue    | 25        (was 10, now 25)
12346      | T-Shirt Blue    | 15        (was 20, now 15)
12401      | Jeans Black     | 0         (out of stock)
```

---

### 3. **Upload & Auto-Sync**
Re-upload the updated Excel to automatically update all inventory levels.

**How to upload:**
1. Go to **Vendor Dashboard → Stock Monitoring**
2. Click **⬆ Upload & Update** button
3. Select your modified Excel file
4. System validates Variant IDs and updates stock
5. Success confirmation shows updated items
6. Page auto-refreshes with new inventory

**Upload Response includes:**
- ✅ Number of variants updated
- ✅ List of updated products with new quantities
- ⚠️ Any errors (missing Variant ID, variant not found, format issues)

---

## Backend API Endpoints

### Download Inventory
```
GET /api/vendor/:vendorId/inventory/download
```
**Response:** Excel file with inventory data
**Auth:** Vendor must be logged in

### Upload & Update Inventory
```
POST /api/vendor/:vendorId/inventory/upload
Content-Type: multipart/form-data

File field: "file" (Excel file)
```
**Response:**
```json
{
  "success": true,
  "message": "Updated 15 variants",
  "updated": [
    {
      "product": "T-Shirt Blue",
      "barcode": "123456789",
      "quantity": 25
    }
  ],
  "errors": []
}
```

---

## Data Mapping Logic

### Variant Identification - Variant ID is REQUIRED
The system uses **Variant ID** as the unique identifier for each row:

**Why Variant ID?**
- ✅ **Unique per variant** - No duplicates, no confusion
- ✅ **Prevents mistakes** - Barcode numbers can be similar across products
- ✅ **Fast & reliable** - Direct database lookup
- ❌ **Barcode alone is insufficient** - Can have duplicates

**Workflow:**
1. Excel downloaded → Includes Variant ID (column A) for every product variant
2. You edit quantities → Variant ID column stays unchanged
3. You upload → System uses Variant ID to update correct variant
4. If Variant ID missing → Upload fails with error message

**Error examples:**
- ✗ Row 5 is missing Variant ID → Error: "Row 5: Missing Variant ID"
- ✓ Row 5 has Variant ID 12345 → System finds & updates variant 12345

---

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Missing Variant ID" | Row doesn't have Variant ID value | Don't delete or clear Variant ID column. Re-download if needed |
| "Variant ID [123] not found" | Variant ID doesn't exist for your store | Ensure you're using downloaded file, variant not deleted |
| "Invalid Excel format" | File is corrupted or not Excel | Save as `.xlsx` format, don't modify structure |
| "Missing file" | No file selected for upload | Click button and select Excel file |
| "Vendor not linked to store" | Backend configuration issue | Contact admin to configure dark store link |

### Handling Errors in Upload Response
If upload returns errors:
1. Note the row numbers with errors
2. Check if Variant ID is present in those rows
3. Verify you downloaded from the correct vendor account
4. **Do NOT delete rows** - Either fix them or leave unchanged
5. Save file and re-upload with corrected rows

---

## Best Practices

### ✅ DO:
- **Always download latest inventory** before making changes
- **Preserve Variant ID column** - Never modify or delete these values
- **Keep header row intact** - Don't delete or reorder columns
- **Update only Current Quantity column** - Only editable field
- **Use whole numbers only** - No decimals, text, or symbols
- **Save as `.xlsx` format** - Excel's default format
- **Keep backup copy** of downloaded file
- **Upload immediately** after making changes
- **Review upload confirmation** to verify all updates processed

### ❌ DON'T:
- ❌ Modify Variant ID, Product ID, SKU, or Barcode columns
- ❌ Delete or change the header row
- ❌ Reorder columns in the Excel sheet
- ❌ Type text like "5 units" - use only "5"
- ❌ Delete entire rows - leave quantity as 0 if out of stock
- ❌ Try to add new products via Excel (use "Add Product" feature)
- ❌ Manually type Variant IDs - copy from download
- ❌ Use other file formats (CSV, Google Sheets, Numbers)
- ❌ Modify multiple stores' data in one file
- ❌ Upload the same file twice (causes duplicate updates)

---

## Workflow Example

**Scenario:** Stock audit after receiving new shipment

1. **Monday 10 AM:** Download inventory
   - 50 T-Shirts (Blue) in stock
   - 20 Jeans (Black) in stock

2. **Monday 2 PM:** Receive 25 new T-Shirts (Blue)
   - Edit Excel: Change quantity from 50 → 75

3. **Monday 3 PM:** Upload updated file
   - System confirms: "Updated 1 variant"
   - Real-time inventory now shows 75 T-Shirts (Blue)

4. **Customers see:** 75 available on product page
   - Orders automatically adjust available stock

---

## Technical Details

### Database Updates
- **Target Table:** `inventory` (tracks stock by variant and store)
- **Fields Updated:** `stock` column
- **Atomicity:** All rows in upload processed in single transaction
- **Rollback:** If any error, entire batch rolled back

### File Processing
1. Read Excel file from upload
2. Parse sheet (first sheet used)
3. Skip header row
4. **For each data row:**
   - ✓ Extract Variant ID from column A (REQUIRED)
   - ✓ Extract quantity value from last column
   - ✓ Validate Variant ID is not empty
   - ✓ Look up variant in database by Variant ID (unique match)
   - ✓ Update or insert inventory record with new quantity
5. Return summary with updated variants and any errors
6. **If any row fails:** All updates are rolled back (no partial changes)

### Data Validation
- Quantity must be non-negative number
- Quantity must be ≤ 999,999
- Variant must belong to uploading vendor
- Variant must be active (not deleted)
- Store link must be configured

---

## Troubleshooting

### Excel won't open after download
- Right-click file → Open With → Microsoft Excel
- Or drag into Excel application
- File may be corrupted - try downloading again

### Upload says "Variant not found" for all rows
- Confirm you downloaded from the correct store
- Check if products were recently deleted
- Verify barcode/SKU match exactly (case-sensitive)

### Numbers not updating after upload
- Check upload response - were rows actually updated?
- Confirm store is linked to dark store (backend requirement)
- Refresh page to see updated inventory

### File format error
- Save in Excel format: **File → Save As → .xlsx**
- Don't use CSV, Google Sheets, Numbers formats
- Check that header row is intact

---

## Frontend Implementation

### Component: `StockMonitoring.jsx`
Location: `/blinkiefashwebnew/src/pages/StockMonitoring.jsx`

**New Functions:**
- `handleUploadExcel()` - Process file upload and trigger API
- `downloadInventoryExcel()` - Download current inventory

**New UI Elements:**
- Upload button (⬆ Upload & Update)
- Success notification banner
- Error notification banner
- File input (hidden, triggered by button)

**States:**
- `uploadLoading` - Shows loading state during upload
- `uploadResult` - Stores successful upload response
- `uploadError` - Stores error message if upload fails

---

## Backend Implementation

### Routes Added: `/backend/routes/vendor.js`

**Route 1: Download Inventory**
```javascript
router.get("/:id/inventory/download", async (req, res) => {
  // Query vendor products + variants + inventory
  // Create Excel workbook with formatting
  // Send as downloadable attachment
})
```

**Route 2: Upload & Update**
```javascript
router.post("/:id/inventory/upload", upload.single("file"), async (req, res) => {
  // Parse uploaded Excel file
  // For each row: find variant and update inventory
  // Return summary of changes and any errors
})
```

**Dependencies:**
- `xlsx` library - Parse and create Excel files
- `multer` - Handle file uploads
- PostgreSQL transactions - Ensure data consistency

---

## Future Enhancements

Potential features to add:
- 📊 Batch pricing updates (update Price column)
- 🔄 Recurring scheduled uploads (cron job)
- 📈 Inventory history tracking (when changed, by whom)
- ⚠️ Low stock alerts (auto-generate alert emails)
- 🏪 Multi-store inventory sync
- 📧 Email confirmation after upload
- 🗂️ Template download with instructions

---

## Support

For issues or questions:
1. Check **Troubleshooting** section above
2. Review error message in upload response
3. Ensure Excel format is correct
4. Contact vendor support with:
   - Downloaded Excel file (sanitized)
   - Uploaded Excel file (sanitized)
   - Error message received
   - Store name and date/time of upload
