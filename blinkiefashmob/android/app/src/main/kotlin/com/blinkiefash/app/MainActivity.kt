package com.blinkiefash.app

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
	override fun onCreate(savedInstanceState: Bundle?) {
		// androidx.activity's enableEdgeToEdge() replaces the manual
		// WindowCompat.setDecorFitsSystemWindows call — it's the API Play Console's
		// "Edge-to-edge may not display for all users" check expects, and it
		// correctly handles insets/status-bar contrast across all API levels
		// (the manual call alone doesn't on some OEM/API combinations).
		enableEdgeToEdge()
		super.onCreate(savedInstanceState)
	}
}

