// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TodoSync",
    platforms: [
        .macOS(.v14)
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "TodoSync",
            dependencies: [],
            resources: []
        )
    ]
)
