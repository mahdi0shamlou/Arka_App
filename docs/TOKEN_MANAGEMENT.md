# مدیریت توکن‌ها در ArkaFile App

این راهنما نحوه استفاده از سیستم مدیریت توکن‌ها را شرح می‌دهد.

## نصب و راه‌اندازی

پکیج‌های مورد نیاز قبلاً نصب شده‌اند:
- `@react-native-cookies/cookies` - برای مدیریت کوکی‌ها
- `@react-native-async-storage/async-storage` - برای ذخیره‌سازی محلی

## ساختار فایل‌ها

```
services/
├── tokenService.ts     # سرویس اصلی مدیریت توکن‌ها
├── useToken.ts        # React Hook برای استفاده در کامپوننت‌ها
types/
├── auth.ts           # تعریف انواع TypeScript
components/
├── TokenStatus.tsx   # کامپوننت نمایش وضعیت توکن (تست)
└── Web.tsx          # کامپوننت WebView با قابلیت مدیریت توکن
```

## استفاده از TokenService

### متدهای اصلی

```typescript
import { TokenService } from '../services/tokenService';

// دریافت توکن‌ها از کوکی‌ها
const tokens = await TokenService.getTokensFromCookies();

// ذخیره توکن‌ها
await TokenService.saveTokens(tokens);

// دریافت توکن‌های ذخیره شده
const storedTokens = await TokenService.getStoredTokens();

// دریافت توکن معتبر
const accessToken = await TokenService.getValidAccessToken();

// بررسی اعتبار توکن
const isValid = await TokenService.isTokenValid();

// همگام‌سازی از کوکی‌ها
await TokenService.syncTokensFromCookies();

// پاک کردن توکن‌ها
await TokenService.clearTokens();
await TokenService.clearCookies();
```

## استفاده از useToken Hook

```typescript
import { useToken } from '../services/useToken';

const MyComponent = () => {
  const {
    tokens,
    accessToken,
    isTokenValid,
    isLoading,
    error,
    refreshTokens,
    clearTokens,
    syncFromCookies,
  } = useToken();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isTokenValid) {
    return <LoginScreen />;
  }

  return (
    <View>
      <Text>کاربر وارد شده</Text>
      <Text>توکن: {accessToken?.substring(0, 20)}...</Text>
    </View>
  );
};
```

## ویژگی‌های کلیدی

### 1. همگام‌سازی خودکار
- توکن‌ها به صورت خودکار از کوکی‌های WebView استخراج می‌شوند
- هنگام بارگذاری صفحه، توکن‌ها همگام‌سازی می‌شوند

### 2. ذخیره‌سازی امن
- از AsyncStorage برای ذخیره‌سازی محلی استفاده می‌شود
- توکن‌های منقضی شده به صورت خودکار پاک می‌شوند

### 3. ارتباط با WebView
- JavaScript تزریق شده تغییرات localStorage را رصد می‌کند
- رویدادهای logout به صورت خودکار تشخیص داده می‌شوند

### 4. مدیریت خطاها
- تمام خطاها به صورت مناسب مدیریت می‌شوند
- لاگ‌های مفصل برای رفع اشکال

## تنظیمات کوکی

سیستم به دنبال این نام‌های کوکی می‌گردد:
- `access_token`
- `token`
- `auth_token`
- `refresh_token`
- `expires_in`
- `token_type`

## نکات مهم

1. **دامنه**: فقط کوکی‌های مربوط به `arkafile.info` پردازش می‌شوند
2. **امنیت**: توکن‌ها در AsyncStorage ذخیره می‌شوند (رمزگذاری خودکار)
3. **عملکرد**: کش محلی برای کاهش درخواست‌های شبکه
4. **خطایابی**: استفاده از کامپوننت `TokenStatus` برای نمایش وضعیت

## مثال کامل

```typescript
import React, { useEffect } from 'react';
import { View, Text, Button } from 'react-native';
import { useToken } from '../services/useToken';

const Dashboard = () => {
  const { 
    accessToken, 
    isTokenValid, 
    isLoading, 
    refreshTokens, 
    clearTokens 
  } = useToken();

  useEffect(() => {
    // بررسی دوره‌ای اعتبار توکن
    const interval = setInterval(() => {
      if (!isTokenValid) {
        refreshTokens();
      }
    }, 60000); // هر دقیقه

    return () => clearInterval(interval);
  }, [isTokenValid, refreshTokens]);

  const handleLogout = async () => {
    await clearTokens();
    // هدایت به صفحه ورود
  };

  if (isLoading) {
    return <Text>در حال بارگذاری...</Text>;
  }

  if (!isTokenValid) {
    return <Text>لطفاً وارد شوید</Text>;
  }

  return (
    <View>
      <Text>خوش آمدید!</Text>
      <Text>توکن شما معتبر است</Text>
      <Button title="خروج" onPress={handleLogout} />
    </View>
  );
};
```

## رفع اشکال

برای بررسی وضعیت توکن‌ها، کامپوننت `TokenStatus` را در App.tsx اضافه کنید:

```typescript
import TokenStatus from './components/TokenStatus';

// در داخل کامپوننت اصلی
{__DEV__ && <TokenStatus />}
```

این کامپوننت اطلاعات زیر را نمایش می‌دهد:
- وضعیت اعتبار توکن
- محتوای توکن (کوتاه شده)
- زمان انقضا
- دکمه‌های مدیریت (بروزرسانی، همگام‌سازی، پاک کردن) 