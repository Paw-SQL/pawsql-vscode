# PawSQL for VSCode

[English](README.md) | [中文](README_zh-CN.md)

## 简介

PawSQL for VSCode 让开发者能够在VSCode开发环境中直接使用PawSQL引擎强大的SQL优化能力，包括智能索引推荐、查询重写建议、自动化性能验证等。PawSQL for VSCode需要结合PawSQL优化平台（[PawSQL Cloud](https://pawsql.com)或企业私域部署的PawSQL优化平台）一起使用。关于更全面的PawSQL的SQL优化能力，请参考[PawSQL官方文档](https://docs.pawsql.com)。

![PawSQL Client Demo](/resources/demo.gif)

## 功能

- **SQL 优化**：一键完成SQL性能优化
- **智能索引推荐**: 推荐各种语法组合条件下的最优索引组合
- **查询重写优化**: 推荐语义等价，但执行性能更高的SQL语句
- **自动化性能验证**: 精确了解优化后的SQL性能提示效果 
- **优化结果展示**：支持在 VSCode 内查看优化结果，并可跳转至浏览器查看更详细信息

## 插件安装

1. 打开 Visual Studio Code
2. 转到插件视图 (`Ctrl+Shift+X` 或 `Cmd+Shift+X`)
3. 搜索 "PawSQL" 并点击安装

## 初始配置

首次使用插件时，需要完成以下配置步骤：

1. 点击 VSCode 左侧边栏的 PawSQL 图标，进行PawSQL配置
2. 在配置页面中正确填写以下配置项：
   - PawSQL Server (例如：`https://pawsql.com`)
   - Account (您在PawSQL Server的账号)
   - Password (PawSQL Server账号的密码)
3. 点击"保存"按钮

## 在VS Code环境中进行SQL 优化

在 SQL 文件中提供两种优化方式：

1. **使用默认工作空间优化SQL**：
   - 在 SQL 语句上方的提示中点击"Optimize"按钮
   
2. **选择特定工作空间优化SQL**：
   - 点击 SQL 语句提示中的"Optimize..."按钮
   - 从弹出的下拉列表中选择工作空间，进行优化

## 查看优化结果

优化完成后：

- 您可以在VSCode中打开的tab页中查看优化结果
- 还可以点击"在浏览器中查看优化详情"可查看更多信息，包括：
  - SQL 对比
  - 执行计划对比
  - 其他详细分析

**注意事项**

- 您必须在[PawSQL Cloud](https://pawsql.com)或私域部署的PawSQL优化平台有对应的账号