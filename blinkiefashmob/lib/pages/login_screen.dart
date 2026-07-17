import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../services/api_client.dart';
import '../services/user_session.dart';
import '../services/notification_service.dart';
import 'signup_screen.dart';
import 'home_screen.dart';
import 'vendor_dashboard_screen.dart';
import '../widgets/bf_loader.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    this.redirectBuilder,
    this.startAsVendor = false,
  });

  final WidgetBuilder? redirectBuilder;
  final bool startAsVendor;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

enum _Mode { otp, verify, password }

class _LoginScreenState extends State<LoginScreen> {
  final ApiClient _api = ApiClient();
  _Mode _mode = _Mode.otp;
  bool _loading = false;
  String? _error;
  String? _verificationId;
  String _normalizedPhone = '';

  final _phoneCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();
  bool _pwHide = true;

  // Hero slider
  static const _heroImages = [
    'assets/images/hero.png',
    'assets/images/hero1.png',
    'assets/images/hero2.png',
    'assets/images/hero3.png',
  ];
  final PageController _heroCtrl = PageController();
  int _heroIndex = 0;
  Timer? _heroTimer;

  @override
  void initState() {
    super.initState();
    if (widget.startAsVendor) {
      _mode = _Mode.password;
    }
    _heroTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted) return;
      final next = (_heroIndex + 1) % _heroImages.length;
      _heroCtrl.animateToPage(
        next,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
      );
    });
  }

  @override
  void dispose() {
    _heroTimer?.cancel();
    _heroCtrl.dispose();
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    _pwCtrl.dispose();
    super.dispose();
  }

  String _digits(String v) => v.replaceAll(RegExp(r'\D'), '');

  void _completeAuth() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: widget.redirectBuilder ?? (_) => const HomeScreen(),
      ),
    );
  }

  Future<void> _sendOtp() async {
    final d = _digits(_phoneCtrl.text.trim());
    if (d.length != 10) {
      setState(() => _error = 'Enter a valid 10-digit mobile number');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: '+91$d',
        verificationCompleted: (PhoneAuthCredential credential) async {
          // Android only — auto-verification when SMS is intercepted
          await _signInWithFirebase(credential);
        },
        verificationFailed: (FirebaseAuthException e) {
          if (mounted) {
            setState(() {
              _loading = false;
              _error = e.message?.isNotEmpty == true
                  ? e.message!
                  : 'Could not send OTP (${e.code}). Check your number and try again.';
            });
          }
        },
        codeSent: (String verificationId, int? resendToken) {
          if (mounted) {
            setState(() {
              _verificationId = verificationId;
              _normalizedPhone = '+91$d';
              _mode = _Mode.verify;
              _loading = false;
            });
          }
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          if (mounted) _verificationId = verificationId;
        },
        timeout: const Duration(seconds: 60),
      );
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _formatAuthError(e);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not send OTP. Please try again.';
        });
      }
    }
  }

  String _formatAuthError(FirebaseAuthException e) {
    switch (e.code) {
      case 'invalid-phone-number':
        return 'Invalid phone number. Enter 10 digits.';
      case 'too-many-requests':
        return 'Too many requests. Please wait before retrying.';
      case 'missing-phone-number':
        return 'Phone number is required.';
      default:
        return e.message?.isNotEmpty == true
            ? e.message!
            : 'OTP could not be sent (${e.code}). Try again.';
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpCtrl.text.trim();
    if (otp.length != 6) {
      setState(() => _error = 'Enter the 6-digit OTP');
      return;
    }
    if (_verificationId == null) {
      setState(() => _error = 'Please request OTP again');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: otp,
      );
      await _signInWithFirebase(credential);
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Invalid OTP. Please try again.';
        });
      }
    }
  }

  Future<void> _signInWithFirebase(PhoneAuthCredential credential) async {
    try {
      final userCred = await FirebaseAuth.instance.signInWithCredential(
        credential,
      );
      final idToken = await userCred.user?.getIdToken();
      if (idToken == null) throw Exception('No ID token');
      final res = await _api.verifyWithFirebaseToken(idToken: idToken);
      if (!mounted) return;
      if (res['success'] != true) {
        final msg = res['message']?.toString() ?? '';
        // New user — redirect to signup with phone pre-filled
        if (msg.toLowerCase().contains('not found') ||
            msg.toLowerCase().contains('register')) {
          final phone = _digits(_phoneCtrl.text.trim());
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => SignupScreen(
                prefillPhone: phone,
                redirectBuilder: widget.redirectBuilder,
              ),
            ),
          );
          return;
        }
        setState(() {
          _loading = false;
          _error = msg.isNotEmpty ? msg : 'Login failed. Please try again.';
        });
        return;
      }
      await UserSession.instance.setFromLoginResponse(res);
      NotificationService.instance.registerForCurrentUser();
      _completeAuth();
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Sign in failed: ${e.toString().split("\n").first}';
        });
      }
    }
  }

  Future<void> _loginPassword() async {
    final identifier = _phoneCtrl.text.trim();
    final looksLikeEmail = identifier.contains('@');
    if (_pwCtrl.text.isEmpty) {
      setState(() => _error = 'Enter your password');
      return;
    }

    if (looksLikeEmail) {
      if (!identifier.contains('.')) {
        setState(() => _error = 'Enter a valid email');
        return;
      }
      await _loginVendorWithCredentials(
        email: identifier,
        password: _pwCtrl.text,
      );
      return;
    }

    final d = _digits(identifier);
    if (d.length != 10) {
      setState(
        () =>
            _error = 'Enter a valid 10-digit mobile number or vendor email',
      );
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.loginWithPassword(
        phone: '+91$d',
        password: _pwCtrl.text,
      );
      if (!mounted) return;
      if (res['success'] != true) {
        setState(() {
          _loading = false;
          _error = res['message']?.toString() ?? 'Login failed';
        });
        return;
      }
      await UserSession.instance.setFromLoginResponse(res);
      NotificationService.instance.registerForCurrentUser();
      _completeAuth();
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Connection error';
        });
      }
    }
  }

  Future<void> _loginVendorWithCredentials({
    required String email,
    required String password,
  }) async {
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid vendor email');
      return;
    }
    if (password.isEmpty || password.length < 6) {
      setState(() => _error = 'Enter your vendor password');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    try {
      final res = await _api.vendorLoginWithPassword(
        email: email,
        password: password,
      );

      if (!mounted) return;

      if (res['success'] == true && res['vendor_id'] != null) {
        final vendorId = res['vendor_id'].toString();
        final vendorUserId = (res['user_id'] ?? '').toString();
        final profile = await _api.fetchVendorProfile(vendorId);
        if (!mounted) return;

        final resolvedStoreName =
            (profile['store_name'] ?? res['store_name'] ?? 'Vendor Store')
                .toString();
        final resolvedEmail = (profile['email'] ?? email).toString();

        if (vendorUserId.isNotEmpty) {
          await UserSession.instance.setVendorSession(
            vendorId: vendorId,
            userId: vendorUserId,
            name: resolvedStoreName,
            email: resolvedEmail,
          );
          await NotificationService.instance.registerForCurrentUser();
        }

        navigator.pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (_) => VendorDashboardScreen(
              vendorId: vendorId,
              storeName: resolvedStoreName,
              email: resolvedEmail,
            ),
          ),
          (_) => false,
        );
        return;
      }

      final msg = (res['message'] ?? 'Vendor login failed').toString();
      messenger.showSnackBar(SnackBar(content: Text(msg)));
    } catch (_) {
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('Unable to login. Please try again.')),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
    );
    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          Positioned.fill(
            child: PageView.builder(
              controller: _heroCtrl,
              itemCount: _heroImages.length,
              onPageChanged: (i) => setState(() => _heroIndex = i),
              itemBuilder: (_, i) =>
                  Image.asset(_heroImages[i], fit: BoxFit.cover),
            ),
          ),
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xDD0C1B0E),
                    Color(0xAA0F2A15),
                    Color(0x220C1B0E),
                  ],
                  stops: [0.0, 0.45, 0.72],
                ),
              ),
            ),
          ),
          // Logo + dots
          Positioned(
            top: size.height * 0.09,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Image.asset('assets/images/logo.png', width: 68, height: 68),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(_heroImages.length, (i) {
                    final active = i == _heroIndex;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: active ? 20 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: active
                            ? Colors.white
                            : Colors.white.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(100),
                      ),
                    );
                  }),
                ),
              ],
            ),
          ),
          // Language chip
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(right: 16, top: 8),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.language, color: Colors.white, size: 15),
                      SizedBox(width: 4),
                      Text(
                        'English',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      SizedBox(width: 2),
                      Icon(
                        Icons.keyboard_arrow_down,
                        color: Colors.white,
                        size: 15,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          // White card
          Align(
            alignment: Alignment.bottomCenter,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxHeight: size.height * 0.70),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 24,
                      offset: Offset(0, -4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(28),
                  ),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
                    child: Column(
                      children: [
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 280),
                          child: _mode == _Mode.otp
                              ? _OtpSendForm(
                                  key: const ValueKey('send'),
                                  ctrl: _phoneCtrl,
                                  loading: _loading,
                                  error: _error,
                                  onSend: _sendOtp,
                                  onPassword: () => setState(() {
                                    _mode = _Mode.password;
                                    _error = null;
                                  }),
                                  onSignup: () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => SignupScreen(
                                        redirectBuilder: widget.redirectBuilder,
                                      ),
                                    ),
                                  ),
                                )
                              : _mode == _Mode.verify
                              ? _OtpVerifyForm(
                                  key: const ValueKey('verify'),
                                  phoneCtrl: _phoneCtrl,
                                  otpCtrl: _otpCtrl,
                                  debugOtp: null,
                                  phone: _normalizedPhone,
                                  loading: _loading,
                                  error: _error,
                                  onVerify: _verifyOtp,
                                  onBack: () => setState(() {
                                    _mode = _Mode.otp;
                                    _error = null;
                                    _otpCtrl.clear();
                                  }),
                                )
                              : _PasswordForm(
                                  key: const ValueKey('pw'),
                                  phoneCtrl: _phoneCtrl,
                                  pwCtrl: _pwCtrl,
                                  pwHide: _pwHide,
                                  loading: _loading,
                                  error: _error,
                                  onToggleHide: () =>
                                      setState(() => _pwHide = !_pwHide),
                                  onLogin: _loginPassword,
                                  onOtp: () => setState(() {
                                    _mode = _Mode.otp;
                                    _error = null;
                                  }),
                                  onSignup: () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => SignupScreen(
                                        redirectBuilder: widget.redirectBuilder,
                                      ),
                                    ),
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (_loading)
            Positioned.fill(
              child: Container(
                color: Colors.black26,
                child: const Center(child: BfSpinner()),
              ),
            ),
        ],
      ),
    );
  }
}

