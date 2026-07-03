import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./staticInfoPages.css";
import Footer from "../components/Footer";

export default function Company() {
  const navigate = useNavigate();

  return (
    <div className="info-page company-page">
      <header className="info-header" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
        <img src={logo} alt="Blinkiefash" />
        <h1 className="info-brand">BLINKIE<span>FASH</span></h1>
      </header>

      <main className="info-body">
        <section className="info-hero">
          <div className="info-hero-left">
            <h2 className="info-page-title">REVOLUTIONIZING FASHION COMMERCE</h2>
            <h3 className="info-page-subtitle">Style Delivered in 60 Minutes, Try Before You Buy</h3>
            <p>
              BlinkieFash is reimagining how India shops for fashion. We've built a technology-first platform 
              that connects customers with their favorite local vendors, delivering authentic fashion, beauty, 
              and lifestyle products in just 60 minutes. No waiting. No compromises. Pure speed and style.
            </p>
            <p style={{marginTop: '12px', fontSize: '13px', lineHeight: '1.6', color: '#333'}}>
              With our innovative Try & Buy feature, customers get a 20-minute trial window to inspect products 
              before making a final purchase decision. Order fashion online and try them at home with our trusted 
              90-second return process. Experience authentic fast fashion with zero risk.
            </p>
          </div>
          <div className="info-hero-visual" style={{
            background: 'linear-gradient(135deg, #218c3f 0%, #17a34a 50%, #22c55e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '64px',
            fontWeight: 'bold',
            color: 'white'
          }}>
            👗 ⚡ 🛍️
          </div>
        </section>

        <section className="info-grid info-grid-2">
          <article className="info-card info-card-wide">
            <h5>About BlinkieFash</h5>
            <p className="sub">The fastest fashion revolution in India</p>
            <p>
              Founded with a mission to transform urban fashion retail, BlinkieFash combines cutting-edge technology 
              with hyper-local execution. We partner with trusted local vendors and dark stores to bring curated fashion, 
              beauty, and lifestyle products to your doorstep in just 60 minutes.
            </p>
            <p style={{marginTop: '10px', fontSize: '13px', lineHeight: '1.6'}}>
              BlinkieFash operates as India's first hyper-local fashion commerce platform, leveraging a unique model that 
              integrates multiple revenue streams: D2C (Direct-to-Consumer) fast delivery, vendor marketplace operations, 
              dark store management, and logistics coordination. Our technology stack includes AI-driven inventory management, 
              real-time order tracking, machine learning-based personalization, and intelligent delivery optimization.
            </p>
            <p style={{marginTop: '10px', fontSize: '13px', lineHeight: '1.6'}}>
              We're not just another e-commerce platform. BlinkieFash has reimagined the entire fashion shopping experience 
              from the ground up. With our 60-minute delivery guarantee, 20-minute try-before-you-buy window, and 90-second 
              return process, we've eliminated the traditional friction points of online fashion shopping. Whether you're looking 
              for the latest designer trends, affordable everyday wear, beauty products, or lifestyle items, BlinkieFash delivers 
              authentic, quality products from verified vendors.
            </p>
            <div className="info-mini-columns" style={{marginTop: '12px'}}>
              <div>
                <p className="sub">🎯 Our Vision</p>
                <p>
                  To become India's most trusted and fastest fashion delivery platform, empowering customers with risk-free shopping, 
                  supporting local vendors with technology, and building a sustainable fashion ecosystem.
                </p>
              </div>
              <div>
                <p className="sub">💪 Our Mission</p>
                <ul>
                  <li>✨ Deliver authentic fashion in 60 minutes with guaranteed quality</li>
                  <li>🤝 Empower local vendors and artisans with cutting-edge technology</li>
                  <li>🛍️ Create seamless, delightful, and risk-free shopping experiences</li>
                  <li>🌍 Build a sustainable, community-focused, and eco-friendly platform</li>
                  <li>📱 Provide mobile-first solutions for modern Indian shoppers</li>
                </ul>
              </div>
            </div>
          </article>

          <article className="info-card info-card-wide">
            <h5>Why Choose BlinkieFash?</h5>
            <p className="sub">Excellence in every delivery</p>
            <p style={{marginBottom: '12px', fontSize: '13px', lineHeight: '1.6', color: '#555'}}>
              In a crowded e-commerce space, BlinkieFash stands out with its unique value proposition combining speed, 
              authenticity, and customer empowerment. We address the primary pain points of online fashion shopping: 
              uncertainty about fit, doubts about quality, and complex return processes.
            </p>
            <div className="features-list">
              <div className="feature-item">
                <h6>⚡ Lightning-Fast Delivery</h6>
                <p>Guaranteed 60-minute delivery on selected products across metro areas. Order in the morning, wear by evening. Ultra-fast fashion delivery without compromising on quality or authenticity.</p>
              </div>
              <div className="feature-item">
                <h6>👗 Authentic Selection</h6>
                <p>Curated collection from verified local vendors and trusted brands. Real brands, genuine products, real quality. Every item is authenticated before reaching your doorstep.</p>
              </div>
              <div className="feature-item">
                <h6>🎁 Try Before You Buy</h6>
                <p>Unique 20-minute trial window to inspect and try products at home. Risk-free fashion shopping with our hassle-free return guarantee. Make informed decisions before payment.</p>
              </div>
              <div className="feature-item">
                <h6>💰 Smart Pricing</h6>
                <p>Direct from vendor pricing with zero intermediaries. Bundle discounts (Buy 2 at ₹999), seasonal flash sales, and exclusive member-only deals. Maximum value for your money.</p>
              </div>
              <div className="feature-item">
                <h6>🔒 Secure Shopping</h6>
                <p>Safe digital payments with multiple options, authentic product verification, and industry-leading security. Your trust and data security are our top priorities.</p>
              </div>
              <div className="feature-item">
                <h6>🌟 Rewards Program</h6>
                <p>Earn points on every purchase, referral bonuses, loyalty rewards, and exclusive member benefits. Build your rewards and get better deals with every order.</p>
              </div>
            </div>
          </article>

          <article className="info-card info-card-wide">
            <h5>⏱️ 20-Minute Try & Buy Experience</h5>
            <p className="sub">Inspect, evaluate, and decide with confidence</p>
            <p>
              At BlinkieFash, we understand that buying fashion online comes with concerns about fit, quality, and authenticity. 
              That's why we've introduced our revolutionary 20-minute trial window—a game-changing feature that gives customers 
              complete peace of mind.
            </p>
            <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e8ede9'}}>
              <p className="sub">How It Works:</p>
              <ul style={{marginLeft: '20px', fontSize: '13px', color: '#333', lineHeight: '1.8'}}>
                <li><strong>Order & Receive:</strong> Products delivered to your doorstep within 60 minutes</li>
                <li><strong>20-Minute Inspection:</strong> Full 20 minutes to inspect, try on, and evaluate each product</li>
                <li><strong>Evaluate Quality:</strong> Check fabric quality, fit, color accuracy, and authenticity</li>
                <li><strong>Make a Decision:</strong> Keep what you love or return within 20 minutes, no questions asked</li>
                <li><strong>90-Second Return:</strong> Quick return process - our riders pick up within 90 seconds of your decision</li>
              </ul>
            </div>
            <div style={{marginTop: '12px', padding: '12px', backgroundColor: '#f0f8f2', borderRadius: '8px', borderLeft: '4px solid #218c3f'}}>
              <p style={{margin: '0', fontSize: '13px', color: '#333', fontWeight: '500'}}>
                ✅ <strong>Zero Risk Shopping:</strong> Try before you buy with our hassle-free 20-minute trial window. 
                Unlike traditional e-commerce, you're not buying blind. Inspect the fabric, check the fit, verify authenticity—
                all in real-time with our delivery partner present.
              </p>
            </div>
          </article>

          <article className="info-card info-card-wide">
            <h5>Our Unique Concepts</h5>
            <p className="sub">Making fashion sustainable and rewarding</p>
            <p style={{marginBottom: '12px', fontSize: '13px', lineHeight: '1.6', color: '#555'}}>
              Beyond fast delivery, BlinkieFash is committed to building sustainable business practices and rewarding customer loyalty. 
              Our unique concepts are designed to create value for customers while supporting environmental responsibility and community empowerment.
            </p>
            <div className="unique-concepts">
              <div className="concept-card">
                <div className="concept-icon">♻️</div>
                <h6>Donate & Save</h6>
                <p><strong>Give old clothes, earn 1% discount</strong></p>
                <p className="concept-desc">
                  Donate your old, unused clothes through our app and receive 1% discount on your next order. 
                  Join our circular fashion movement. We responsibly recycle or repurpose donations, reducing 
                  fashion waste and supporting sustainable practices.
                </p>
              </div>
              <div className="concept-card">
                <div className="concept-icon">🤝</div>
                <h6>Refer & Earn</h6>
                <p><strong>Share with friends, earn rewards</strong></p>
                <p className="concept-desc">
                  Invite your friends to BlinkieFash and both of you get exclusive rewards. Earn referral points, 
                  bonus discounts, and special perks for every successful friend signup. Build your rewards network 
                  and unlock premium benefits.
                </p>
              </div>
              <div className="concept-card">
                <div className="concept-icon">🌿</div>
                <h6>Eco-Friendly Packaging</h6>
                <p><strong>Sustainable deliveries</strong></p>
                <p className="concept-desc">
                  All BlinkieFash deliveries use 100% recyclable, biodegradable packaging materials. We're committed 
                  to reducing our environmental footprint and promoting sustainable fashion practices across our supply chain.
                </p>
              </div>
              <div className="concept-card">
                <div className="concept-icon">🎁</div>
                <h6>Bundle Offers</h6>
                <p><strong>Buy 2 at ₹999, Buy 3 at ₹999</strong></p>
                <p className="concept-desc">
                  Get incredible bundle discounts when you shop smart. Buy 2 fashion items and pay just ₹999, 
                  or buy 3 and still pay ₹999. Our bundle pricing makes quality fashion affordable for everyone.
                </p>
              </div>
              <div className="concept-card">
                <div className="concept-icon">💳</div>
                <h6>Flexible Payments</h6>
                <p><strong>Try now, pay later options</strong></p>
                <p className="concept-desc">
                  Shop with multiple payment options including Cash on Delivery (COD), digital payments, 
                  and BNPL (Buy Now, Pay Later). Shop with confidence, pay your way, anytime, anywhere.
                </p>
              </div>
              <div className="concept-card">
                <div className="concept-icon">🏆</div>
                <h6>Loyalty Rewards</h6>
                <p><strong>Every purchase earns points</strong></p>
                <p className="concept-desc">
                  Accumulate loyalty points on every order placed. Redeem your points for exclusive discounts, 
                  free products, priority delivery, and member-only deals. The more you shop, the more you save.
                </p>
              </div>
            </div>
          </article>

          <article className="info-card info-card-wide">
            <h5>Our Platform Capabilities</h5>
            <p className="sub">Comprehensive technology for vendors, dark stores, and logistics</p>
            <p style={{marginBottom: '12px', fontSize: '13px', lineHeight: '1.6', color: '#555'}}>
              BlinkieFash provides an integrated platform ecosystem that empowers all stakeholders. From vendor management 
              to dark store operations and logistics optimization, our technology handles every aspect of hyper-local fashion commerce.
            </p>
            <div className="capabilities-grid">
              <div>
                <h6>🏪 For Vendors</h6>
                <p style={{fontSize: '12px', color: '#666', marginBottom: '8px'}}>
                  Powerful tools to manage and grow your fashion business
                </p>
                <ul>
                  <li>🎯 Smart inventory management system</li>
                  <li>📊 Real-time sales analytics & insights</li>
                  <li>💰 Bulk & bundle pricing configurations</li>
                  <li>📦 Order fulfillment tracking</li>
                  <li>📈 Comprehensive vendor dashboard & reports</li>
                  <li>🔔 Customer engagement tools</li>
                </ul>
              </div>
              <div>
                <h6>🏢 For Dark Stores</h6>
                <p style={{fontSize: '12px', color: '#666', marginBottom: '8px'}}>
                  Optimize warehouse operations and inventory
                </p>
                <ul>
                  <li>🏭 Advanced warehouse management system</li>
                  <li>📦 Intelligent stock optimization</li>
                  <li>🚀 Order picking & packing workflows</li>
                  <li>✅ Quality assurance & verification tools</li>
                  <li>🔄 Real-time inventory sync with vendors</li>
                  <li>📊 Performance metrics & reporting</li>
                </ul>
              </div>
              <div>
                <h6>🚚 For Logistics</h6>
                <p style={{fontSize: '12px', color: '#666', marginBottom: '8px'}}>
                  Manage delivery operations efficiently
                </p>
                <ul>
                  <li>👤 Rider management & assignment system</li>
                  <li>🗺️ AI-powered route optimization</li>
                  <li>📍 Real-time GPS tracking & updates</li>
                  <li>⭐ Performance analytics & ratings</li>
                  <li>💬 Customer communication platform</li>
                  <li>💰 Earnings & payment management</li>
                </ul>
              </div>
            </div>
          </article>

          <article className="info-card info-card-wide">
            <h5>Join Our Team</h5>
            <p className="sub">Build the future of fast fashion with us</p>
            <p>
              We're hiring brilliant minds passionate about technology, fashion, and customer excellence. 
              Be part of a team that's transforming how millions of Indians shop for fashion.
            </p>
            <p className="sub">🚀 Exciting Opportunities</p>
            <ul>
              <li><strong>Product & Engineering:</strong> Full-stack developers, iOS/Android engineers, DevOps specialists</li>
              <li><strong>Design:</strong> UI/UX designers, product designers, brand designers</li>
              <li><strong>Operations:</strong> Vendor managers, logistics coordinators, customer success specialists</li>
              <li><strong>Growth:</strong> Marketing specialists, data analysts, business development managers</li>
              <li><strong>Leadership:</strong> Engineering leads, product managers, operational heads</li>
            </ul>
            <p>
              <strong>Competitive Perks:</strong> Attractive salary, flexible work arrangements, learning opportunities, 
              health insurance, performance bonuses, and equity options for select roles.
            </p>
            <p><strong>Interested?</strong> Send your resume to: <a href="mailto:careers@blinkiefash.in">careers@blinkiefash.in</a></p>
          </article>

          <article className="info-card info-card-wide">
            <h5>BlinkieFash Blog</h5>
            <p className="sub">Fashion trends, tech insights, and lifestyle tips</p>
            <p>Discover the latest in fashion, technology, and lifestyle through our curated blog:</p>
            <ul>
              <li><strong>Fashion Forward:</strong> Trending styles, seasonal collections, styling tips</li>
              <li><strong>Tech Talk:</strong> How AI and ML power our platform, innovation stories</li>
              <li><strong>Vendor Spotlight:</strong> Meet our amazing local vendors and artisans</li>
              <li><strong>Sustainability:</strong> Our commitment to ethical and eco-friendly fashion</li>
              <li><strong>Customer Stories:</strong> Real experiences from BlinkieFash shoppers</li>
            </ul>
          </article>

          <article className="info-card info-card-wide">
            <h5>Press & Media</h5>
            <p className="sub">Connect with our team for partnerships and features</p>
            <p>
              BlinkieFash is making headlines in the fast-commerce space. We welcome media enquiries, 
              partnership opportunities, and collaboration proposals from brands and creators.
            </p>
            <p className="sub">📰 We're Covering</p>
            <ul>
              <li>Brand partnerships and collaborations</li>
              <li>Founder and team interviews</li>
              <li>Product launches and announcements</li>
              <li>Industry insights and thought leadership</li>
              <li>Community impact and CSR initiatives</li>
            </ul>
            <p><strong>Media Contact:</strong> For press inquiries, reach out to press@blinkiefash.in</p>
          </article>

          <article className="info-card info-card-wide">
            <h5>Our Commitment</h5>
            <p className="sub">Core values that drive everything we do</p>
            <p style={{marginBottom: '12px', fontSize: '13px', lineHeight: '1.6', color: '#555'}}>
              These six core values form the foundation of BlinkieFash. They guide every decision we make, 
              every feature we build, and every interaction we have with our customers, vendors, and partners.
            </p>
            <div className="values-grid">
              <div>
                <h6>⚡ Speed</h6>
                <p>Fastest possible delivery without compromising on quality or authenticity. We believe good fashion shouldn't require waiting.</p>
              </div>
              <div>
                <h6>🤝 Trust</h6>
                <p>Authentic products from verified vendors with transparent sourcing. Every item is authenticated before delivery to your doorstep.</p>
              </div>
              <div>
                <h6>💡 Innovation</h6>
                <p>Technology-driven solutions that solve real problems in fashion commerce. From AI inventory to real-time tracking systems.</p>
              </div>
              <div>
                <h6>🌱 Sustainability</h6>
                <p>Responsible business practices that protect our environment. Eco-friendly packaging, circular fashion, and sustainable supply chains.</p>
              </div>
              <div>
                <h6>👥 Community</h6>
                <p>Empowering local vendors and artisans with cutting-edge technology. Building a thriving ecosystem where everyone benefits.</p>
              </div>
              <div>
                <h6>✨ Excellence</h6>
                <p>Best-in-class experience at every touchpoint. From user interface to customer service, we never compromise on quality.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="info-banner">
          <h3>Fashion Delivered in a Blink. Try Before You Buy.</h3>
          <p>
            At BlinkieFash, we're not just selling clothes—we're revolutionizing how India shops for fashion. 
            With 60-minute delivery, 20-minute try-before-buy window, 90-second returns, and bundle discounts starting at ₹999, 
            we've created the fastest, most customer-friendly fashion commerce platform. 
            Fast, authentic, reliable, and stylish. That's the BlinkieFash promise.
          </p>
          <button className="info-chat-btn" type="button" onClick={() => navigate("/home")}>Back to Home</button>
        </section>
      </main>

      <Footer />
    </div>
  );
}
