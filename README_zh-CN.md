# PawSQL Client

[English](README.md) | [中文](README_zh-CN.md)

## 简介

PawSQL Client是一款为 Visual Studio Code 提供的插件，旨在帮助开发者优化 SQL 查询并管理工作空间。通过与 PawSQL API 的集成，用户可以方便地执行 SQL 优化，查看优化结果。

## 功能

- **SQL 优化**：选择 SQL 查询并使用 PawSQL API 进行优化。
- **工作空间管理**：连接到 PawSQL 工作空间，方便地切换和管理。
- **错误处理**：提供详细的错误信息和友好的提示。

## 安装

1. 打开 Visual Studio Code。
2. 转到扩展视图 (`Ctrl+Shift+X` 或 `Cmd+Shift+X`)。
3. 搜索 “PawSQL” 并点击安装。

## 使用说明

### 配置 API 密钥

在使用插件之前，您需要配置 PawSQL API 密钥：

1. 打开设置 (`Ctrl+,` 或 `Cmd+,`)。
2. 搜索 “PawSQL”。
3. 输入您的 API 密钥并保存。

### 优化 SQL 查询

1. 在编辑器中选择需要优化的 SQL 查询。
2. 右键单击，选择 “优化 SQL” 或使用命令面板 (`Ctrl+Shift+P` 或 `Cmd+Shift+P`) 输入 “优化 SQL”。
3. 点击选择工作空间获取，点击执行优化。
3. 等待优化结果，并根据提示查看报告。

### 管理工作空间

1. 使用命令面板 (`Ctrl+Shift+P` 或 `Cmd+Shift+P`) 输入 “选择工作空间”。
2. 从列表中选择一个工作空间进行连接。

## 错误处理

在使用过程中，如果遇到任何问题，插件会显示详细的错误信息和解决提示。例如：

- API 密钥未配置：请在设置中添加 API 密钥。
- SQL 查询无效：请选择有效的 SQL 文本进行优化。