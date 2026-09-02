allprojects {
    repositories {
        maven(url = "https://repo1.maven.org/maven2/")
        maven(url = "https://repo.maven.apache.org/maven2/")
        google()
        mavenCentral()
    }

    // Suppress deprecation warnings from third-party plugin dependencies
    tasks.withType<JavaCompile>().configureEach {
        options.isWarnings = false
        options.compilerArgs.addAll(listOf(
            "-nowarn",
            "-Xlint:none",
            "-Xlint:-deprecation",
            "-Xlint:-unchecked"
        ))
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Several Flutter plugins (e.g. firebase_auth) ship their own android/build.gradle
// with an outdated compileSdk (33), which AGP 8.13+'s stricter AAR dependency
// checks reject since newer androidx transitive deps require 34+. Force every
// plugin subproject to compile against the same SDK level as the app itself.
// Must run afterEvaluate (so it overrides the plugin's own compileSdk line, which
// executes later in that subproject's script) and must skip :app, since
// evaluationDependsOn(":app") above already evaluates it eagerly.
subprojects {
    if (project.name == "app") return@subprojects
    afterEvaluate {
        val androidExt = project.extensions.findByName("android")
        if (androidExt is com.android.build.gradle.BaseExtension) {
            androidExt.compileSdkVersion(36)
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
