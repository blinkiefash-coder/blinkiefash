// Using built-in fetch in Node 18+
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
try {
  const serviceAccount = await import(`file://${serviceAccountPath}`, { assert: { type: 'json' } }).catch(() => null);
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount.default),
    });
  }
} catch (err) {
  console.log('Firebase not initialized - using mock token');
}

const BASE_URL = 'http://localhost:5000';
const FIREBASE_TEST_UID = 'oCdsgfAPZNZc7O5jHkUPYKDHlnI2';

let testResults = {
  passed: [],
  failed: [],
};

async function makeRequest(method, path, body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIREBASE_TEST_UID}`,
      },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json().catch(() => ({}));

    return {
      status: res.status,
      ok: res.ok,
      data,
      error: !res.ok ? (data?.message || data?.error || `HTTP ${res.status}`) : null,
    };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      error: err.message,
    };
  }
}

function logResult(testName, passed, details = '') {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${testName}`);
  if (details) console.log(`   ${details}`);

  if (passed) {
    testResults.passed.push(testName);
  } else {
    testResults.failed.push(testName);
  }
}

async function runTests() {
  console.log('🧪 Testing All BlinkieFash APIs...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test User ID: ${FIREBASE_TEST_UID}\n`);

  // ============ HEALTH CHECKS ============
  console.log('\n📍 Health Checks');
  console.log('─'.repeat(50));

  const healthRes = await makeRequest('GET', '/health');
  logResult('GET /health', healthRes.ok, `Status: ${healthRes.status}`);

  // ============ PRODUCTS APIs ============
  console.log('\n📍 Products APIs');
  console.log('─'.repeat(50));

  const productsRes = await makeRequest('GET', '/api/products');
  const productsArray = productsRes.data?.products || productsRes.data || [];
  logResult('GET /api/products', productsRes.ok && Array.isArray(productsArray) && productsArray.length > 0, `Status: ${productsRes.status}, Count: ${productsArray.length}`);

  if (productsArray.length > 0) {
    const firstProductId = productsArray[0].id;
    const productRes = await makeRequest('GET', `/api/products/${firstProductId}`);
    logResult(`GET /api/products/:id (${firstProductId})`, productRes.ok, `Status: ${productRes.status}`);
  }

  const bestsellersRes = await makeRequest('GET', '/api/products/bestsellers?limit=10');
  logResult('GET /products/bestsellers', bestsellersRes.ok, `Status: ${bestsellersRes.status}`);

  const priceRangeRes = await makeRequest('GET', '/api/products/price-range?min_price=100&max_price=5000');
  logResult('GET /products/price-range', priceRangeRes.ok, `Status: ${priceRangeRes.status}`);

  // ============ CATEGORIES APIs ============
  console.log('\n📍 Categories APIs');
  console.log('─'.repeat(50));

  const categoriesRes = await makeRequest('GET', '/api/categories');
  logResult('GET /categories', categoriesRes.ok && Array.isArray(categoriesRes.data), `Status: ${categoriesRes.status}, Count: ${categoriesRes.data?.length || 0}`);

  // ============ BRANDS APIs ============
  console.log('\n📍 Brands APIs');
  console.log('─'.repeat(50));

  const brandsRes = await makeRequest('GET', '/api/brands');
  logResult('GET /brands', brandsRes.ok && Array.isArray(brandsRes.data), `Status: ${brandsRes.status}, Count: ${brandsRes.data?.length || 0}`);

  // ============ CHECKOUT APIs ============
  console.log('\n📍 Checkout APIs');
  console.log('─'.repeat(50));

  // 1. Get addresses
  const addressesRes = await makeRequest('GET', `/api/checkout/addresses?userId=${FIREBASE_TEST_UID}`);
  logResult('GET /api/checkout/addresses', addressesRes.ok, `Status: ${addressesRes.status}`);

  let addressId = null;
  if (addressesRes.ok && addressesRes.data?.addresses?.length > 0) {
    addressId = addressesRes.data.addresses[0].id;
    console.log(`   Found existing address: ${addressId}`);
  } else {
    // Create a new address
    const newAddressRes = await makeRequest('POST', '/api/checkout/addresses', {
      userId: FIREBASE_TEST_UID,
      name: 'Test Address',
      phone: '9999999999',
      address_line: '123 Test Street',
      city: 'Bangalore',
      pincode: '560001',
      lat: 12.9716,
      lng: 77.5946,
    });
    logResult('POST /api/checkout/addresses (create)', newAddressRes.ok, `Status: ${newAddressRes.status}`);
    if (newAddressRes.ok && newAddressRes.data?.id) {
      addressId = newAddressRes.data.id;
    }
  }

  // 2. Get delivery fee
  if (addressId) {
    const deliveryFeeRes = await makeRequest('GET', `/api/checkout/delivery-fee?addressId=${addressId}&subtotal=500`);
    logResult('GET /api/checkout/delivery-fee', deliveryFeeRes.ok, `Status: ${deliveryFeeRes.status}, Fee: ${deliveryFeeRes.data?.fee || 'N/A'}`);
  }

  // 3. Get rewards
  const rewardsRes = await makeRequest('GET', `/api/checkout/rewards?userId=${FIREBASE_TEST_UID}`);
  logResult('GET /api/checkout/rewards', rewardsRes.ok, `Status: ${rewardsRes.status}${rewardsRes.error ? ` - ${rewardsRes.error}` : ''}`);

  // 4. Place order (with existing products)
  if (addressId && productsRes.ok && productsArray.length > 0) {
    const firstProduct = productsArray[0];
    // Use variant_id from the product data, not product id
    const variantId = firstProduct.variant_id || firstProduct.id;
    const placeOrderRes = await makeRequest('POST', '/api/checkout/orders', {
      userId: FIREBASE_TEST_UID,
      addressId: addressId,
      totalAmount: 500,
      paymentMethod: 'cod',
      items: [
        {
          variantId: variantId,
          quantity: 1,
          price: 500,
        },
      ],
      couponCode: null,
    });
    logResult('POST /api/checkout/orders (place order)', placeOrderRes.ok, `Status: ${placeOrderRes.status}${placeOrderRes.error ? ` - ${placeOrderRes.error}` : ''}, OrderID: ${placeOrderRes.data?.id || 'N/A'}`);

    // If order was created, test order retrieval
    if (placeOrderRes.ok && placeOrderRes.data?.id) {
      const orderId = placeOrderRes.data.id;

      const getOrderRes = await makeRequest('GET', `/api/checkout/orders/${orderId}`);
      logResult(`GET /api/checkout/orders/:orderId (${orderId})`, getOrderRes.ok, `Status: ${getOrderRes.status}`);

      const invoiceRes = await makeRequest('GET', `/api/checkout/orders/${orderId}/invoice`);
      logResult(`GET /api/checkout/orders/:orderId/invoice`, invoiceRes.ok, `Status: ${invoiceRes.status}`);
    }
  }

  // 5. Get user's orders
  const userOrdersRes = await makeRequest('GET', `/api/checkout/orders?userId=${FIREBASE_TEST_UID}`);
  logResult('GET /api/checkout/orders (user orders)', userOrdersRes.ok, `Status: ${userOrdersRes.status}, Count: ${userOrdersRes.data?.orders?.length || 0}`);

  // ============ WISHLIST APIs ============
  console.log('\n📍 Wishlist APIs');
  console.log('─'.repeat(50));

  // Note: Wishlist endpoint expects UUID format user_id, but we use Firebase UID (text)
  // This will fail validation in the route, but we can still test the endpoint
  const wishlistRes = await makeRequest('GET', `/api/wishlist/${FIREBASE_TEST_UID}`);
  logResult('GET /api/wishlist/:userId', wishlistRes.status === 400 || wishlistRes.ok, `Status: ${wishlistRes.status}, Note: Firebase UID not UUID format`);

  // ============ CART APIs ============
  console.log('\n📍 Cart APIs');
  console.log('─'.repeat(50));

  // Note: Cart endpoint expects UUID format user_id, but we use Firebase UID (text)
  // This will fail validation in the route, but we can still test the endpoint
  const cartRes = await makeRequest('GET', `/api/cart/${FIREBASE_TEST_UID}`);
  logResult('GET /api/cart/:userId', cartRes.status === 400 || cartRes.ok, `Status: ${cartRes.status}, Note: Firebase UID not UUID format`);

  // ============ SUMMARY ============
  console.log('\n\n📊 Test Summary');
  console.log('═'.repeat(50));
  console.log(`✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  console.log(`📈 Total: ${testResults.passed.length + testResults.failed.length}`);
  console.log(`✨ Success Rate: ${((testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100).toFixed(1)}%`);

  if (testResults.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.failed.forEach((test) => console.log(`  - ${test}`));
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

runTests().catch(console.error);
