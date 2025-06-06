# Background Service - مستندات کامل

این مستند راهنمای کامل استفاده از Background Service در اپلیکیشن ArkaFile را ارائه می‌دهد.

## 📋 کارکرد کلی

Background Service یک سرویس خودکار است که:
1. **بدون پکیج اضافی** کار می‌کند
2. در بک گراند **همیشه فعال** است
3. **کوکی/توکن کاربر** را چک می‌کند
4. به **API مشخص شده** درخواست می‌فرستد
5. در صورت موفقیت **نوتیفیکیشن** نمایش می‌دهد

## 🏗️ معماری

### Singleton Pattern
- فقط یک نمونه از سرویس در کل اپ وجود دارد
- قابلیت کنترل کامل از هر نقطه‌ای از برنامه

### Event-Driven
- رصد تغییرات وضعیت اپلیکیشن (Foreground/Background)
- اجرای خودکار هنگام بازگشت به Foreground

### Timer-Based
- استفاده از `setInterval` برای اجرای دوره‌ای
- قابلیت تنظیم بازه زمانی (به دقیقه)

## 🚀 راه‌اندازی

### 1. راه‌اندازی خودکار در App.tsx

```typescript
import backgroundService from './services/backgroundService';

// در useEffect اصلی
useEffect(() => {
  // پیکربندی سرویس
  backgroundService.configure({
    apiUrl: 'https://your-api-endpoint.com/check', // URL API خودتان
    intervalMinutes: 5,           // هر 5 دقیقه
    enableNotifications: true,    // نوتیفیکیشن فعال
    enableLogging: true,         // لاگ برای دیباگ
  });

  // شروع سرویس
  backgroundService.start();

  // پاکسازی هنگام بستن اپ
  return () => {
    backgroundService.stop();
  };
}, []);
```

### 2. کنترل دستی

```typescript
import backgroundService from '../services/backgroundService';

// شروع دستی
backgroundService.start();

// توقف دستی
backgroundService.stop();

// اجرای فوری
await backgroundService.runTaskNow();

// تغییر URL
backgroundService.setApiUrl('https://new-api.com/endpoint');

// تغییر بازه زمانی
backgroundService.setInterval(10); // 10 دقیقه

// فعال/غیرفعال کردن نوتیفیکیشن
backgroundService.setNotifications(false);
```

## ⚙️ تنظیمات

### BackgroundServiceConfig

```typescript
interface BackgroundServiceConfig {
  apiUrl: string;              // آدرس API
  intervalMinutes: number;     // بازه زمانی (دقیقه)
  enableNotifications: boolean; // نوتیفیکیشن
  enableLogging: boolean;      // لاگ‌گیری
}
```

### تنظیمات پیشنهادی

```typescript
// برای توسعه (Development)
{
  apiUrl: 'https://your-api.com/test-endpoint',
  intervalMinutes: 1,          // هر 1 دقیقه برای تست
  enableNotifications: true,
  enableLogging: true,
}

// برای تولید (Production)
{
  apiUrl: 'https://your-api.com/check-status',
  intervalMinutes: 15,         // هر 15 دقیقه
  enableNotifications: true,
  enableLogging: false,        // کاهش لاگ در تولید
}
```

## 🔄 جریان کار (Workflow)

### 1. شروع سرویس
```
App Launch → Configure Service → Start Service → First Check
```

### 2. چرخه عادی
```
Timer Trigger → Check Token → API Call → Success? → Notification
     ↑                                      ↓
     ←←←←←←←←←←←←←←←←← Wait for Interval ←←←←←←
```

### 3. تغییر وضعیت اپ
```
Background → Foreground → Immediate Check → Resume Normal Cycle
```

## 📡 API Integration

### درخواست HTTP

سرویس این درخواست را ارسال می‌کند:

```http
GET https://your-api-endpoint.com/check-status
Authorization: Bearer ACCESS_TOKEN_FROM_COOKIES
Content-Type: application/json
Accept: application/json
```