// ── OTP Send Form ────────────────────────────────────────────────────────────
class _OtpSendForm extends StatelessWidget {
  const _OtpSendForm({
    super.key,
    required this.ctrl,
    required this.loading,
    required this.error,
    required this.onSend,
    required this.onPassword,
    required this.onSignup,
  });
  final TextEditingController ctrl;
  final bool loading;
  final String? error;
  final VoidCallback onSend, onPassword, onSignup;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Welcome to BlinkieFash',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Login to continue',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 24),
        const _FieldLabel('Mobile Number'),
        const SizedBox(height: 8),
        _PhoneField(controller: ctrl),
        const SizedBox(height: 16),
        if (error != null) _ErrorText(error!),
        _GreenButton(
          label: 'Send OTP',
          icon: Icons.arrow_forward,
          onTap: loading ? null : onSend,
        ),
        const SizedBox(height: 8),
        Center(
          child: TextButton(
            onPressed: onPassword,
            child: const Text(
              'Login with Password instead',
              style: TextStyle(
                color: Color(0xFF16A34A),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          "We'll send a 6-digit verification code to your phone instantly.",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
        ),
        const SizedBox(height: 20),
        const _OrDivider('or continue with'),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'New here?',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 14),
            ),
            TextButton(
              onPressed: onSignup,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 4),
              ),
              child: const Text(
                'Create Account',
                style: TextStyle(
                  color: Color(0xFF16A34A),
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const _SecurityBadges(),
      ],
    );
  }
}

