import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class VendorHelpScreen extends StatelessWidget {
  const VendorHelpScreen({super.key});

  static const String _supportPhone = '919827901891';
  static const String _displayPhone = '+91 98279 01891';
  static const String _supportEmail = 'support@blinkiefash.in';

  void _showLaunchError(ScaffoldMessengerState? messenger, String message) {
    messenger?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _openWhatsApp(BuildContext context) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final text = Uri.encodeComponent(
      'Hi BlinkieFash Support, I need help with my vendor account.',
    );
    final nativeUri = Uri.parse('whatsapp://send?phone=$_supportPhone&text=$text');
    final webUri = Uri.parse('https://wa.me/$_supportPhone?text=$text');

    try {
      if (await canLaunchUrl(nativeUri)) {
        final ok = await launchUrl(
          nativeUri,
          mode: LaunchMode.externalApplication,
        );
        if (ok) return;
      }

      final webOk = await launchUrl(webUri, mode: LaunchMode.externalApplication);
      if (!webOk) {
        _showLaunchError(
          messenger,
          'Could not open WhatsApp. Please try again from your device.',
        );
      }
    } catch (_) {
      _showLaunchError(
        messenger,
        'Could not open WhatsApp. Please try again from your device.',
      );
    }
  }

  Future<void> _openEmail(BuildContext context) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final subject = Uri.encodeComponent('Vendor Support Request - BlinkieFash');
    final body = Uri.encodeComponent(
      'Hi BlinkieFash Support,\n\nI need help with:\n\n',
    );
    final uri = Uri.parse('mailto:$_supportEmail?subject=$subject&body=$body');

    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok) {
        _showLaunchError(
          messenger,
          'Could not open email app. Please try again from your device.',
        );
      }
    } catch (_) {
      _showLaunchError(
        messenger,
        'Could not open email app. Please try again from your device.',
      );
    }
  }

  Future<void> _openCall(BuildContext context) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final uri = Uri.parse('tel:+$_supportPhone');
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok) {
        _showLaunchError(
          messenger,
          'Could not open dialer. Please call $_displayPhone manually.',
        );
      }
    } catch (_) {
      _showLaunchError(
        messenger,
        'Could not open dialer. Please call $_displayPhone manually.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Vendor Help Center'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF16A34A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Need Assistance?',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'Reach the BlinkieFash support team in one tap and get quick help for your vendor account, products, stock, or orders.',
                  style: TextStyle(
                    color: Color(0xFFDCFCE7),
                    height: 1.4,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _ActionCard(
            title: 'Chat on WhatsApp',
            subtitle: 'Fastest way to get a response',
            icon: Icons.chat_rounded,
            color: const Color(0xFF25D366),
            buttonText: 'Open WhatsApp',
            onTap: () => _openWhatsApp(context),
          ),
          const SizedBox(height: 12),
          _ActionCard(
            title: 'Email Support',
            subtitle: _supportEmail,
            icon: Icons.email_rounded,
            color: const Color(0xFF2563EB),
            buttonText: 'Send Email',
            onTap: () => _openEmail(context),
          ),
          const SizedBox(height: 12),
          _ActionCard(
            title: 'Call Support',
            subtitle: _displayPhone,
            icon: Icons.phone_in_talk_rounded,
            color: const Color(0xFF0EA5E9),
            buttonText: 'Call Now',
            onTap: () => _openCall(context),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Support Hours',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: Color(0xFF0F172A),
                  ),
                ),
                SizedBox(height: 6),
                Text(
                  'Daily, 9:00 AM - 9:00 PM',
                  style: TextStyle(
                    color: Color(0xFF475569),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Share your order ID or product name for faster resolution.',
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.buttonText,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String buttonText;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: onTap,
                  style: FilledButton.styleFrom(backgroundColor: color),
                  icon: Icon(icon, size: 16),
                  label: Text(buttonText),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
