import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_contacts/flutter_contacts.dart';
import '../services/api_client.dart';
import '../services/user_session.dart';

class ParcelCheckoutScreen extends StatefulWidget {
  final String pickupText;
  final String dropText;
  final double pickupLat;
  final double pickupLng;
  final double dropLat;
  final double dropLng;
  final String city;
  final num estimatedFare;
  final num distanceKm;

  const ParcelCheckoutScreen({
    super.key,
    required this.pickupText,
    required this.dropText,
    required this.pickupLat,
    required this.pickupLng,
    required this.dropLat,
    required this.dropLng,
    required this.city,
    required this.estimatedFare,
    required this.distanceKm,
  });

  @override
  State<ParcelCheckoutScreen> createState() => _ParcelCheckoutScreenState();
}

class _ParcelCheckoutScreenState extends State<ParcelCheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _receiverNameCtrl = TextEditingController();
  final _receiverPhoneCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();

  // 'sender' = sender pays, 'receiver' = receiver pays (COD)
  String _whoPays = 'sender';
  bool _submitting = false;

  final _api = ApiClient();

  static const _green = Color(0xFF16A34A);

  Future<void> _selectContact() async {
    try {
      // showPicker() without properties = permissionless; we fetch full contact after
      final contact = await FlutterContacts.native.showPicker();
      if (contact == null || !mounted) return;

      Contact full = contact;

      // Native picker only returns ID without properties — always fetch full contact
      if (contact.id?.isNotEmpty ?? false) {
        final status = await FlutterContacts.permissions.request(
          PermissionType.read,
        );
        if (status == PermissionStatus.granted ||
            status == PermissionStatus.limited) {
          final fetched = await FlutterContacts.get(
            contact.id!,
            properties: {ContactProperty.phone, ContactProperty.name},
          );
          if (fetched != null) full = fetched;
        }
      }

      String phone = '';
      if (full.phones.isNotEmpty) {
        final normalized = full.phones.first.normalizedNumber;
        final raw =
            ((normalized != null && normalized.isNotEmpty)
                    ? normalized
                    : full.phones.first.number)
                .replaceAll(RegExp(r'[^\d]'), '');
        phone = raw.length > 10 ? raw.substring(raw.length - 10) : raw;
      }

      final firstName = full.name?.first ?? '';
      final lastName = full.name?.last ?? '';
      final composed = [
        firstName,
        lastName,
      ].where((s) => s.isNotEmpty).join(' ').trim();
      final displayName = full.displayName ?? '';
      final name = displayName.isNotEmpty ? displayName : composed;

      setState(() {
        if (name.isNotEmpty) _receiverNameCtrl.text = name;
        if (phone.isNotEmpty) _receiverPhoneCtrl.text = phone;
      });

      if (phone.isEmpty && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Phone not found — please type it manually.'),
          ),
        );
      }
    } catch (e) {
      debugPrint('Contact pick error: $e');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: ${e.toString()}')));
      }
    }
  }

  @override
  void dispose() {
    _receiverNameCtrl.dispose();
    _receiverPhoneCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _submitting = true);
    try {
      final res = await _api.createDeliverRequest(
        userId: UserSession.instance.userId,
        pickupText: widget.pickupText,
        dropText: widget.dropText,
        pickupLat: widget.pickupLat,
        pickupLng: widget.pickupLng,
        dropLat: widget.dropLat,
        dropLng: widget.dropLng,
        city: widget.city,
        receiverName: _receiverNameCtrl.text.trim(),
        receiverPhone: _receiverPhoneCtrl.text.trim(),
        note: _noteCtrl.text.trim(),
        whoPays: _whoPays,
      );

      if (!mounted) return;
      if (res['success'] == true) {
        // Return parcel ID so customer app can navigate to tracking
        final parcelId = res['request']?['id'] as String?;
        Navigator.of(
          context,
        ).pop(parcelId); // Return parcel ID instead of just true
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Parcel booked successfully!')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['message'] ?? res['error'] ?? 'Booking failed').toString(),
            ),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Booking failed. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Parcel Details',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Route summary card ──
            _RouteCard(
              pickupText: widget.pickupText,
              dropText: widget.dropText,
              fare: widget.estimatedFare,
              distanceKm: widget.distanceKm,
            ),
            const SizedBox(height: 16),

            // ── Receiver details ──
            const _SectionLabel('Receiver Details'),
            const SizedBox(height: 8),
            _field(
              controller: _receiverNameCtrl,
              label: 'Receiver name',
              icon: Icons.person_outline_rounded,
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? 'Enter receiver name'
                  : null,
            ),
            const SizedBox(height: 10),
            _field(
              controller: _receiverPhoneCtrl,
              label: 'Receiver phone',
              icon: Icons.phone_outlined,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              maxLength: 10,
              suffixIcon: IconButton(
                icon: const Icon(
                  Icons.contacts_rounded,
                  color: _green,
                  size: 20,
                ),
                onPressed: _selectContact,
                tooltip: 'Select from contacts',
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Enter phone number';
                if (v.trim().length < 10) return 'Enter valid 10-digit number';
                return null;
              },
            ),
            const SizedBox(height: 10),
            _field(
              controller: _noteCtrl,
              label: 'Note for rider (optional)',
              icon: Icons.notes_rounded,
              maxLines: 2,
            ),
            const SizedBox(height: 16),

            // ── Who pays ──
            const _SectionLabel('Payment'),
            const SizedBox(height: 8),
            _WhoPaysSelector(
              value: _whoPays,
              fare: widget.estimatedFare,
              onChanged: (v) => setState(() => _whoPays = v),
            ),
            const SizedBox(height: 24),

            // ── Book Now ──
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: _green,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: _submitting ? null : _confirm,
                icon: _submitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons.local_shipping_rounded,
                        color: Colors.white,
                      ),
                label: Text(
                  _submitting
                      ? 'Booking...'
                      : 'Book Now — ₹${widget.estimatedFare}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    List<TextInputFormatter>? inputFormatters,
    int? maxLength,
    int maxLines = 1,
    String? Function(String?)? validator,
    Widget? suffixIcon,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      maxLength: maxLength,
      maxLines: maxLines,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        suffixIcon: suffixIcon,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        counterText: '',
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: Color(0xFF475569),
        letterSpacing: 0.4,
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  final String pickupText;
  final String dropText;
  final num fare;
  final num distanceKm;

  const _RouteCard({
    required this.pickupText,
    required this.dropText,
    required this.fare,
    required this.distanceKm,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _RouteRow(
            icon: Icons.trip_origin_rounded,
            color: const Color(0xFF16A34A),
            label: 'Pickup',
            text: pickupText,
          ),
          Padding(
            padding: const EdgeInsets.only(left: 11),
            child: Container(
              width: 1.5,
              height: 20,
              color: const Color(0xFFCBD5E1),
            ),
          ),
          _RouteRow(
            icon: Icons.place_rounded,
            color: const Color(0xFFEF4444),
            label: 'Drop',
            text: dropText,
          ),
          const Divider(height: 20),
          Row(
            children: [
              _Chip(
                icon: Icons.route_rounded,
                label: '$distanceKm km',
                color: const Color(0xFF0EA5E9),
              ),
              const SizedBox(width: 8),
              _Chip(
                icon: Icons.currency_rupee_rounded,
                label: 'Fare ₹$fare',
                color: const Color(0xFF16A34A),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RouteRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String text;

  const _RouteRow({
    required this.icon,
    required this.color,
    required this.label,
    required this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                text,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0F172A),
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _Chip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _WhoPaysSelector extends StatelessWidget {
  final String value;
  final num fare;
  final ValueChanged<String> onChanged;

  const _WhoPaysSelector({
    required this.value,
    required this.fare,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _PayOption(
            selected: value == 'sender',
            icon: Icons.person_rounded,
            title: 'Sender pays',
            subtitle: '₹$fare upfront',
            onTap: () => onChanged('sender'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _PayOption(
            selected: value == 'receiver',
            icon: Icons.person_outline_rounded,
            title: 'Receiver pays',
            subtitle: 'Cash on delivery',
            onTap: () => onChanged('receiver'),
          ),
        ),
      ],
    );
  }
}

class _PayOption extends StatelessWidget {
  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _PayOption({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = selected ? const Color(0xFF16A34A) : const Color(0xFF94A3B8);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 18),
                const Spacer(),
                if (selected)
                  const Icon(
                    Icons.check_circle_rounded,
                    color: Color(0xFF16A34A),
                    size: 18,
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: selected
                    ? const Color(0xFF166534)
                    : const Color(0xFF334155),
              ),
            ),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 11,
                color: selected
                    ? const Color(0xFF16A34A)
                    : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
