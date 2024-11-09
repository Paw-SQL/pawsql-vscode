# PawSQL Client
[English](README.md) | [中文](README_zh-CN.md)

## Introduction
PawSQL Client enables developers to access core capabilities of the PawSQL directly within their VS Code development environment. PawSQL provides sosophisticated SQL optimization features including smart index recommendations and query rewriting suggestions.. PawSQL Client requires integration with the PawSQL optimization platform (either [PawSQL Cloud](https://pawsql.com) or enterprise private deployment). For comprehensive SQL optimization capabilities, please refer to the [PawSQL Technical Documentation](https://docs.pawsql.com).

[Watch PawSQL Client Demo](https://www.bilibili.com/video/BV19aDBYAEcr/)

## Features
- **SQL Optimization**: Get optimization recommendation by one click.
- **Intelligent index recommendation**: Recommend optimal indexes based on input SQL syntax, database objects and statistics information
- **Rewrite Optimization**: Recommend semantically equivalent, but more efficient SQLs
- **Performance Validation**: Ensure better performance after SQL rewrite and index recommendation

## Installation
1. Open Visual Studio Code
2. Navigate to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "PawSQL Client" and click Install

## Initial Setup
When using the extension for the first time, complete these configuration steps:
1. Click the PawSQL icon in the VSCode sidebar to access configuration
2. Fill in the following configuration fields:
   - Backend URL (e.g., `https://pawsql.com`)
   - Frontend URL (e.g., `https://pawsql.com`)
   - API Key (Your PawSQL API key, available in the platform's user settings)
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
- Ensure PawSQL Backend URL and Frontend URL are accessible
- API Key is your unique identifier for [PawSQL Cloud](https://pawsql.com) or private deployment platform, available in the platform's user settings
