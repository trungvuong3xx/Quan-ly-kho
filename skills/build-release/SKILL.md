---
name: build-release
description: Use when building a .NET project in release mode and `dotnet build` fails with MSB4803 or COM reference errors.
---

# Build Release

## Overview
When building .NET projects containing COM references or requiring the .NET Framework version of MSBuild, standard `dotnet build -c Release` will fail with an error like `MSB4803: The task "ResolveComReference" is not supported on the .NET Core version of MSBuild`. This skill provides the correct way to build these projects.

## When to Use
- When `dotnet build` fails with `error MSB4803`.
- When the project requires COM references that are unsupported by .NET Core MSBuild.
- When you need to build a release version of a legacy or mixed .NET project on Windows.

## Quick Reference
1. **Find MSBuild**: Use `vswhere` to locate the standard MSBuild executable.
2. **Execute Build**: Run the located `MSBuild.exe` with the release property.

## Implementation

### 1. Find MSBuild Path
Run the following PowerShell command to locate `MSBuild.exe`:
```powershell
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe
```

### 2. Build the Project
Once you have the path (e.g., `C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe`), run:
```powershell
& "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" -property:Configuration=Release
```

## Common Mistakes
- **Running `dotnet build` anyway**: This will fail. You must use the `MSBuild.exe` from Visual Studio.
- **Using a hardcoded path**: The path to Visual Studio varies by installation (Community, Professional, Enterprise, versions 2019, 2022). Always use `vswhere.exe` to find the exact path dynamically before executing.
