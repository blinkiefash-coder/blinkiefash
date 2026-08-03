# BlinkieFash Rider App

Flutter application for delivery riders on the BlinkieFash platform.

## Getting Started

This is a Flutter project for the rider application.

### Prerequisites
- Flutter SDK (3.11.5 or higher)
- Dart SDK
- Android Studio / Xcode (for mobile platforms)

### Setup

1. **Install dependencies**
```bash
flutter pub get
```

2. **Generate code**
```bash
flutter pub run build_runner build
```

3. **Run the app**
```bash
flutter run
```

### Build for Release

**Android (AAB for Play Store)**:
```bash
flutter build appbundle --release
```

**iOS (for App Store)**:
```bash
flutter build ios --release
```

## Project Structure

- `/lib` - Dart source code
- `/android` - Android platform code
- `/ios` - iOS platform code
- `/assets` - Static assets (images, fonts, etc.)

## Features

- Real-time delivery tracking
- Order management
- Navigation & routing
- Firebase integration
- Location-based services
