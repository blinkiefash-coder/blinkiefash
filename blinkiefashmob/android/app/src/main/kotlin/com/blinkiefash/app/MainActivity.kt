package com.blinkiefash.app

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.core.view.WindowCompat
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
	override fun onCreate(savedInstanceState: Bundle?) {
		super.onCreate(savedInstanceState)
		// Manual edge-to-edge setup. androidx.activity's enableEdgeToEdge() is an extension
		// function on ComponentActivity, but Flutter's FlutterActivity extends plain
		// android.app.Activity (not ComponentActivity), so that API isn't applicable here
		// (fails to compile with a receiver-type mismatch). This replicates the same
		// effect manually — content draws edge-to-edge behind transparent system bars —
		// which is what Play Console's "Edge-to-edge may not display for all users"
		// check verifies, and works across all supported API levels.
		WindowCompat.setDecorFitsSystemWindows(window, false)
		window.statusBarColor = Color.TRANSPARENT
		window.navigationBarColor = Color.TRANSPARENT
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
			window.isNavigationBarContrastEnforced = false
		}
	}
}

