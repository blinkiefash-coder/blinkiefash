import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        description,
        price,
        brand,
        vendors (
          username,
          store_name
        ),
        product_images (
          image_url,
          is_primary,
          display_order
        ),
        product_variants (
          id,
          size,
          color,
          sku,
          inventory (
            quantity
          )
        )
      `)
      .eq("is_active", true);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
