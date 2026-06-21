import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

/// Optimized image caching service to prevent redundant image loads
class ImageCacheService {
  static final ImageCacheService _instance = ImageCacheService._();

  factory ImageCacheService() => _instance;

  ImageCacheService._() {
    // Configure image cache limits
    imageCache.maximumSize = 500; // 500 images
    imageCache.maximumSizeBytes = 100 * 1024 * 1024; // 100 MB
  }

  /// Clear all image caches to free up memory
  void clearAllCaches() {
    imageCache.clear();
    imageCache.clearLiveImages();
  }

  /// Preload images to avoid delays during rendering
  Future<void> preloadImages(List<String> urls) async {
    for (final url in urls) {
      try {
        await precacheImage(
          CachedNetworkImageProvider(url),
          GlobalContext.context,
        );
      } catch (_) {
        // Silently ignore failures
      }
    }
  }
}

/// Global context for image precaching
class GlobalContext {
  static late BuildContext context;

  static void init(BuildContext buildContext) {
    context = buildContext;
  }
}

/// Cached network image widget with fallback
class OptimizedNetworkImage extends StatelessWidget {
  final String imageUrl;
  final BoxFit fit;
  final double? width;
  final double? height;

  const OptimizedNetworkImage({
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return CachedNetworkImage(
      imageUrl: imageUrl,
      fit: fit,
      width: width,
      height: height,
      placeholder: (_, _) => Container(
        color: const Color(0xFFF0F0F0),
        child: const Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF16A34A)),
            ),
          ),
        ),
      ),
      errorWidget: (_, _, _) => Container(
        color: const Color(0xFFF0F0F0),
        child: const Icon(
          Icons.image_not_supported_outlined,
          color: Color(0xFFCBD5E1),
        ),
      ),
      cacheKey: imageUrl,
      fadeInDuration: const Duration(milliseconds: 150),
    );
  }
}
