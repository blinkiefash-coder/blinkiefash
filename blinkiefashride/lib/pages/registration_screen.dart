import 'package:flutter/material.dart';

import '../api_service.dart';

class RegistrationScreen extends StatefulWidget {
  const RegistrationScreen({super.key});

  @override
  State<RegistrationScreen> createState() => _RegistrationScreenState();
}

class _RegistrationScreenState extends State<RegistrationScreen> {
  int _step = 0;
  final _apiService = ApiService();
  bool _isLoading = false;

  static const _steps = ['Personal', 'Vehicle', 'Documents', 'Review'];

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _licenseController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  final _vehicleNumberController = TextEditingController();
  String? _vehicleType;
  bool _obscurePass = true;
  bool _obscureConfirm = true;
  bool _verifyAtOffice = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _licenseController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    _vehicleNumberController.dispose();
    super.dispose();
  }

  void _next() async {
    if (_step < _steps.length - 1) {
      if (_step == 2 && !_verifyAtOffice) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Please agree to verify your documents at the office',
            ),
          ),
        );
        return;
      }
      setState(() => _step++);
    } else {
      // Submit registration
      if (_passwordController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please enter a password')),
        );
        return;
      }
      if (_passwordController.text != _confirmController.text) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Passwords do not match')));
        return;
      }
      setState(() => _isLoading = true);
      final result = await _apiService.register(
        name: _nameController.text,
        phone: _phoneController.text,
        password: _passwordController.text,
        vehicleType: _vehicleType ?? 'Bike',
        vehicleNumber: _vehicleNumberController.text,
        licenseNumber: _licenseController.text,
      );
      setState(() => _isLoading = false);
      if (!mounted) return;
      if (result != null && result['token'] != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Registration successful! Please visit our office to verify your documents.',
            ),
          ),
        );
        Future.delayed(const Duration(seconds: 2), () {
          if (!mounted) return;
          Navigator.of(context).pushReplacementNamed('/home');
        });
      } else {
        final msg =
            result?['error'] ?? 'Registration failed. Please try again.';
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: const Color(0xFF16A34A),
        foregroundColor: Colors.white,
        title: const Text(
          'Rider Registration',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        elevation: 0,
      ),
      body: Column(
        children: [
          // Step indicator
          Container(
            color: const Color(0xFF16A34A),
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Row(
              children: List.generate(_steps.length, (index) {
                final active = index == _step;
                final done = index < _step;
                return Expanded(
                  child: Row(
                    children: [
                      Column(
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 220),
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: active || done
                                  ? Colors.white
                                  : Colors.white24,
                            ),
                            child: Center(
                              child: done
                                  ? const Icon(
                                      Icons.check,
                                      color: Color(0xFF16A34A),
                                      size: 18,
                                    )
                                  : Text(
                                      '${index + 1}',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                        color: active
                                            ? const Color(0xFF16A34A)
                                            : Colors.white70,
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _steps[index],
                            style: TextStyle(
                              fontSize: 11,
                              color: active ? Colors.white : Colors.white60,
                              fontWeight: active
                                  ? FontWeight.w700
                                  : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                      if (index < _steps.length - 1)
                        Expanded(
                          child: Container(
                            height: 2,
                            margin: const EdgeInsets.only(bottom: 18),
                            color: index < _step
                                ? Colors.white
                                : Colors.white30,
                          ),
                        ),
                    ],
                  ),
                );
              }),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: _buildStep(),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            child: Column(
              children: [
                FilledButton(
                  onPressed: _isLoading ? null : _next,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          _step == _steps.length - 1 ? 'Submit' : 'Continue',
                        ),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Already have an account? ',
                      style: TextStyle(color: Color(0xFF64748B)),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: const Text(
                        'Login',
                        style: TextStyle(
                          color: Color(0xFF16A34A),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 0:
        return _personalStep();
      case 1:
        return _vehicleStep();
      case 2:
        return _documentsStep();
      default:
        return _reviewStep();
    }
  }

  Widget _field({
    required String label,
    required String hint,
    required IconData icon,
    TextEditingController? controller,
    bool obscure = false,
    VoidCallback? onToggleObscure,
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, color: const Color(0xFF64748B), size: 20),
            suffixIcon: onToggleObscure != null
                ? IconButton(
                    onPressed: onToggleObscure,
                    icon: Icon(
                      obscure
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      color: const Color(0xFF64748B),
                    ),
                  )
                : null,
          ),
        ),
        const SizedBox(height: 14),
      ],
    );
  }

  Widget _personalStep() {
    return Column(
      children: [
        _field(
          label: 'Full Name',
          hint: 'Enter your full name',
          icon: Icons.person_outline,
          controller: _nameController,
        ),
        _field(
          label: 'Phone Number',
          hint: 'Enter your phone number',
          icon: Icons.phone_outlined,
          controller: _phoneController,
          keyboardType: TextInputType.phone,
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Vehicle Type',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _vehicleType,
              hint: const Text('Select vehicle type'),
              decoration: const InputDecoration(
                prefixIcon: Icon(
                  Icons.two_wheeler,
                  color: Color(0xFF64748B),
                  size: 20,
                ),
              ),
              items: const [
                DropdownMenuItem(value: 'Bike', child: Text('Bike')),
                DropdownMenuItem(value: 'Scooter', child: Text('Scooter')),
                DropdownMenuItem(value: 'Bicycle', child: Text('Bicycle')),
              ],
              onChanged: (v) => setState(() => _vehicleType = v),
            ),
            const SizedBox(height: 14),
          ],
        ),
        _field(
          label: 'Driving License Number',
          hint: 'Enter driving license number',
          icon: Icons.credit_card_outlined,
          controller: _licenseController,
        ),
        _field(
          label: 'Password',
          hint: 'Enter a strong password',
          icon: Icons.lock_outline,
          controller: _passwordController,
          obscure: _obscurePass,
          onToggleObscure: () => setState(() => _obscurePass = !_obscurePass),
        ),
        _field(
          label: 'Confirm Password',
          hint: 'Re-enter your password',
          icon: Icons.lock_outline,
          controller: _confirmController,
          obscure: _obscureConfirm,
          onToggleObscure: () =>
              setState(() => _obscureConfirm = !_obscureConfirm),
        ),
      ],
    );
  }

  Widget _vehicleStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Vehicle Details',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 16),
        _field(
          label: 'Vehicle Number',
          hint: 'e.g. KA 01 AB 1234',
          icon: Icons.confirmation_number_outlined,
          controller: _vehicleNumberController,
        ),
        _field(
          label: 'Vehicle Model',
          hint: 'e.g. Honda Activa',
          icon: Icons.two_wheeler,
        ),
        _field(
          label: 'Vehicle Year',
          hint: 'e.g. 2022',
          icon: Icons.calendar_today_outlined,
          keyboardType: TextInputType.number,
        ),
        _field(
          label: 'Insurance Number',
          hint: 'Enter insurance policy number',
          icon: Icons.shield_outlined,
        ),
      ],
    );
  }

  Widget _documentsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Verify Your Documents',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF86EFAC)),
          ),
          child: Column(
            children: [
              const Icon(
                Icons.info_outline,
                color: Color(0xFF16A34A),
                size: 32,
              ),
              const SizedBox(height: 12),
              const Text(
                'Document Verification',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Please bring your original driving license to our nearest office for verification. This helps us ensure the safety and authenticity of our rider partners.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Checkbox(
                    value: _verifyAtOffice,
                    onChanged: (value) =>
                        setState(() => _verifyAtOffice = value ?? false),
                    activeColor: const Color(0xFF16A34A),
                  ),
                  const Expanded(
                    child: Text(
                      'I agree to verify my documents at the office',
                      style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        _field(
          label: 'Password',
          hint: 'Enter password',
          icon: Icons.lock_outline,
          controller: _passwordController,
          obscure: _obscurePass,
          onToggleObscure: () => setState(() => _obscurePass = !_obscurePass),
        ),
        _field(
          label: 'Confirm Password',
          hint: 'Confirm your password',
          icon: Icons.lock_outline,
          controller: _confirmController,
          obscure: _obscureConfirm,
          onToggleObscure: () =>
              setState(() => _obscureConfirm = !_obscureConfirm),
        ),
      ],
    );
  }

  Widget _reviewStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Review Your Details',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 16),
        _reviewCard(
          'Full Name',
          _nameController.text.isEmpty ? 'John Rider' : _nameController.text,
        ),
        _reviewCard(
          'Phone',
          _phoneController.text.isEmpty
              ? '+91 98765 43210'
              : _phoneController.text,
        ),
        _reviewCard('Vehicle Type', _vehicleType ?? 'Bike'),
        _reviewCard(
          'License No.',
          _licenseController.text.isEmpty
              ? 'DL-1234567890'
              : _licenseController.text,
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF86EFAC)),
          ),
          child: const Row(
            children: [
              Icon(Icons.check_circle, color: Color(0xFF16A34A)),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Your documents have been uploaded. Tap Submit to complete registration.',
                  style: TextStyle(
                    color: Color(0xFF166534),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _reviewCard(String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
