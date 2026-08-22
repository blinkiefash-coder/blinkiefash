import 'package:flutter/material.dart';

class PoliciesScreen extends StatelessWidget {
  const PoliciesScreen({super.key});

  static const Color _green = Color(0xFF16A34A);
  static const Color _darkText = Color(0xFF0F172A);

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          surfaceTintColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: _darkText),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          title: Row(
            children: [
              Image.asset('assets/images/logo.png', width: 28, height: 28),
              const SizedBox(width: 6),
              RichText(
                text: const TextSpan(
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
                  children: [
                    TextSpan(
                      text: 'BLINKIE',
                      style: TextStyle(color: _darkText),
                    ),
                    TextSpan(
                      text: 'FASH',
                      style: TextStyle(color: _green),
                    ),
                  ],
                ),
              ),
            ],
          ),
          bottom: const TabBar(
            labelColor: _green,
            unselectedLabelColor: Color(0xFF94A3B8),
            indicatorColor: _green,
            indicatorWeight: 2.5,
            labelStyle: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            unselectedLabelStyle: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
            tabs: [
              Tab(text: 'Policies'),
              Tab(text: 'Support'),
            ],
          ),
        ),
        body: const TabBarView(children: [_PoliciesTab(), _SupportTab()]),
      ),
    );
  }
}

// ── Policies Tab ──────────────────────────────────────────────────────────────
class _PoliciesTab extends StatelessWidget {
  const _PoliciesTab();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        _PolicyCard(
          title: 'Privacy Policy',
          subtitle: 'Your privacy matters to us',
          icon: Icons.privacy_tip_outlined,
          points: [
            'We collect only necessary info: name, contact, delivery address & payment details.',
            'Device and app usage data is used to improve your experience.',
            'Your data is never sold to third parties.',
            'You can request deletion of your account and data at any time.',
          ],
        ),
        _PolicyCard(
          title: 'Terms of Service',
          subtitle: 'Using Blinkiefash means you agree to',
          icon: Icons.description_outlined,
          points: [
            'Provide accurate personal and delivery information.',
            'Respect vendor and delivery policies.',
            'Follow return and Try & Buy rules.',
            'BLINKIEFASH reserves the right to modify services and pricing policies.',
          ],
        ),
        _PolicyCard(
          title: 'Return Policy',
          subtitle: '3-day easy returns & Try & Buy',
          icon: Icons.assignment_return_outlined,
          points: [
            'Items can be returned within 3 days of delivery.',
            'Product must be unused, unwashed, and with original tags.',
            'Try & Buy items can be returned at the door during delivery — no questions asked.',
            'Damaged or defective products are eligible for instant replacement.',
          ],
        ),
        _PolicyCard(
          title: 'Shipping Policy',
          subtitle: '60-minute delivery promise',
          icon: Icons.local_shipping_outlined,
          points: [
            'We deliver in 60 minutes from nearby delivery partners.',
            'Delivery is available within select areas in your city.',
            'Free delivery on orders above ₹1499.',
            'Delivery & handling charge of ₹49 applies for orders below ₹1499.',
          ],
        ),
        _PolicyCard(
          title: 'Refund Policy',
          subtitle: 'Fast & transparent refunds',
          icon: Icons.currency_rupee_rounded,
          points: [
            'Refunds are processed within 5–7 business days after return pick-up.',
            'Payment gateway refunds may take an additional 3–5 banking days.',
            'UPI and wallet refunds are typically instant.',
            'Cash on Delivery refunds are made via bank transfer.',
          ],
        ),
        _PolicyCard(
          title: 'Cancellation Policy',
          subtitle: 'Cancel before dispatch',
          icon: Icons.cancel_outlined,
          points: [
            'Orders can be cancelled before vendor confirmation.',
            'Once dispatched, cancellation may not be possible.',
            'In case of failed delivery, a full refund is issued automatically.',
            'Contact support within 1 hour of placing order to cancel.',
          ],
        ),
        _PolicyCard(
          title: 'EPR Compliance',
          subtitle: 'Sustainable operations',
          icon: Icons.eco_outlined,
          points: [
            'We follow responsible environmental practices.',
            'Eco-friendly packaging initiatives across vendor partners.',
            'Recyclable delivery packaging wherever possible.',
            'Committed to reducing our carbon footprint.',
          ],
        ),
        SizedBox(height: 20),
        _CommitmentBanner(),
      ],
    );
  }
}

