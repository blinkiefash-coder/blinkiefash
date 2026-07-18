package com.blinkiefash.app

import android.os.Bundle
import androidx.core.view.WindowCompat
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
	override fun onCreate(savedInstanceState: Bundle?) {
		super.onCreate(savedInstanceState)
		// Enable edge-to-edge display so content may draw behind system bars.
		// This requires handling insets in your layouts; Flutter SafeArea/MediaQuery will help.
		WindowCompat.setDecorFitsSystemWindows(window, false)
	}
}
