# راهنمای Background Service با احراز هویت JWT

## 🎯 **توضیح کلی**

این Background Service خودکار هر دقیقه یک بار به API درخواست ارسال می‌کند، اما **فقط در صورت وجود توکن معتبر**. درخواست‌ها با JWT Token در header Authorization ارسال می‌شوند و در صورت موفقیت، نوتیفیکیشن نمایش داده می‌شود.

## ✅ **ویژگی‌ها**

- ✅ **احراز هویت اجباری**: فقط با Token معتبر درخواست ارسال می‌شود
- ✅ **JWT در Header**: Token به صورت `Bearer` در Authorization header ارسال می‌شود
- ✅ **اجرای خودکار**: بدون نیاز به UI، خودکار شروع می‌شود
- ✅ **بررسی Token**: قبل از هر درخواست، Token را بررسی می‌کند
- ✅ **نوتیفیکیشن هوشمند**: فقط در صورت موفقیت نوتیفیکیشن نمایش می‌دهد
- ✅ **مدیریت خطا**: در صورت نبود Token، درخواست لغو می‌شود

## 🚀 **نحوه کار**

### جریان کاری Service:

```
1. App شروع می‌شود
   ↓
2. Background Service خودکار فعال می‌شود
   ↓
3. هر دقیقه: بررسی Token
   ↓
4. اگر Token موجود: درخواست API با JWT Header
   ↓
5. اگر Token نبود: Skip کردن درخواست
   ↓
6. در صورت موفقیت: نمایش نوتیفیکیشن
```

## 🔧 **تنظیمات**

### تغییر URL API

در فایل `App.tsx` خط 80:
```typescript
BackgroundService.setApiUrl('https://your-api-endpoint.com/api');
```

### تغییر فاصله زمانی

در فایل `services/backgroundService.ts` خط 130:
```typescript
setInterval(async () => {
  await this.executeApiCall();
}, 60000); // 60000 = 1 دقیقه
```

**نمونه فواصل زمانی:**
- 30 ثانیه: `30000`
- 2 دقیقه: `120000`  
- 5 دقیقه: `300000`
- 10 دقیقه: `600000`

## 🔐 **مدیریت Token**

### نحوه کار با Token:

1. **دریافت Token**: از `TokenService.getValidAccessToken()`
2. **بررسی اعتبار**: خودکار بررسی می‌شود
3. **ارسال در Header**: به صورت `Authorization: Bearer {token}`
4. **عدم وجود Token**: درخواست لغو می‌شود

### مثال درخواست ارسالی:

```http
GET /api/endpoint HTTP/1.1
Host: your-api.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📱 **نوتیفیکیشن‌ها**

### زمان نمایش نوتیفیکیشن:
- ✅ **موفقیت API**: زمانی که درخواست با کد 200 پاسخ داده شود
- ❌ **عدم نمایش**: اگر Token نباشد یا درخواست ناموفق باشد

### متن نوتیفیکیشن:
- **عنوان**: ArkaFile  
- **متن**: "درخواست موفقیت‌آمیز بود!" (یا پیام مخصوص API)

## 🛠️ **عیب‌یابی**

### بررسی Logs:

```bash
# Android
npx react-native log-android

# iOS  
npx react-native log-ios
```

### پیام‌های Log مهم:

```
[BackgroundService] Background task started
[BackgroundService] Checking token for API call
[BackgroundService] Token found, executing API call
[BackgroundService] Making API request to: URL with token
[BackgroundService] API request successful
```

### اگر Token نبود:

```
[BackgroundService] No token found, skipping API call
```

## 🔧 **استفاده برنامه‌نویسی**

### شروع سرویس:

```typescript
import { BackgroundService } from './services/backgroundService';

// شروع با URL مشخص
await BackgroundService.start('https://api.example.com/endpoint');

// یا تنظیم URL و سپس شروع
BackgroundService.setApiUrl('https://api.example.com/endpoint');
await BackgroundService.start();
```

### توقف سرویس:

```typescript
await BackgroundService.stop();
```

### بررسی وضعیت:

```typescript
const isRunning = BackgroundService.isServiceRunning();
const status = BackgroundService.getStatus();
console.log('Service Status:', status);
```

### تغییر URL در حین اجرا:

```typescript
BackgroundService.updateApiUrl('https://new-api.com/endpoint');
```

## ⚠️ **نکات مهم**

### 1. مدیریت Token
- Service خودکار Token را از `TokenService` می‌گیرد
- اگر Token منقضی شود، درخواست‌ها متوقف می‌شوند
- Token باید به‌روز نگه داشته شود

### 2. مصرف باتری
- Service در پس‌زمینه اجرا می‌شود
- برای کاهش مصرف باتری، فاصله زمانی را افزایش دهید

### 3. Permissions
- Permissions لازم در `AndroidManifest.xml` تنظیم شده
- برای iOS ممکن است نیاز به تنظیمات اضافی باشد

### 4. Network
- درخواست‌ها نیاز به اتصال اینترنت دارند
- در صورت قطع اتصال، درخواست‌ها fail می‌شوند

## 📄 **نمونه کد کامل**

```typescript
import React, { useEffect } from 'react';
import { BackgroundService } from './services/backgroundService';

const App = () => {
  useEffect(() => {
    const initService = async () => {
      try {
        // تنظیم URL API
        BackgroundService.setApiUrl('https://your-api.com/status');
        
        // شروع سرویس
        await BackgroundService.start();
        console.log('Background service started');
      } catch (error) {
        console.error('Service start error:', error);
      }
    };

    initService();

    // پاک‌سازی هنگام خروج
    return () => {
      BackgroundService.stop();
    };
  }, []);

  return (
    // محتوای اپلیکیشن شما
  );
};
```

---

**✨ نکته**: این سرویس کاملاً خودکار است و نیازی به مداخله کاربر ندارد. تنها کافی است URL API را تنظیم کنید و سرویس خودکار شروع به کار می‌کند. 