// ── OTP Verify Form ──────────────────────────────────────────────────────────
class _OtpVerifyForm extends StatelessWidget {
  const _OtpVerifyForm({
    super.key,
    required this.phoneCtrl,
    required this.otpCtrl,
    required this.debugOtp,
    required this.phone,
    required this.loading,
    required this.error,
    required this.onVerify,
    required this.onBack,
  });
  final TextEditingController phoneCtrl, otpCtrl;
  final String? debugOtp;
  final String phone;
  final bool loading;
  final String? error;
  final VoidCallback onVerify, onBack;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            GestureDetector(
              onTap: onBack,
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                color: Color(0xFF374151),
                size: 20,
              ),
            ),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'Verify OTP',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        RichText(
          text: TextSpan(
            style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
            children: [
              const TextSpan(text: 'OTP sent to '),
              TextSpan(
                text: phone,
                style: const TextStyle(
                  color: Color(0xFF0F172A),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        if (debugOtp != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              'Dev OTP: $debugOtp',
              style: const TextStyle(
                color: Color(0xFF16A34A),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        const SizedBox(height: 24),
        AutofillGroup(
          child: TextField(
            controller: otpCtrl,
            keyboardType: TextInputType.number,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            autofillHints: const [AutofillHints.oneTimeCode],
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: 8,
              color: Color(0xFF0F172A),
            ),
            textAlign: TextAlign.center,
            decoration: InputDecoration(
              counterText: '',
              hintText: '● ● ● ● ● ●',
              hintStyle: const TextStyle(
                color: Color(0xFFCBD5E1),
                letterSpacing: 8,
              ),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Color(0xFFE2E8F0),
                  width: 1.5,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Color(0xFFE2E8F0),
                  width: 1.5,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Color(0xFF16A34A),
                  width: 2,
                ),
              ),
            ),
          ),
        ), // AutofillGroup
        const SizedBox(height: 12),
        // ── Paste OTP from clipboard / SMS notification ────────────
        _PasteOtpButton(otpCtrl: otpCtrl),
        const SizedBox(height: 12),
        if (error != null) _ErrorText(error!),
        _GreenButton(
          label: 'Verify OTP',
          icon: Icons.check_circle_outline_rounded,
          onTap: loading ? null : onVerify,
        ),
        const SizedBox(height: 16),
        Center(
          child: TextButton(
            onPressed: onBack,
            child: const Text(
              'Change Number',
              style: TextStyle(
                color: Color(0xFF64748B),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Paste OTP helper ─────────────────────────────────────────────────────────
class _PasteOtpButton extends StatelessWidget {
  const _PasteOtpButton({required this.otpCtrl});
  final TextEditingController otpCtrl;

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text ?? '';
    // Extract first 6-digit sequence from clipboard (works for SMS like "Your OTP is 123456")
    final match = RegExp(r'\b(\d{6})\b').firstMatch(text);
    if (match != null) {
      otpCtrl.text = match.group(1)!;
    } else if (RegExp(r'^\d{1,6}$').hasMatch(text.trim())) {
      otpCtrl.text = text.trim();
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _paste,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFBBF7D0), width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.paste_rounded, size: 18, color: Color(0xFF16A34A)),
            SizedBox(width: 8),
            Text(
              'Paste OTP',
              style: TextStyle(
                color: Color(0xFF15803D),
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(width: 6),
            Text(
              '· Auto-fill from SMS',
              style: TextStyle(
                color: Color(0xFF4ADE80),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Password Form ─────────────────────────────────────────────────────────────
class _PasswordForm extends StatelessWidget {
  const _PasswordForm({
    super.key,
    required this.phoneCtrl,
    required this.pwCtrl,
    required this.pwHide,
    required this.loading,
    required this.error,
    required this.onToggleHide,
    required this.onLogin,
    required this.onOtp,
    required this.onSignup,
  });
  final TextEditingController phoneCtrl, pwCtrl;
  final bool pwHide, loading;
  final String? error;
  final VoidCallback onToggleHide, onLogin, onOtp, onSignup;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Welcome back',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Login with your password',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 24),
        const _FieldLabel('Mobile Number or Vendor Email'),
        const SizedBox(height: 8),
        _PhoneField(
          controller: phoneCtrl,
          allowEmail: true,
          hintText: 'Enter mobile number or vendor email',
        ),
        const SizedBox(height: 14),
        const _FieldLabel('Password'),
        const SizedBox(height: 8),
        TextField(
          controller: pwCtrl,
          obscureText: pwHide,
          decoration: InputDecoration(
            hintText: 'Enter your password',
            hintStyle: const TextStyle(color: Color(0xFFCBD5E1)),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFF16A34A), width: 2),
            ),
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
        const SizedBox(height: 16),
        if (error != null) _ErrorText(error!),
        _GreenButton(
          label: 'Login',
          icon: Icons.arrow_forward,
          onTap: loading ? null : onLogin,
        ),
        const SizedBox(height: 8),
        Center(
          child: TextButton(
            onPressed: onOtp,
            child: const Text(
              'Login with OTP instead',
              style: TextStyle(
                color: Color(0xFF16A34A),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        const _OrDivider('or continue with'),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'New here?',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 14),
            ),
            TextButton(
              onPressed: onSignup,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 4),
              ),
              child: const Text(
                'Create Account',
                style: TextStyle(
                  color: Color(0xFF16A34A),
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        const _SecurityBadges(),
      ],
    );
  }
}

// ── Reusable mini-widgets ─────────────────────────────────────────────────────
class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: Color(0xFF374151),
    ),
  );
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Text(
      text,
      style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13),
    ),
  );
}

class _PhoneField extends StatelessWidget {
  const _PhoneField({
    required this.controller,
    this.allowEmail = false,
    this.hintText = 'Enter 10 digit mobile number',
  });
  final TextEditingController controller;
  final bool allowEmail;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    if (allowEmail) {
      return SizedBox(
        height: 54,
        child: TextField(
          controller: controller,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [
            AutofillHints.username,
            AutofillHints.telephoneNumberNational,
          ],
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: const TextStyle(
              color: Color(0xFFCBD5E1),
              fontSize: 14,
            ),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFF16A34A), width: 2),
            ),
          ),
        ),
      );
    }

    return Row(
      children: [
        Container(
          height: 54,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('🇮🇳', style: TextStyle(fontSize: 18)),
              SizedBox(width: 6),
              Text(
                '+91',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF374151),
                  fontSize: 15,
                ),
              ),
              SizedBox(width: 4),
              Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 18,
                color: Color(0xFF94A3B8),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: SizedBox(
            height: 54,
            child: TextField(
              controller: controller,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              autofillHints: const [AutofillHints.telephoneNumberNational],
              decoration: InputDecoration(
                counterText: '',
                hintText: 'Enter 10 digit mobile number',
                hintStyle: const TextStyle(
                  color: Color(0xFFCBD5E1),
                  fontSize: 14,
                ),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(
                    color: Color(0xFF16A34A),
                    width: 2,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _GreenButton extends StatelessWidget {
  const _GreenButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedOpacity(
        opacity: onTap == null ? 0.6 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF16A34A), Color(0xFF15803D)],
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: const [
              BoxShadow(
                color: Color(0x3316A34A),
                blurRadius: 12,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
              const SizedBox(width: 8),
              Icon(icon, color: Colors.white, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider(this.label);
  final String label;
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: Color(0xFFE2E8F0), thickness: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF94A3B8),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const Expanded(child: Divider(color: Color(0xFFE2E8F0), thickness: 1)),
      ],
    );
  }
}

class _SecurityBadges extends StatelessWidget {
  const _SecurityBadges();
  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _Badge(
          icon: Icons.verified_user_outlined,
          label: 'Secure OTP\nVerified',
        ),
        _Badge(icon: Icons.shield_outlined, label: 'Account\nProtected'),
        _Badge(
          icon: Icons.electric_bolt_outlined,
          label: '60-Minute\nDelivery',
        ),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.icon, required this.label});
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: const Color(0xFF16A34A), size: 22),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 10,
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w500,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}
