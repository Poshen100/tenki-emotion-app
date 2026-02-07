---
description: How to develop new signal processing modules for Tenki Core
---

# Signal Processing Development Workflow

## Pre-requisites
- 確認已閱讀 `CLAUDE.md` 中的 Skills 文件
- 了解 Event Bridge Pattern
- 新模組必須放在 `core/` 資料夾

## Step 1: 創建模組結構

```javascript
// core/your-module.js
(function () {
    'use strict';

    class YourModule {
        constructor() {
            // 初始化
        }

        yourMethod() {
            // 功能實作
        }
    }

    // 暴露 API
    window.TENKI_YOUR_MODULE = {
        create() { return new YourModule(); },
        YourModule
    };

    console.log('[YOUR-MODULE] Module loaded ✓');
})();
```

## Step 2: 在 index.html SAFE ZONE 載入

```html
<!-- TENKI PRO SAFE ZONE START -->
<script src="core/your-module.js"></script>
<!-- TENKI PRO SAFE ZONE END -->
```

## Step 3: 透過 EventBridge 整合

```javascript
// 發送事件
EventBridge.emit('your-module:update', { data: yourData });

// 監聽事件
EventBridge.on('tenki:frame', (data) => {
    yourModule.processFrame(data);
});
```

## Step 4: 與 Fusion Controller 整合

```javascript
const fusion = TENKI_FUSION.create({
    hrvModule: hrv,
    facsModule: facs,
    yourModule: yourModule  // 添加自訂模組
});
```

// turbo-all
