---
title: 简介
---
# 简介

欢迎来到 **HoloLens2Medical 教程**。
本教程将带你从零开始，搭建一个基于 **Unity + MRTK3** 的医学影像可视化项目。最终，你将能c在 **HoloLens 2** 上加载和浏览 **DICOM 医学影像** 与 **STL 三维模型**，并通过 MRTK3 提供的交互组件初步实现这些功能

## 你将学到什么

通过本教程，你将逐步掌握:

* 如何配置 Unity 和 Visual Studio 以支持 HoloLens 2 开发
* 如何组织工程文件夹和命名空间
* 如何导入并使用 DICOM、STL 数据
* 如何在 MRTK3 框架下实现医学影像的交互

## 环境配置

在开始之前，请确保你已经具备:
* **Windows 10/11**
* 安装了 **Unity 2022.3.55f1c1** 与 **Visual Studio 2022**
* 下载了[NuGetForUnity](https://github.com/GlitchEnzo/NuGetForUnity)、[混合现实工具包](https://learn.microsoft.com/en-us/windows/mixed-reality/develop/unity/welcome-to-mr-feature-tool)、[MRTK.HoloLens2.Unity.Tutorials.Assets.GettingStarted.3.0.0.unitypackage](https://github.com/microsoft/MixedRealityLearning/releases/download/getting-started-v3.0.0/MRTK.HoloLens2.Unity.Tutorials.Assets.GettingStarted.3.0.0.unitypackage)

### Visual Studio 配置

* 在项目开发前，请先导入以下 `.vsconfig` 文件到 Visual Studio 2022。

```json
{
  "version": "1.0",
  "components": [
    "Microsoft.VisualStudio.Component.CoreEditor",
    "Microsoft.VisualStudio.Workload.CoreEditor",
    "Microsoft.Net.Component.4.8.SDK",
    "Microsoft.Net.Component.4.7.2.TargetingPack",
    "Microsoft.Net.ComponentGroup.DevelopmentPrerequisites",
    "Microsoft.VisualStudio.Component.TypeScript.TSServer",
    "Microsoft.VisualStudio.ComponentGroup.WebToolsExtensions",
    "Microsoft.VisualStudio.Component.JavaScript.TypeScript",
    "Microsoft.VisualStudio.Component.Roslyn.Compiler",
    "Microsoft.Component.MSBuild",
    "Microsoft.VisualStudio.Component.Roslyn.LanguageServices",
    "Microsoft.VisualStudio.Component.TextTemplating",
    "Microsoft.VisualStudio.Component.NuGet",
    "Microsoft.VisualStudio.Component.SQL.CLR",
    "Microsoft.Component.ClickOnce",
    "Microsoft.VisualStudio.Component.ManagedDesktop.Core",
    "Microsoft.NetCore.Component.Runtime.9.0",
    "Microsoft.NetCore.Component.Runtime.8.0",
    "Microsoft.NetCore.Component.SDK",
    "Microsoft.VisualStudio.Component.FSharp",
    "Microsoft.ComponentGroup.ClickOnce.Publish",
    "Microsoft.NetCore.Component.DevelopmentTools",
    "Microsoft.VisualStudio.Component.AppInsights.Tools",
    "Microsoft.Net.Component.4.8.TargetingPack",
    "Microsoft.Net.ComponentGroup.4.8.DeveloperTools",
    "Microsoft.VisualStudio.Component.DiagnosticTools",
    "Microsoft.VisualStudio.Component.EntityFramework",
    "Microsoft.VisualStudio.Component.Debugger.JustInTime",
    "Component.Microsoft.VisualStudio.LiveShare.2022",
    "Microsoft.VisualStudio.Component.IntelliCode",
    "Component.VisualStudio.GitHub.Copilot",
    "Microsoft.Net.Component.4.6.2.TargetingPack",
    "Microsoft.Net.Component.4.7.1.TargetingPack",
    "Microsoft.VisualStudio.Component.VC.CoreIde",
    "Microsoft.VisualStudio.Component.Windows10SDK",
    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
    "Microsoft.VisualStudio.Component.Graphics.Tools",
    "Microsoft.VisualStudio.Component.VC.DiagnosticTools",
    "Microsoft.VisualStudio.Component.Windows11SDK.26100",
    "Microsoft.VisualStudio.ComponentGroup.MSIX.Packaging",
    "Microsoft.VisualStudio.Component.ManagedDesktop.Prerequisites",
    "Microsoft.VisualStudio.Component.DotNetModelBuilder",
    "Microsoft.VisualStudio.ComponentGroup.WindowsAppSDK.Cs",
    "Microsoft.ComponentGroup.Blend",
    "Microsoft.VisualStudio.Workload.ManagedDesktop",
    "Microsoft.VisualStudio.Component.VC.ATL",
    "Microsoft.VisualStudio.Component.VC.Redist.14.Latest",
    "Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core",
    "Microsoft.VisualStudio.Component.Windows11Sdk.WindowsPerformanceToolkit",
    "Microsoft.VisualStudio.Component.CppBuildInsights",
    "Microsoft.VisualStudio.ComponentGroup.WebToolsExtensions.CMake",
    "Microsoft.VisualStudio.Component.VC.CMake.Project",
    "Microsoft.VisualStudio.Component.VC.TestAdapterForBoostTest",
    "Microsoft.VisualStudio.Component.VC.TestAdapterForGoogleTest",
    "Microsoft.VisualStudio.Component.VC.ASAN",
    "Microsoft.VisualStudio.Component.Vcpkg",
    "Microsoft.VisualStudio.Component.Windows11SDK.22621",
    "Microsoft.Component.NetFX.Native",
    "Microsoft.VisualStudio.Component.Graphics",
    "Microsoft.VisualStudio.ComponentGroup.UWP.Xamarin",
    "Microsoft.VisualStudio.ComponentGroup.UWP.Support",
    "Microsoft.VisualStudio.Component.VC.Tools.ARM64EC",
    "Microsoft.VisualStudio.Component.UWP.VC.ARM64EC",
    "Microsoft.VisualStudio.Component.VC.Tools.ARM64",
    "Microsoft.VisualStudio.Component.UWP.VC.ARM64",
    "Microsoft.VisualStudio.Component.VC.Tools.ARM",
    "Microsoft.VisualStudio.ComponentGroup.UWP.VC",
    "Microsoft.VisualStudio.Workload.NativeDesktop",
    "Microsoft.VisualStudio.Component.WindowsAppSdkSupport.CSharp",
    "Microsoft.VisualStudio.ComponentGroup.WindowsAppDevelopment.Prerequisites",
    "Microsoft.VisualStudio.ComponentGroup.UWP.NetCoreAndStandard",
    "Microsoft.VisualStudio.Component.Windows10SDK.IpOverUsb",
    "Microsoft.VisualStudio.Workload.Universal",
    "Microsoft.VisualStudio.Component.Unity",
    "Microsoft.VisualStudio.Component.HLSL",
    "Microsoft.VisualStudio.Workload.ManagedGame",
    "Microsoft.Net.ComponentGroup.TargetingPacks.Common",
    "Microsoft.VisualStudio.Component.NuGet.BuildTools",
    "Component.Unreal.Ide",
    "Component.Unreal.Debugger",
    "Microsoft.VisualStudio.Workload.NativeGame",
    "Microsoft.VisualStudio.Component.VC.Runtimes.ARM64EC.Spectre",
    "Microsoft.NetCore.Component.Runtime.6.0",
    "Microsoft.VisualStudio.Component.VC.14.38.17.8.ARM64",
    "Microsoft.VisualStudio.Component.VC.14.38.17.8.x86.x64",
    "Microsoft.VisualStudio.Component.VC.14.38.17.8.ARM64.Spectre",
    "Microsoft.VisualStudio.Component.VC.14.38.17.8.x86.x64.Spectre"
  ],
  "extensions": []
}
```



## 下一步

让我们从[工程搭建](./00setup/README.md) 开始。



