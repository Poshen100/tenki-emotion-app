---
description: How to run and test Tenki Core application
---

# Run Tenki Core Workflow

## Development Server

// turbo
1. Start local development server:
```bash
cd C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app
npx serve .
```

2. Open browser at `http://localhost:3000`

## Testing Modules

// turbo
3. Open browser console (F12) and verify modules loaded:
```javascript
// Check all modules loaded
console.log('HRV:', typeof TENKI_HRV_ADVANCED);
console.log('FACS:', typeof TENKI_FACS);
console.log('FUSION:', typeof TENKI_FUSION);
```

4. Test HRV calculation:
```javascript
const hrv = TENKI_HRV_ADVANCED.create();
const testRRs = TENKI_HRV_ADVANCED.generateTestRRs(100, 800, 50);
testRRs.forEach(rr => hrv.pushRR(rr));
console.log(hrv.getMetrics());
```

5. Test Fusion:
```javascript
const fusion = TENKI_FUSION.create();
console.log(fusion.computeFusion());
```

## Git Push

// turbo
6. Stage and commit changes:
```bash
git add .
git commit -m "feat: your changes"
git push origin main
```

// turbo-all
