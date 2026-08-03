import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final ApiService _api = ApiService();
  bool _loading = false;
  bool _pwHide = true;
  String? _error;

  final _phoneCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _pwCtrl.dispose();
    super.dispose();
  }

  String _digits(String v) => v.replaceAll(RegExp(r'\D'), '');

  Future<void> _login() async {
    final d = _digits(_phoneCtrl.text.trim());
    if (d.length != 10) {
      setState(() => _error = 'Enter valid 10-digit phone number');
      return;
    }
    if (_pwCtrl.text.isEmpty) {
      setState(() => _error = 'Enter your password');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _api.login('+91$d', _pwCtrl.text);
    if (!mounted) return;
    if (result != null && result['token'] != null) {
      Navigator.of(context).pushReplacementNamed('/home');
    } else {
      setState(() {
        _loading = false;
        _error = result?['error']?.toString() ?? 'Login failed. Contact admin.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A1A10),
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: -80,
              left: -60,
              child: Container(
                width: 240,
                height: 240,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0x1A16A34A),
                ),
              ),
            ),
            Positioned(
              bottom: -60,
              right: -50,
              child: Container(
                width: 180,
                height: 180,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0x1222C55E),
                ),
              ),
            ),
            SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 40),
                  Center(
                    child: Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0x5534D399),
                          width: 1.5,
                        ),
                      ),
                      child: ClipOval(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Image.asset(
                            'asset/logo.jpeg',
                            fit: BoxFit.contain,
                            errorBuilder: (_, _, _) => const Icon(
                              Icons.electric_moped,
                              size: 48,
                              color: Color(0xFF22C55E),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'BLINKIEFASH',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFFF0FDF4),
                      letterSpacing: 2,
                    ),
                  ),
                  const Text(
                    'RIDER',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF4ADE80),
                      letterSpacing: 6,
                    ),
                  ),
                  const SizedBox(height: 48),
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x1A000000),
                          blurRadius: 24,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: _LoginForm(
                      phoneCtrl: _phoneCtrl,
                      pwCtrl: _pwCtrl,
                      pwHide: _pwHide,
                      loading: _loading,
                      error: _error,
                      onToggleHide: () => setState(() => _pwHide = !_pwHide),
                      onLogin: _login,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.security, size: 14, color: Color(0xFF4ADE80)),
                      SizedBox(width: 6),
                      Text(
                        'Secure login · Your data is safe',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF86EFAC),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: TextButton(
                      onPressed: _loading
                          ? null
                          : () => Navigator.of(context).pushNamed('/register'),
                      child: const Text.rich(
                        TextSpan(
                          text: 'New rider? ',
                          style: TextStyle(
                            color: Color(0xFF86EFAC),
                            fontSize: 14,
                          ),
                          children: [
                            TextSpan(
                              text: 'Sign up',
                              style: TextStyle(
                                color: Color(0xFF4ADE80),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_loading)
              Positioned.fill(
                child: Container(
                  color: Colors.black38,
                  child: const Center(
                    child: CircularProgressIndicator(color: Color(0xFF22C55E)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Login form (phone + password) ───────────────────────────────────────────
class _LoginForm extends StatelessWidget {
  const _LoginForm({
    required this.phoneCtrl,
    required this.pwCtrl,
    required this.pwHide,
    required this.loading,
    required this.error,
    required this.onToggleHide,
    required this.onLogin,
  });
  final TextEditingController phoneCtrl, pwCtrl;
  final bool pwHide, loading;
  final String? error;
  final VoidCallback onToggleHide, onLogin;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Welcome back!',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Login with your mobile number and password',
          style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 24),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 14,
                ),
                decoration: const BoxDecoration(
                  border: Border(right: BorderSide(color: Color(0xFFE5E7EB))),
                ),
                child: const Text(
                  '+91',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF374151),
                  ),
                ),
              ),
              Expanded(
                child: TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  maxLength: 10,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: const InputDecoration(
                    counterText: '',
                    hintText: 'Mobile number',
                    hintStyle: TextStyle(
                      color: Color(0xFFCBD5E1),
                      fontWeight: FontWeight.w400,
                    ),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: pwCtrl,
          obscureText: pwHide,
          decoration: InputDecoration(
            hintText: 'Password',
            hintStyle: const TextStyle(color: Color(0xFFCBD5E1)),
            suffixIcon: IconButton(
              icon: Icon(
                pwHide
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                color: const Color(0xFF94A3B8),
              ),
              onPressed: onToggleHide,
            ),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: 10),
          Text(
            error!,
            style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF16A34A),
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          onPressed: loading ? null : onLogin,
          child: loading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text(
                  'Login',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
        ),
      ],
    );
  }
}
