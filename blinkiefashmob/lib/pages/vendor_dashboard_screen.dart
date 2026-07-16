import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/api_client.dart';
import 'vendor_login_screen.dart';

class VendorDashboardScreen extends StatefulWidget {
  const VendorDashboardScreen({
    super.key,
    required this.vendorId,
    required this.storeName,
    required this.email,
  });

  final String vendorId;
  final String storeName;
  final String email;

  @override
  State<VendorDashboardScreen> createState() => _VendorDashboardScreenState();
}

class _VendorDashboardScreenState extends State<VendorDashboardScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _tab == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _tab != 0) {
          setState(() => _tab = 0);
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          surfaceTintColor: Colors.white,
          titleSpacing: 0,
          toolbarHeight: 60,
          title: Row(
            children: [
              const SizedBox(width: 6),
              Image.asset('assets/images/logo.png', width: 32, height: 32),
              const SizedBox(width: 6),
              Flexible(
                child: RichText(
                  overflow: TextOverflow.ellipsis,
                  text: TextSpan(
                    style: TextStyle(
                      fontFamily: 'Montserrat',
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                    ),
                    children: [
                      TextSpan(
                        text: 'BLINKIE',
                        style: TextStyle(color: Color(0xFF0F172A)),
                      ),
                      TextSpan(
                        text: 'FASH',
                        style: TextStyle(color: Color(0xFF16A34A)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(26),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  widget.storeName,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          actions: [
            IconButton(
              tooltip: 'Logout',
              onPressed: () {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const VendorLoginScreen()),
                  (_) => false,
                );
              },
              icon: const Icon(Icons.logout_rounded),
            ),
          ],
        ),
        body: IndexedStack(
          index: _tab,
          children: [
            _VendorAddProductTab(vendorId: widget.vendorId),
            _VendorStockMonitoringTab(vendorId: widget.vendorId),
            _VendorStockUpdateTab(vendorId: widget.vendorId),
            _VendorOrdersTab(vendorId: widget.vendorId),
          ],
        ),
        bottomNavigationBar: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          selectedItemColor: const Color(0xFF16A34A),
          unselectedItemColor: const Color(0xFF94A3B8),
          selectedLabelStyle: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: const TextStyle(fontSize: 11),
          backgroundColor: Colors.white,
          elevation: 12,
          currentIndex: _tab,
          onTap: (i) => setState(() => _tab = i),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.add_box_outlined),
              activeIcon: Icon(Icons.add_box_rounded),
              label: 'Add Product',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.inventory_2_outlined),
              activeIcon: Icon(Icons.inventory_2_rounded),
              label: 'Stock',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.tune_outlined),
              activeIcon: Icon(Icons.tune_rounded),
              label: 'Update',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long_outlined),
              activeIcon: Icon(Icons.receipt_long_rounded),
              label: 'Orders',
            ),
          ],
        ),
      ),
    );
  }
}

class _VendorAddProductTab extends StatefulWidget {
  const _VendorAddProductTab({required this.vendorId});

  final String vendorId;

  @override
  State<_VendorAddProductTab> createState() => _VendorAddProductTabState();
}

class _VendorAddProductTabState extends State<_VendorAddProductTab> {
  final ApiClient _api = ApiClient();
  final ImagePicker _picker = ImagePicker();
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _shortDescController = TextEditingController();
  final _fullDescController = TextEditingController();
  final _brandController = TextEditingController();

  List<Map<String, dynamic>> _brands = const [];
  final Map<String, String> _categoryNameById = {};
  final Map<String, List<Map<String, dynamic>>> _childrenByParent = {};
  List<Map<String, dynamic>> _parentCategories = const [];
  List<Map<String, dynamic>> _childCategories = const [];
  List<Map<String, dynamic>> _subChildCategories = const [];
  List<Map<String, dynamic>> _darkStores = const [];
  String? _selectedParentCategoryId;
  String? _selectedChildCategoryId;
  String? _selectedCategoryId;
  String? _selectedStoreId;
  bool _loadingCategories = true;
  bool _loadingStores = true;
  bool _submitting = false;
  bool _loadingRecent = true;
  List<Map<String, dynamic>> _recentProducts = const [];
  String? _categoriesError;
  bool _isTryEnabled = true;
  bool _buy2At999 = false;
  bool _buy3At999 = false;
  bool _buy4At999 = false;
  List<_VariantDraft> _variants = [_VariantDraft()];

