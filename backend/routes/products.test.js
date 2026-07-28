import test from 'node:test';
import assert from 'node:assert/strict';
import { insertProductMediaRows } from './products.js';

test('marks the first image of each variant batch as primary', async () => {
  const insertedRows = [];
  const client = {
    async query(sql, values) {
      insertedRows.push({ sql, values });
      return { rows: [] };
    },
  };

  const mediaShape = {
    hasIsPrimary: true,
    hasProductId: true,
    hasMediaType: true,
    hasVariantId: true,
    hasSortOrder: true,
  };

  const sharedRef = { value: false };

  await insertProductMediaRows({
    client,
    productId: 'product-1',
    variantId: 'variant-1',
    imageUrls: ['https://img-1.com', 'https://img-2.com'],
    startOrder: 0,
    mediaShape,
    primaryAssignedRef: sharedRef,
    resetPrimaryState: true,
  });

  await insertProductMediaRows({
    client,
    productId: 'product-1',
    variantId: 'variant-2',
    imageUrls: ['https://img-3.com', 'https://img-4.com'],
    startOrder: 2,
    mediaShape,
    primaryAssignedRef: sharedRef,
    resetPrimaryState: true,
  });

  const firstBatch = insertedRows.slice(0, 2);
  const secondBatch = insertedRows.slice(2, 4);

  assert.equal(firstBatch[0].values[1], true);
  assert.equal(firstBatch[1].values[1], false);
  assert.equal(secondBatch[0].values[1], true);
  assert.equal(secondBatch[1].values[1], false);
});
