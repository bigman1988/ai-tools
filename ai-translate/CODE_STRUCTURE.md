# AI-Translate 代码结构文档

## 项目概述

AI-Translate 是一个基于 Web 的翻译工具，用于翻译 Excel 表格中的内容。它支持多种语言之间的翻译，并提供用户友好的界面来上传、查看和翻译表格数据。

## 文件结构

```
src/
├── components/
│   └── progress.ts       # 进度条组件
├── services/
│   └── translator.ts     # 翻译服务
├── types/
│   └── types.ts          # 类型定义
├── utils/
│   └── excel.ts          # Excel 处理工具
├── global.d.ts           # 全局类型声明
├── index.html            # 主 HTML 页面
├── index.ts              # 主应用逻辑
└── styles.css            # 样式表
```

## 核心组件和功能

### 1. `index.ts` - 主应用逻辑

这是应用的主要入口点，包含 `ExcelTranslator` 类，负责处理用户交互、表格显示和翻译流程。

#### 主要方法：

- **`constructor()`**: 初始化应用，设置事件监听器
- **`init()`**: 初始化 UI 和事件处理
- **`handleFileUpload()`**: 处理文件上传
- **`handleDragOver()`**: 处理拖拽文件
- **`handleDrop()`**: 处理文件放置
- **`handleSheetChange()`**: 处理工作表切换
- **`handleTranslateClick()`**: 处理翻译按钮点击
- **`createTranslationTasks()`**: 创建翻译任务
- **`processBatches()`**: 处理翻译批次
- **`updateCellInDOM()`**: 直接更新 DOM 中的单元格内容
- **`displaySheet()`**: 显示当前工作表
- **`log()`**: 记录日志信息

### 2. `services/translator.ts` - 翻译服务

提供翻译功能的服务，负责与翻译 API 通信。

#### 主要方法：

- **`translateBatch()`**: 翻译一批文本
- **`translateText()`**: 翻译单个文本
- **`detectLanguage()`**: 检测文本语言

### 3. `types/types.ts` - 类型定义

定义应用中使用的接口和类型。

#### 主要类型：

- **`SheetData`**: 工作表数据结构
- **`TranslationTask`**: 翻译任务结构
- **`TranslationBatch`**: 翻译批次结构
- **`LanguageOption`**: 语言选项结构

### 4. `utils/excel.ts` - Excel 处理工具

处理 Excel 文件的工具函数。

#### 主要方法：

- **`readExcelFile()`**: 读取 Excel 文件
- **`parseWorkbook()`**: 解析工作簿
- **`convertSheetToArray()`**: 将工作表转换为数组

### 5. `components/progress.ts` - 进度条组件

提供进度条功能的组件。

#### 主要方法：

- **`show()`**: 显示进度条
- **`update()`**: 更新进度
- **`hide()`**: 隐藏进度条

### 6. `index.html` - 主 HTML 页面

应用的 HTML 结构，包含上传区域、表格显示区域和控制按钮。

### 7. `styles.css` - 样式表

定义应用的样式，包括表格样式、按钮样式和布局。

## 关键流程

### 翻译流程

1. 用户上传 Excel 文件 (`handleFileUpload()`)
2. 解析文件并显示表格 (`displaySheet()`)
3. 用户选择源语言和目标语言
4. 用户点击翻译按钮 (`handleTranslateClick()`)
5. 创建翻译任务 (`createTranslationTasks()`)
6. 将任务分批处理 (`processBatches()`)
7. 调用翻译服务翻译文本 (`translateBatch()`)
8. 更新表格中的单元格 (`updateCellInDOM()`)

### 表格显示流程

1. 解析 Excel 文件 (`readExcelFile()`)
2. 将工作表转换为数组 (`convertSheetToArray()`)
3. 创建表格 DOM 结构 (`displaySheet()`)
4. 渲染表格到页面

## 重要实现细节

### 表格处理

- 表格使用 `position: sticky` 实现表头固定
- 单元格宽度限制为 200px，高度自动调整
- 行号列固定在左侧

### 翻译任务处理

- 翻译任务包含行索引、列索引和 DOM 行索引
- 只有当单元格为空时才创建翻译任务
- 只有当翻译结果非空时才更新单元格
- 翻译任务分批处理，避免一次发送过多请求

### DOM 更新优化

- 使用 `updateCellInDOM()` 直接更新单元格内容，而不是重新渲染整个表格
- 通过行号匹配找到正确的 DOM 行，确保更新正确的单元格

## 已解决的问题

1. 表头固定：表头现在会在滚动时保持固定在顶部
2. 单元格宽度限制：单元格宽度限制为 200px，内容过多时会自动换行
3. 空翻译结果处理：如果没有翻译结果，不会在目标单元格中写入内容
4. 行索引问题：修复了行索引计算错误导致的翻译结果显示在错误位置的问题

## 潜在改进点

1. 添加更多翻译服务提供商选项
2. 实现翻译结果的导出功能
3. 添加批量操作功能
4. 优化大文件处理性能
5. 添加更多语言支持