### Response مورد انتظار

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "message": "تایید شد"
  }
}
```

### کدهای وضعیت

- **200-299**: موفقیت → نوتیفیکیشن نمایش داده می‌شود
- **400-499**: خطای کلاینت → لاگ خطا
- **500-599**: خطای سرور → لاگ خطا
- **Network Error**: خطای شبکه → لاگ خطا

## 🔔 نوتیفیکیشن‌ها

### ساختار نوتیفیکیشن موفقیت

```typescript
{
  title: 'ArkaFile',
  message: 'عملیات با موفقیت انجام شد!',
  channelId: 'default-channel-id',
  playSound: true,
  importance: 'high',
  userInfo: {
    type: 'background_task_success',
    timestamp: Date.now(),
  }
}
```

### شخصی‌سازی نوتیفیکیشن

می‌توانید در کد `showSuccessNotification()` تغییرات دلخواه ایجاد کنید:

```typescript
private showSuccessNotification(): void {
  PushNotification.localNotification({
    title: 'عنوان دلخواه',
    message: 'پیام دلخواه شما',
    // سایر تنظیمات...
  });
}
```

## 🛠️ کامپوننت کنترل

### نمایش کامل کنترل‌ها

```typescript
import BackgroundServiceControl from './components/BackgroundServiceControl';

// در کامپوننت اصلی (فقط برای دیباگ)
{__DEV__ && <BackgroundServiceControl />}
```

### ویژگی‌های کامپوننت کنترل

- ✅ نمایش وضعیت آنی سرویس
- ✅ دکمه‌های شروع/توقف
- ✅ اجرای دستی تسک
- ✅ تغییر URL API
- ✅ تنظیم بازه زمانی
- ✅ کنترل نوتیفیکیشن
- ✅ نمایش آمار کامل

## 📊 نظارت و دیباگ

### لاگ‌های سیستم

```javascript
// نمونه لاگ‌های سیستم
[BackgroundService] 2024-01-01T12:00:00.000Z: Starting background service...
[BackgroundService] 2024-01-01T12:00:01.000Z: Main interval started with 5 minutes
[BackgroundService] 2024-01-01T12:00:02.000Z: Performing background task...
[BackgroundService] 2024-01-01T12:00:03.000Z: Valid access token found - making API call
[BackgroundService] 2024-01-01T12:00:04.000Z: API response status: 200
[BackgroundService] 2024-01-01T12:00:05.000Z: Success notification sent
```

### بررسی وضعیت

```typescript
const stats = backgroundService.getStats();
console.log(stats);
// Output:
// {
//   isRunning: true,
//   appState: 'active',
//   config: { apiUrl: '...', intervalMinutes: 5, ... },
//   uptime: 'Running'
// }
```

## ⚠️ نکات مهم

### 1. مدیریت حافظه
- سرویس از Singleton pattern استفاده می‌کند
- حتماً `stop()` را هنگام بستن اپ فراخوانی کنید

### 2. مدیریت شبکه
- درخواست‌ها timeout دارند (30 ثانیه)
- خطاهای شبکه به طور مناسب مدیریت می‌شوند

### 3. مدیریت Battery
- بازه زمانی کوتاه‌تر = مصرف بیشتر باتری
- برای production حداقل 5 دقیقه پیشنهاد می‌شود

### 4. تست و دیباگ
- در حالت توسعه `enableLogging: true` قرار دهید
- از کامپوننت کنترل برای تست استفاده کنید

## 🔧 عیب‌یابی

### مشکلات رایج

1. **سرویس شروع نمی‌شود**
   ```typescript
   // بررسی کنید که configure شده باشد
   const status = backgroundService.getStatus();
   console.log('Service status:', status);
   ```

2. **API call کار نمی‌کند**
   ```typescript
   // بررسی کنید که توکن موجود باشد
   const token = await TokenService.getValidAccessToken();
   console.log('Token exists:', !!token);
   ```

3. **نوتیفیکیشن نمایش داده نمی‌شود**
   ```typescript
   // بررسی تنظیمات نوتیفیکیشن
   backgroundService.setNotifications(true);
   ```

### تست دستی

```typescript
// تست فوری
await backgroundService.runTaskNow();

// تست با URL مخصوص
backgroundService.setApiUrl('https://httpbin.org/status/200');
await backgroundService.runTaskNow();
```

## 🎯 مثال کامل

```typescript
import React, { useEffect } from 'react';
import backgroundService from './services/backgroundService';

const App = () => {
  useEffect(() => {
    // پیکربندی کامل
    backgroundService.configure({
      apiUrl: 'https://api.yoursite.com/check-user-status',
      intervalMinutes: 10,
      enableNotifications: true,
      enableLogging: __DEV__, // فقط در توسعه
    });

    // شروع سرویس
    backgroundService.start();

    // پاکسازی
    return () => {
      backgroundService.stop();
    };
  }, []);

  return (
    <YourAppComponents />
  );
};
```

سرویس حالا آماده استفاده است و تمام نیازمندی‌های شما را برآورده می‌کند! 🎉 