// ── Support Tab ───────────────────────────────────────────────────────────────
class _SupportTab extends StatelessWidget {
  const _SupportTab();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Contact card
        Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF16A34A), Color(0xFF15803D)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Contact Support',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(
                    Icons.phone_outlined,
                    color: Colors.white70,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SelectableText(
                      '+91 9827901891',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(
                    Icons.email_outlined,
                    color: Colors.white70,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SelectableText(
                      'support@blinkiefash.in',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Row(
                children: [
                  Icon(
                    Icons.access_time_rounded,
                    color: Colors.white70,
                    size: 16,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Support Hours: 9:00 AM – 11:00 PM',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ],
          ),
        ),
        const _PolicyCard(
          title: 'Order Support',
          subtitle: 'Need help with your order?',
          icon: Icons.receipt_long_outlined,
          points: [
            'Order confirmation and tracking',
            'Product availability queries',
            'Wrong or missing item issues',
            'Order modification requests',
          ],
        ),
        const _PolicyCard(
          title: 'Delivery Support',
          subtitle: 'Delivery updates and partner details',
          icon: Icons.delivery_dining_outlined,
          points: [
            '60-minute delivery status updates',
            'Delayed or failed delivery issues',
            'Address and route queries',
            'Re-delivery scheduling',
          ],
        ),
        const _PolicyCard(
          title: 'Try & Buy Support',
          subtitle: 'Details of trial and returns',
          icon: Icons.checkroom_outlined,
          points: [
            'Trial window and size guidance',
            'How to return at the door',
            'Accept or return process',
            'Refund after Try & Buy return',
          ],
        ),
        const _PolicyCard(
          title: 'Return & Refund Support',
          subtitle: 'Complete return flow guidance',
          icon: Icons.assignment_return_outlined,
          points: [
            'Return eligibility check',
            'Refund status tracking',
            'Damaged product complaints',
            'Product quality issues',
          ],
        ),
        const _PolicyCard(
          title: 'Payment Support',
          subtitle: 'Payments and billing queries',
          icon: Icons.payment_outlined,
          points: [
            'Failed payment resolution',
            'Double charge complaints',
            'Coupon and offer issues',
            'COD and online payment help',
          ],
        ),
        const SizedBox(height: 20),
      ],
    );
  }
}

// ── Reusable card ──────────────────────────────────────────────────────────────
class _PolicyCard extends StatelessWidget {
  const _PolicyCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.points,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final List<String> points;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: const Color(0xFF16A34A), size: 20),
          ),
          title: Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
          ),
          subtitle: Text(
            subtitle,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF94A3B8),
              height: 1.3,
            ),
          ),
          iconColor: const Color(0xFF16A34A),
          collapsedIconColor: const Color(0xFFCBD5E1),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          children: points
              .map(
                (p) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.check_circle_outline_rounded,
                        color: Color(0xFF16A34A),
                        size: 14,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          p,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF475569),
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

class _CommitmentBanner extends StatelessWidget {
  const _CommitmentBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(18),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Our Commitment',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Color(0xFF4ADE80),
            ),
          ),
          SizedBox(height: 8),
          Text(
            'We follow fair practices, protect your information, and ensure a smooth '
            'shopping experience. Safe. Secure. Reliable.',
            style: TextStyle(fontSize: 12, color: Colors.white70, height: 1.5),
          ),
        ],
      ),
    );
  }
}
