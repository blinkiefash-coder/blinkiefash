import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

class HeroCarousel extends StatefulWidget {
  const HeroCarousel({super.key});

  @override
  State<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<HeroCarousel> {
  final List<String> _heroImages = [
    'assets/images/hero.png',
    'assets/images/hero1.png',
    'assets/images/hero2.png',
    'assets/images/hero3.png',
  ];

  int _current = 0;
  final PageController _controller = PageController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.bottomCenter,
      children: [
        PageView.builder(
          controller: _controller,
          itemCount: _heroImages.length,
          onPageChanged: (i) => setState(() => _current = i),
          itemBuilder: (context, i) => ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Image.asset(
              _heroImages[i],
              fit: BoxFit.cover,
              width: double.infinity,
              height: 180,
            ),
          ),
        ),
        Positioned(
          bottom: 12,
          child: Row(
            children: List.generate(
              _heroImages.length,
              (i) => AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: _current == i ? 18 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: _current == i
                      ? const Color(0xFF16A34A)
                      : const Color(0xFFD1D5DB),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.name,
    this.brand,
    this.imageUrl,
    required this.price,
    this.originalPrice,
    required this.off,
    this.onTap,
  });

  final String name;
  final String? brand;
  final String? imageUrl;
  final String price;
  final String? originalPrice;
  final String off;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(14),
                  ),
                  child: Container(
                    color: const Color(0xFFF3F4F6),
                    child: imageUrl == null
                        ? const Center(
                            child: Icon(
                              Icons.image_not_supported_outlined,
                              color: Color(0xFF9CA3AF),
                              size: 28,
                            ),
                          )
                        : CachedNetworkImage(
                            imageUrl: imageUrl!,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            memCacheWidth: 512,
                            fadeInDuration: const Duration(milliseconds: 120),
                            placeholder: (context, url) => const Center(
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            ),
                            errorWidget: (context, url, error) {
                              return const Center(
                                child: Icon(
                                  Icons.broken_image_outlined,
                                  color: Color(0xFF9CA3AF),
                                  size: 28,
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if ((brand ?? '').trim().isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        brand!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text(
                          'INR $price',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if ((originalPrice ?? '').isNotEmpty &&
                            originalPrice != price)
                          Padding(
                            padding: const EdgeInsets.only(left: 8),
                            child: Text(
                              'INR $originalPrice',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF9CA3AF),
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      off,
                      style: const TextStyle(
                        fontSize: 18,
                        color: Color(0xFF16A34A),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
