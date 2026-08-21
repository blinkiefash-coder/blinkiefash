import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BlinkieFash',
      theme: ThemeData(primarySwatch: Colors.blue, useMaterial3: true),
      home: const Scaffold(body: Center(child: Text('BlinkieFash Mobile App'))),
    );
  }
}
