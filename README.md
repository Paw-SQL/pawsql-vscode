# PawSQL Client
[English](README.md) | [中文](README_zh-CN.md)

## Introduction
PawSQL Client enables developers to access core capabilities of the PawSQL directly within VSCode enviroment. PawSQL provides sophisticated SQL optimization features including smart index recommendations and query rewrites. More about PawSQL's capabilities, please visit [https://docs.pawsql.com](https://docs.pawsql.com).

[Watch PawSQL Client Demo](https://www.bilibili.com/video/BV19aDBYAEcr/)

## Features
- **Tune by Clicks**: Get optimization recommendation by one click.
- **Index Advise**: Recommend optimal indexes based on input SQL syntax, database objects and statistics information
- **Query Rewrite**: Recommend semantically equivalent, but more efficient SQLs
- **Performance Validation**: Ensure better performance after SQL rewrite and index recommendation

## Installation
1. Open Visual Studio Code
2. Navigate to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "PawSQL Client" and click Install

## Initial Setup
When using the extension for the first time, complete these configuration steps:
1. Click the PawSQL icon in the VSCode sidebar to access configuration
2. Fill in the following configuration fields:
   - PawSQL Server Address (e.g., `https://pawsql.com`)
   - PawSQL Account
   - Password
3. Click "Save"

Upon successful configuration, the sidebar will load your workspace list (last 100 workspaces at most).

## Usage Guide
### SQL Optimization in VS Code
Two optimization methods are available in SQL files:
1. **Optimize Using Default Workspace**:
   - Click the "Optimize" button in the SQL statement prompt
2. **Optimize Using Specific Workspace**:
   - Click the "Optimize..." button in the SQL statement prompt
   - Select a workspace from the dropdown menu

### Optimization Results
After optimization completion:
- Results are displayed in VSCode's WebView
- Click "View Detailed Optimization in Browser" for additional information, including:
  - SQL comparison
  - Execution plan comparison
  - Detailed analysis

Recent optimization results (last 10 per workspace) automatically appear in the sidebar under their respective workspaces.

## Important Notes
- You must have a valid account on the PawSQL Cloud or on a privately deployed PawSQL platform.
