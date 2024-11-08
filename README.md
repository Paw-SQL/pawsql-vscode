# PawSQL Client

[English](README.md) | [中文](README_zh-CN.md)

## Introduction

PawSQL Client is a plugin for Visual Studio Code that helps developers optimize SQL queries and manage workspaces. Through integration with the PawSQL API, users can easily perform SQL optimization and view optimization results.

## Features

- **SQL optimization**: Select SQL queries and optimize using the PawSQL API.

- **Workspace management**: Connect to a PawSQL workspace for easy switching and management.

- **Error handling**: Provides detailed error information and friendly prompts.

## Installation

1. Open Visual Studio Code.

2. Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`).

3. Search for "PawSQL" and click Install.

## Instructions

### Configure API key

Before using the plugin, you need to configure the PawSQL API key:

1. Open Settings (`Ctrl+,` or `Cmd+,`).
2. Search for "PawSQL".
3. Enter your API key and save.

### Optimize SQL Queries

1. Select the SQL query to be optimized in the editor.
2. Right-click and select "Optimize SQL" or use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) to enter "Optimize SQL".
3. Click Select Workspace to get it, and click Execute Optimization.
3. Wait for the optimization results and view the report according to the prompts.

### Manage Workspaces

1. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) to enter "Select Workspace".
2. Select a workspace from the list to connect.

## Error Handling

During use, if you encounter any problems, the plugin will display detailed error information and solution tips. For example:

- API key not configured: Please add API key in settings.
- Invalid SQL query: Please select valid SQL text to optimize.