  @override
  void initState() {
    super.initState();
    _loadBrandsAndCategories();
    _loadDarkStores();
    _loadRecentProducts();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _shortDescController.dispose();
    _fullDescController.dispose();
    _brandController.dispose();
    for (final v in _variants) {
      v.dispose();
    }
    super.dispose();
  }

  Map<String, List<Map<String, dynamic>>> _buildChildrenMap(
    List<Map<String, dynamic>> rows,
  ) {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final row in rows) {
      final parentKey = (row['parent_id']?.toString().isNotEmpty ?? false)
          ? row['parent_id'].toString()
          : 'ROOT';
      map.putIfAbsent(parentKey, () => []);
      map[parentKey]!.add(row);
    }
    for (final key in map.keys) {
      map[key]!.sort(
        (a, b) => (a['name'] ?? '').toString().compareTo(
          (b['name'] ?? '').toString(),
        ),
      );
    }
    return map;
  }

  Future<void> _loadBrandsAndCategories() async {
    setState(() => _loadingCategories = true);
    try {
      final values = await Future.wait([
        _api.fetchBrands(),
        _api.fetchCategories(),
      ]);

      final brands = values[0]
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((e) => (e['name'] ?? '').toString().trim().isNotEmpty)
          .toList();

      final categories = values[1]
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((e) => e['id'] != null)
          .toList();

      final childrenMap = _buildChildrenMap(categories);
      final parents = childrenMap['ROOT'] ?? const <Map<String, dynamic>>[];

      if (!mounted) return;
      setState(() {
        _categoriesError = null;
        _brands = brands;
        _childrenByParent
          ..clear()
          ..addAll(childrenMap);
        _categoryNameById
          ..clear()
          ..addEntries(
            categories.map(
              (c) => MapEntry(c['id'].toString(), (c['name'] ?? '').toString()),
            ),
          );
        _parentCategories = parents;
        _childCategories = const [];
        _subChildCategories = const [];
        _selectedParentCategoryId = null;
        _selectedChildCategoryId = null;
        _selectedCategoryId = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _brands = const [];
        _childrenByParent.clear();
        _categoryNameById.clear();
        _parentCategories = const [];
        _childCategories = const [];
        _subChildCategories = const [];
        _selectedParentCategoryId = null;
        _selectedChildCategoryId = null;
        _selectedCategoryId = null;
        _categoriesError = 'Could not load brands/categories from database';
      });
    } finally {
      if (mounted) setState(() => _loadingCategories = false);
    }
  }

  void _onParentCategoryChanged(String? parentId) {
    final children = parentId == null
        ? const <Map<String, dynamic>>[]
        : (_childrenByParent[parentId] ?? const <Map<String, dynamic>>[]);

    setState(() {
      _selectedParentCategoryId = parentId;
      _selectedChildCategoryId = null;
      _childCategories = children;
      _subChildCategories = const [];
      _selectedCategoryId = children.isEmpty ? parentId : null;
    });
  }

  void _onChildCategoryChanged(String? childId) {
    final subChildren = childId == null
        ? const <Map<String, dynamic>>[]
        : (_childrenByParent[childId] ?? const <Map<String, dynamic>>[]);

    setState(() {
      _selectedChildCategoryId = childId;
      _subChildCategories = subChildren;
      _selectedCategoryId = subChildren.isEmpty ? childId : null;
    });
  }

  Future<void> _loadRecentProducts() async {
    setState(() => _loadingRecent = true);
    try {
      final data = await _api.fetchVendorProducts(widget.vendorId);
      final rows = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .take(6)
          .toList();
      if (!mounted) return;
      setState(() => _recentProducts = rows);
    } finally {
      if (mounted) setState(() => _loadingRecent = false);
    }
  }

  Future<void> _loadDarkStores() async {
    setState(() => _loadingStores = true);
    try {
      final stores = await _api.fetchDarkStores();
      final rows = stores
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((e) => e['id'] != null)
          .toList();
      if (!mounted) return;
      setState(() {
        _darkStores = rows;
        if (_selectedStoreId == null && rows.isNotEmpty) {
          _selectedStoreId = rows.first['id']?.toString();
        }
      });
    } finally {
      if (mounted) setState(() => _loadingStores = false);
    }
  }

  void _addVariant() {
    setState(() => _variants.add(_VariantDraft()));
  }

  void _removeVariant(int index) {
    if (_variants.length <= 1) return;
    setState(() {
      _variants[index].dispose();
      _variants.removeAt(index);
    });
  }

  Future<void> _pickVariantImages(int index) async {
    final images = await _picker.pickMultiImage(
      imageQuality: 85,
      maxWidth: 1800,
    );
    if (images.isEmpty || !mounted) return;
    setState(() {
      _variants[index].imagePaths.addAll(images.map((e) => e.path));
    });
  }

  void _removeVariantImage(int variantIndex, int imageIndex) {
    setState(() {
      _variants[variantIndex].imagePaths.removeAt(imageIndex);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategoryId == null || _selectedCategoryId!.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please select a category')));
      return;
    }

    setState(() => _submitting = true);
    try {
      final variantPayload = <Map<String, dynamic>>[];
      for (final v in _variants) {
        final price = double.tryParse(v.priceCtrl.text.trim());
        final mrp = double.tryParse(v.mrpCtrl.text.trim());
        final qty = int.tryParse(v.stockCtrl.text.trim());
        if (price == null ||
            price <= 0 ||
            mrp == null ||
            mrp <= 0 ||
            qty == null ||
            qty < 0) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Please enter valid variant price/MRP/stock values',
              ),
            ),
          );
          setState(() => _submitting = false);
          return;
        }
        final uploaded = await _api.uploadImages(v.imagePaths);
        variantPayload.add({
          'size': v.sizeCtrl.text.trim().isEmpty ? 'M' : v.sizeCtrl.text.trim(),
          'color': v.colorCtrl.text.trim().isEmpty
              ? 'Black'
              : v.colorCtrl.text.trim(),
          'mrp': mrp,
          'price': price,
          'quantity': qty,
          'images': uploaded,
        });
      }

      final res = await _api.createVendorProduct(
        vendorId: widget.vendorId,
        categoryId: _selectedCategoryId!,
        name: _nameController.text.trim(),
        shortDescription: _shortDescController.text.trim(),
        fullDescription: _fullDescController.text.trim(),
        brand: _brandController.text.trim(),
        storeId: _selectedStoreId,
        variants: variantPayload,
        isTryEnabled: _isTryEnabled,
        bundleOffers: [
          if (_buy2At999)
            {'quantity_min': 2, 'quantity_max': 2, 'discount_value': 999},
          if (_buy3At999)
            {'quantity_min': 3, 'quantity_max': 3, 'discount_value': 999},
          if (_buy4At999)
            {'quantity_min': 4, 'quantity_max': null, 'discount_value': 999},
        ],
      );

      if (!mounted) return;

      if (res['success'] == true) {
        _nameController.clear();
        _shortDescController.clear();
        _fullDescController.clear();
        _brandController.clear();
        for (final v in _variants) {
          v.dispose();
        }
        _variants = [_VariantDraft()];
        setState(() {
          _isTryEnabled = true;
          _buy2At999 = false;
          _buy3At999 = false;
          _buy4At999 = false;
        });
        _loadRecentProducts();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Product created successfully')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['message'] ?? res['error'] ?? 'Unable to create product')
                  .toString(),
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid values or server error')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
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
                  'Add Product',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 6),
                Text(
                  'Directly synced with database products table and inventory.',
                  style: TextStyle(color: Color(0xFFDCFCE7)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Product Name',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Product name is required'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _shortDescController,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Short Description (Web field)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _fullDescController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Full Description (Web field)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _brandController,
                    decoration: const InputDecoration(
                      labelText: 'Brand (optional)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _loadingStores
                      ? const LinearProgressIndicator(minHeight: 2)
                      : DropdownButtonFormField<String>(
                          initialValue: _selectedStoreId,
                          decoration: const InputDecoration(
                            labelText: 'Dark Store (optional)',
                            border: OutlineInputBorder(),
                          ),
                          items: _darkStores
                              .map(
                                (s) => DropdownMenuItem<String>(
                                  value: s['id']?.toString(),
                                  child: Text(
                                    '${s['name'] ?? ''} - ${s['city'] ?? ''}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _selectedStoreId = v),
                        ),
                  if (_brands.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _brands.take(12).map((b) {
                        final name = (b['name'] ?? '').toString();
                        final selected =
                            _brandController.text.trim().toLowerCase() ==
                            name.toLowerCase();
                        return ChoiceChip(
                          label: Text(name),
                          selected: selected,
                          onSelected: (_) => setState(() {
                            _brandController.text = name;
                          }),
                        );
                      }).toList(),
                    ),
                  ],
                  const SizedBox(height: 12),
                  if (_categoriesError != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFECACA)),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline_rounded,
                            size: 16,
                            color: Color(0xFFB91C1C),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _categoriesError!,
                              style: const TextStyle(
                                color: Color(0xFFB91C1C),
                                fontSize: 12,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: _loadingCategories
                                ? null
                                : _loadBrandsAndCategories,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  _loadingCategories
                      ? const LinearProgressIndicator(minHeight: 2)
                      : Column(
                          children: [
                            DropdownButtonFormField<String>(
                              initialValue: _selectedParentCategoryId,
                              decoration: const InputDecoration(
                                labelText: 'Main Category',
                                border: OutlineInputBorder(),
                              ),
                              items: _parentCategories
                                  .map(
                                    (c) => DropdownMenuItem<String>(
                                      value: c['id']?.toString() ?? '',
                                      child: Text(c['name']?.toString() ?? ''),
                                    ),
                                  )
                                  .toList(),
                              onChanged: _onParentCategoryChanged,
                            ),
                            const SizedBox(height: 10),
                            DropdownButtonFormField<String>(
                              initialValue: _selectedChildCategoryId,
                              decoration: const InputDecoration(
                                labelText: 'Sub Category',
                                border: OutlineInputBorder(),
                              ),
                              items: _childCategories
                                  .map(
                                    (c) => DropdownMenuItem<String>(
                                      value: c['id']?.toString() ?? '',
                                      child: Text(c['name']?.toString() ?? ''),
                                    ),
                                  )
                                  .toList(),
                              onChanged: _onChildCategoryChanged,
                            ),
                            if (_subChildCategories.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              DropdownButtonFormField<String>(
                                initialValue: _selectedCategoryId,
                                decoration: const InputDecoration(
                                  labelText: 'Final Category',
                                  border: OutlineInputBorder(),
                                ),
                                items: _subChildCategories
                                    .map(
                                      (c) => DropdownMenuItem<String>(
                                        value: c['id']?.toString() ?? '',
                                        child: Text(
                                          c['name']?.toString() ?? '',
                                        ),
                                      ),
                                    )
                                    .toList(),
                                onChanged: (v) =>
                                    setState(() => _selectedCategoryId = v),
                              ),
                            ],
                          ],
                        ),
                  if (_selectedCategoryId != null &&
                      (_categoryNameById[_selectedCategoryId!] ?? '')
                          .isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Final selected category: ${_categoryNameById[_selectedCategoryId!] ?? ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF475569),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  const Text(
                    'Variants, Pricing & Inventory',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  ..._variants.asMap().entries.map((entry) {
                    final i = entry.key;
                    final v = entry.value;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Variant ${i + 1}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const Spacer(),
                              if (_variants.length > 1)
                                IconButton(
                                  onPressed: () => _removeVariant(i),
                                  icon: const Icon(
                                    Icons.delete_outline_rounded,
                                    color: Color(0xFFDC2626),
                                  ),
                                ),
                            ],
                          ),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: v.sizeCtrl,
                                  decoration: const InputDecoration(
                                    labelText: 'Size',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextField(
                                  controller: v.colorCtrl,
                                  decoration: const InputDecoration(
                                    labelText: 'Color',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: v.mrpCtrl,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                        decimal: true,
                                      ),
                                  decoration: const InputDecoration(
                                    labelText: 'MRP',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextField(
                                  controller: v.priceCtrl,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                        decimal: true,
                                      ),
                                  decoration: const InputDecoration(
                                    labelText: 'Selling Price',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextField(
                                  controller: v.stockCtrl,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Stock Qty',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: () => _pickVariantImages(i),
                            icon: const Icon(Icons.image_outlined),
                            label: Text(
                              v.imagePaths.isEmpty
                                  ? 'Upload Images'
                                  : 'Add More Images (${v.imagePaths.length})',
                            ),
                          ),
                          if (v.imagePaths.isNotEmpty)
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: v.imagePaths.asMap().entries.map((img) {
                                final idx = img.key;
                                final fileName = img.value.split('/').last;
                                return InputChip(
                                  label: Text(
                                    fileName,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  onDeleted: () => _removeVariantImage(i, idx),
                                );
                              }).toList(),
                            ),
                        ],
                      ),
                    );
                  }),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: _addVariant,
                      icon: const Icon(Icons.add_circle_outline_rounded),
                      label: const Text('Add Another Variant'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile.adaptive(
                    value: _isTryEnabled,
                    onChanged: (v) => setState(() => _isTryEnabled = v),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Enable Try & Buy'),
                    subtitle: const Text(
                      'Maps to is_try_enabled as in web flow',
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Bundle Pricing Offers',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  CheckboxListTile(
                    value: _buy2At999,
                    onChanged: (v) => setState(() => _buy2At999 = v ?? false),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Buy 2 at 999'),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  CheckboxListTile(
                    value: _buy3At999,
                    onChanged: (v) => setState(() => _buy3At999 = v ?? false),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Buy 3 at 999'),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  CheckboxListTile(
                    value: _buy4At999,
                    onChanged: (v) => setState(() => _buy4At999 = v ?? false),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Buy 4+ at 999'),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: FilledButton.icon(
                      onPressed: _submitting ? null : _submit,
                      icon: _submitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_rounded),
                      label: Text(
                        _submitting ? 'Creating...' : 'Create Product',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      'Recently Added (DB)',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: _loadingRecent ? null : _loadRecentProducts,
                      icon: const Icon(Icons.refresh_rounded),
                    ),
                  ],
                ),
                if (_loadingRecent)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: LinearProgressIndicator(minHeight: 2),
                  )
                else if (_recentProducts.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text(
                      'No products found yet for this vendor.',
                      style: TextStyle(color: Color(0xFF64748B)),
                    ),
                  )
                else
                  ..._recentProducts.map((p) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.inventory_2_outlined,
                            size: 16,
                            color: Color(0xFF475569),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              (p['name'] ?? 'Unnamed').toString(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '₹${p['price'] ?? '-'}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VendorStockMonitoringTab extends StatefulWidget {
  const _VendorStockMonitoringTab({required this.vendorId});

  final String vendorId;

  @override
  State<_VendorStockMonitoringTab> createState() =>
      _VendorStockMonitoringTabState();
}

class _VendorStockMonitoringTabState extends State<_VendorStockMonitoringTab> {
  final ApiClient _api = ApiClient();
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  bool _loadingStores = true;
  bool _showLowStockOnly = false;
  String _search = '';
  List<Map<String, dynamic>> _stores = const [];
  String? _selectedStoreId;
  List<Map<String, dynamic>> _products = const [];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _loadStores();
  }

  Future<void> _loadStores() async {
    setState(() => _loadingStores = true);
    try {
      final data = await _api.fetchDarkStores();
      final stores = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((e) => e['id'] != null)
          .toList();
      if (!mounted) return;
      setState(() {
        _stores = stores;
        _selectedStoreId = stores.isNotEmpty
            ? stores.first['id'].toString()
            : null;
      });
      if (_selectedStoreId != null) {
        await _loadProductsForStore(_selectedStoreId!);
      } else {
        setState(() => _loading = false);
      }
    } finally {
      if (mounted) setState(() => _loadingStores = false);
    }
  }

  Future<void> _loadProductsForStore(String storeId) async {
    setState(() => _loading = true);
    try {
      final data = await _api.fetchDarkStoreProducts(storeId);
      final products = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (!mounted) return;
      setState(() => _products = products);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _sumVariantStock(List<dynamic> variants) {
    var total = 0;
    for (final raw in variants) {
      if (raw is! Map) continue;
      final rawQuantity = raw['quantity'] ?? raw['stock'] ?? 0;
      final quantity = rawQuantity is num
          ? rawQuantity.toDouble()
          : (double.tryParse(rawQuantity.toString()) ?? 0);
      total += quantity.round();
    }
    return total;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _products
        .where((p) {
          if (!_showLowStockOnly) return true;
          final variants = (p['variants'] as List?) ?? const [];
          return _sumVariantStock(variants) <= 10;
        })
        .where((p) {
          if (_search.trim().isEmpty) return true;
          final q = _search.toLowerCase().trim();
          final name = (p['name'] ?? '').toString().toLowerCase();
          final brand = (p['brand_name'] ?? '').toString().toLowerCase();
          final category = (p['category_name'] ?? '').toString().toLowerCase();
          return name.contains(q) || brand.contains(q) || category.contains(q);
        })
        .toList();

    final totalStock = _products.fold<int>(0, (sum, p) {
      final variants = (p['variants'] as List?) ?? const [];
      return sum + _sumVariantStock(variants);
    });
    final lowStockCount = _products.where((p) {
      final variants = (p['variants'] as List?) ?? const [];
      return _sumVariantStock(variants) <= 10;
    }).length;

    return RefreshIndicator(
      onRefresh: () async {
        if (_selectedStoreId != null) {
          await _loadProductsForStore(_selectedStoreId!);
        }
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Stock Monitoring by Dark Store',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          const Text(
            'View inventory levels across selected dark stores.',
            style: TextStyle(color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 10),
          if (_loadingStores)
            const LinearProgressIndicator(minHeight: 2)
          else
            DropdownButtonFormField<String>(
              initialValue: _selectedStoreId,
              decoration: const InputDecoration(
                labelText: 'Select Dark Store',
                border: OutlineInputBorder(),
                filled: true,
                fillColor: Colors.white,
              ),
              items: _stores
                  .map(
                    (s) => DropdownMenuItem<String>(
                      value: s['id']?.toString(),
                      child: Text(
                        '${s['name'] ?? ''} - ${s['city'] ?? ''}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (v) {
                if (v == null) return;
                setState(() => _selectedStoreId = v);
                _loadProductsForStore(v);
              },
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _MetricCard(
                  title: 'Products',
                  value: '${_products.length}',
                  color: const Color(0xFF16A34A),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricCard(
                  title: 'Total Stock',
                  value: '$totalStock',
                  color: const Color(0xFF0EA5E9),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricCard(
                  title: 'Low Stock',
                  value: '$lowStockCount',
                  color: const Color(0xFFDC2626),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: 'Search product, brand, category',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _searchController.text.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _search = '');
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              FilterChip(
                selected: _showLowStockOnly,
                label: const Text('Low stock only'),
                onSelected: (v) => setState(() => _showLowStockOnly = v),
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Refresh',
                onPressed: (_loading || _selectedStoreId == null)
                    ? null
                    : () => _loadProductsForStore(_selectedStoreId!),
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 20),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (filtered.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 24),
              child: Center(
                child: Text('No products found in selected dark store.'),
              ),
            )
          else
            ...filtered.map((p) {
              final variants = (p['variants'] as List?) ?? const [];
              final total = _sumVariantStock(variants);
              final low = total <= 10;
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: low
                        ? const Color(0xFFFCA5A5)
                        : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            (p['name'] ?? 'Unnamed Product').toString(),
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: low
                                ? const Color(0xFFFEE2E2)
                                : const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'Stock: $total',
                            style: TextStyle(
                              color: low
                                  ? const Color(0xFFB91C1C)
                                  : const Color(0xFF166534),
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${p['category_name'] ?? ''} • ${p['brand_name'] ?? ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: variants.whereType<Map>().map((v) {
                        final qty = int.tryParse('${v['quantity'] ?? 0}') ?? 0;
                        final size = (v['size'] ?? '-').toString();
                        final color = (v['color'] ?? '-').toString();
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Text(
                            '$size • $color • Qty: $qty',
                            style: const TextStyle(fontSize: 12),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _VendorStockUpdateTab extends StatefulWidget {
  const _VendorStockUpdateTab({required this.vendorId});

  final String vendorId;

  @override
  State<_VendorStockUpdateTab> createState() => _VendorStockUpdateTabState();
}

class _VendorStockUpdateTabState extends State<_VendorStockUpdateTab> {
  final ApiClient _api = ApiClient();
  final TextEditingController _searchController = TextEditingController();
  Timer? _refreshTimer;

  bool _loadingStores = true;
  bool _loadingProducts = true;
  bool _updating = false;
  String _search = '';
  String? _selectedStoreId;
  String? _selectedProductId;
  List<Map<String, dynamic>> _stores = const [];
  List<Map<String, dynamic>> _products = const [];

  @override
  void initState() {
    super.initState();
    _loadStores();
    // Poll every 8 seconds so vendors can see quickly changing inventory.
    _refreshTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      final storeId = _selectedStoreId;
      if (storeId != null && mounted && !_updating) {
        _loadProductsForStore(storeId, silent: true);
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadStores() async {
    setState(() => _loadingStores = true);
    try {
      final data = await _api.fetchDarkStores();
      final stores = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((e) => e['id'] != null)
          .toList();
      if (!mounted) return;
      setState(() {
        _stores = stores;
        _selectedStoreId = stores.isNotEmpty
            ? stores.first['id'].toString()
            : null;
      });
      if (_selectedStoreId != null) {
        await _loadProductsForStore(_selectedStoreId!);
      } else {
        setState(() => _loadingProducts = false);
      }
    } finally {
      if (mounted) setState(() => _loadingStores = false);
    }
  }

  Future<void> _loadProductsForStore(
    String storeId, {
    bool silent = false,
  }) async {
    if (!silent) setState(() => _loadingProducts = true);
    try {
      final data = await _api.fetchDarkStoreProducts(storeId);
      final products = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (!mounted) return;
      setState(() {
        _products = products;
        if (_selectedProductId != null &&
            !_products.any((p) => p['id']?.toString() == _selectedProductId)) {
          _selectedProductId = null;
        }
      });
    } finally {
      if (!silent && mounted) setState(() => _loadingProducts = false);
    }
  }

  Future<void> _setVariantQty({
    required String variantId,
    required int qty,
  }) async {
    final storeId = _selectedStoreId;
    if (storeId == null) return;

    if (qty < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Quantity cannot be negative')),
      );
      return;
    }

    setState(() => _updating = true);
    try {
      final res = await _api.updateVendorVariantStock(
        vendorId: widget.vendorId,
        storeId: storeId,
        variantId: variantId,
        quantity: qty,
      );
      if (!mounted) return;

      if (res['success'] == true) {
        setState(() {
          for (final p in _products) {
            final variants = (p['variants'] as List?) ?? const [];
            for (final v in variants.whereType<Map>()) {
              if (v['id']?.toString() == variantId) {
                v['quantity'] = qty;
              }
            }
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Stock updated and synced to store inventory'),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['error'] ?? res['message'] ?? 'Stock update failed')
                  .toString(),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _openSetQtyDialog({
    required String variantId,
    required int currentQty,
  }) async {
    final ctrl = TextEditingController(text: '$currentQty');
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Set Stock Quantity'),
          content: TextField(
            controller: ctrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Quantity',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final q = int.tryParse(ctrl.text.trim());
                if (q == null) return;
                Navigator.of(ctx).pop(q);
              },
              child: const Text('Update'),
            ),
          ],
        );
      },
    );
    ctrl.dispose();

    if (result != null) {
      await _setVariantQty(variantId: variantId, qty: result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredProducts = _products.where((p) {
      if (_selectedProductId != null &&
          p['id']?.toString() != _selectedProductId) {
        return false;
      }
      if (_search.trim().isEmpty) return true;
      final q = _search.toLowerCase().trim();
      final name = (p['name'] ?? '').toString().toLowerCase();
      final brand = (p['brand_name'] ?? '').toString().toLowerCase();
      final category = (p['category_name'] ?? '').toString().toLowerCase();
      return name.contains(q) || brand.contains(q) || category.contains(q);
    }).toList();

    return RefreshIndicator(
      onRefresh: () async {
        final storeId = _selectedStoreId;
        if (storeId != null) {
          await _loadProductsForStore(storeId);
        }
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Stock Quantity Update',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          const Text(
            'Search or select a product and update variant quantities in real time.',
            style: TextStyle(color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 10),
          if (_loadingStores)
            const LinearProgressIndicator(minHeight: 2)
          else
            DropdownButtonFormField<String>(
              initialValue: _selectedStoreId,
              decoration: const InputDecoration(
                labelText: 'Select Dark Store',
                border: OutlineInputBorder(),
                filled: true,
                fillColor: Colors.white,
              ),
              items: _stores
                  .map(
                    (s) => DropdownMenuItem<String>(
                      value: s['id']?.toString(),
                      child: Text(
                        '${s['name'] ?? ''} - ${s['city'] ?? ''}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (v) {
                if (v == null) return;
                setState(() {
                  _selectedStoreId = v;
                  _selectedProductId = null;
                });
                _loadProductsForStore(v);
              },
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: 'Search product, brand, category',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _searchController.text.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _search = '');
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _selectedProductId,
            decoration: const InputDecoration(
              labelText: 'Select Product (optional)',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Colors.white,
            ),
            items: [
              const DropdownMenuItem<String>(
                value: null,
                child: Text('All Products'),
              ),
              ..._products.map(
                (p) => DropdownMenuItem<String>(
                  value: p['id']?.toString(),
                  child: Text(
                    (p['name'] ?? 'Unnamed Product').toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
            onChanged: (v) => setState(() => _selectedProductId = v),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Spacer(),
              IconButton(
                tooltip: 'Refresh',
                onPressed: (_loadingProducts || _selectedStoreId == null)
                    ? null
                    : () => _loadProductsForStore(_selectedStoreId!),
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_loadingProducts)
            const Padding(
              padding: EdgeInsets.only(top: 20),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (filteredProducts.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: Center(child: Text('No matching products found.')),
            )
          else
            ...filteredProducts.map((p) {
              final variants = (p['variants'] as List?) ?? const [];
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (p['name'] ?? 'Unnamed Product').toString(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${p['category_name'] ?? ''} • ${p['brand_name'] ?? ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...variants.whereType<Map>().map((v) {
                      final variantId = v['id']?.toString() ?? '';
                      final qty = int.tryParse('${v['quantity'] ?? 0}') ?? 0;
                      final size = (v['size'] ?? '-').toString();
                      final color = (v['color'] ?? '-').toString();
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '$size • $color',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed:
                                  _updating || qty <= 0 || variantId.isEmpty
                                  ? null
                                  : () => _setVariantQty(
                                      variantId: variantId,
                                      qty: qty - 1,
                                    ),
                              icon: const Icon(
                                Icons.remove_circle_outline_rounded,
                              ),
                            ),
                            Text(
                              '$qty',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            IconButton(
                              onPressed: _updating || variantId.isEmpty
                                  ? null
                                  : () => _setVariantQty(
                                      variantId: variantId,
                                      qty: qty + 1,
                                    ),
                              icon: const Icon(
                                Icons.add_circle_outline_rounded,
                              ),
                            ),
                            const SizedBox(width: 4),
                            OutlinedButton(
                              onPressed: _updating || variantId.isEmpty
                                  ? null
                                  : () => _openSetQtyDialog(
                                      variantId: variantId,
                                      currentQty: qty,
                                    ),
                              child: const Text('Set'),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.color,
  });

  final String title;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _VendorOrdersTab extends StatefulWidget {
  const _VendorOrdersTab({required this.vendorId});

  final String vendorId;

  @override
  State<_VendorOrdersTab> createState() => _VendorOrdersTabState();
}

class _VariantDraft {
  _VariantDraft()
    : sizeCtrl = TextEditingController(text: 'M'),
      colorCtrl = TextEditingController(text: 'Black'),
      mrpCtrl = TextEditingController(),
      priceCtrl = TextEditingController(),
      stockCtrl = TextEditingController(text: '0');

  final TextEditingController sizeCtrl;
  final TextEditingController colorCtrl;
  final TextEditingController mrpCtrl;
  final TextEditingController priceCtrl;
  final TextEditingController stockCtrl;
  final List<String> imagePaths = [];

  void dispose() {
    sizeCtrl.dispose();
    colorCtrl.dispose();
    mrpCtrl.dispose();
    priceCtrl.dispose();
    stockCtrl.dispose();
  }
}

class _VendorOrdersTabState extends State<_VendorOrdersTab> {
  final ApiClient _api = ApiClient();
  bool _loading = true;
  List<Map<String, dynamic>> _orders = const [];
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.fetchVendorOrders(widget.vendorId);
      final orders = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (!mounted) return;
      setState(() => _orders = orders);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredOrders = _statusFilter == 'all'
        ? _orders
        : _orders
              .where(
                (o) =>
                    (o['status'] ?? '').toString().toLowerCase() ==
                    _statusFilter,
              )
              .toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Vendor Orders',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            '${_orders.length} orders linked to your products',
            style: const TextStyle(color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _OrderFilterChip(
                label: 'All',
                selected: _statusFilter == 'all',
                onTap: () => setState(() => _statusFilter = 'all'),
              ),
              _OrderFilterChip(
                label: 'Pending',
                selected: _statusFilter == 'pending',
                onTap: () => setState(() => _statusFilter = 'pending'),
              ),
              _OrderFilterChip(
                label: 'Confirmed',
                selected: _statusFilter == 'confirmed',
                onTap: () => setState(() => _statusFilter = 'confirmed'),
              ),
              _OrderFilterChip(
                label: 'Delivered',
                selected: _statusFilter == 'delivered',
                onTap: () => setState(() => _statusFilter = 'delivered'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 20),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (filteredOrders.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: Center(child: Text('No orders found for this vendor.')),
            )
          else
            ...filteredOrders.map((o) {
              final amount = (o['final_amount'] ?? o['total_amount'] ?? 0)
                  .toString();
              final items = (o['items'] as List?) ?? const [];
              final createdAt = DateTime.tryParse(
                (o['created_at'] ?? '').toString(),
              );
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Order #${o['id'] ?? '-'}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            (o['status'] ?? 'unknown').toString().toUpperCase(),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Amount: ₹$amount • Items: ${items.length}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF475569),
                      ),
                    ),
                    if (createdAt != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Created: ${createdAt.day.toString().padLeft(2, '0')}/${createdAt.month.toString().padLeft(2, '0')}/${createdAt.year} ${createdAt.hour.toString().padLeft(2, '0')}:${createdAt.minute.toString().padLeft(2, '0')}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ),
                    if (items.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: items.whereType<Map>().take(4).map((item) {
                            final name = (item['product_name'] ?? 'Item')
                                .toString();
                            return Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Text(
                                name,
                                style: const TextStyle(fontSize: 11),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _OrderFilterChip extends StatelessWidget {
  const _OrderFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF16A34A) : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : const Color(0xFF334155),
          ),
        ),
      ),
    );
  }
}
