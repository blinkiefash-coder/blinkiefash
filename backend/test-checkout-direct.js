import fetch from "node-fetch";

// Test Firebase UID
const testUserId = "oCdsgfAPZNZc7O5jHkUPYKDHlnI2"; // Your actual Firebase UID
const testToken = "test-token"; // We'll need to get a real token

// Sample checkout payload
const payload = {
  items: [
    {
      variantId: "550e8400-e29b-41d4-a716-446655440000", // Dummy UUID
      quantity: 1,
      price: 500,
    },
  ],
  totalAmount: 500,
  paymentMethod: "cod",
};

async function testCheckout() {
  console.log("🧪 Testing checkout endpoint...");
  console.log("📝 User ID:", testUserId);
  console.log("📦 Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch("http://localhost:5000/checkout/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log("\n📊 Response Status:", response.status);
    console.log("📊 Response Data:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("\n❌ ERROR:", data.message || data.error);
      console.error("Full error:", JSON.stringify(data, null, 2));
    } else {
      console.log("\n✅ SUCCESS:", data);
    }
  } catch (error) {
    console.error("\n🔥 Fetch Error:", error.message);
    console.error("Stack:", error.stack);
  }
}

testCheckout();
