allprojects {
    repositories {
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

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
