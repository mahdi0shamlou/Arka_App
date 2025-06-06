# Push Notifications Setup

## Overview
This app now includes push notification support using `react-native-push-notification`. The setup includes both local notifications and the foundation for remote push notifications.

## Features Included

### 1. Local Notifications
- Immediate notifications
- Scheduled notifications
- Custom notification channels
- Notification data handling

### 2. Push Notification Service
A utility service class (`PushNotificationService`) provides easy-to-use methods for:
- `showLocalNotification(title, message, data?)` - Show immediate notification
- `scheduleNotification(title, message, date, data?)` - Schedule notification for later
- `cancelAllNotifications()` - Cancel all pending notifications
- `cancelNotification(id)` - Cancel specific notification
- `requestPermissions()` - Request notification permissions
- `checkPermissions(callback)` - Check current permissions

### 3. Example Usage

```typescript
import { PushNotificationService } from '../services/pushNotificationService';

// Show immediate notification
PushNotificationService.showLocalNotification(
  'Test Title',
  'Test Message',
  { customData: 'value' }
);

// Schedule notification
const futureDate = new Date(Date.now() + 60000); // 1 minute from now
PushNotificationService.scheduleNotification(
  'Scheduled Title',
  'This was scheduled!',
  futureDate
);
```

## Configuration Details

### Android Configuration
- Permissions added to `AndroidManifest.xml`:
  - `WAKE_LOCK`
  - `VIBRATE` 
  - `RECEIVE_BOOT_COMPLETED`
  - `SCHEDULE_EXACT_ALARM`

- Services and receivers configured for notification handling
- Push notification package added to `MainApplication.kt`

### Notification Channel
A default notification channel is created with:
- Channel ID: `default-channel-id`
- High importance level
- Sound and vibration enabled

## Testing
Use the `NotificationExample` component to test all notification features:
- Immediate notifications
- Scheduled notifications  
- Permission checking
- Notification cancellation

## Next Steps for Remote Notifications
To add Firebase/remote push notifications:
1. Add Firebase to your project
2. Configure FCM in `google-services.json`
3. Update the `onRegister` callback to save tokens
4. Implement server-side push notification sending

## Troubleshooting
- Ensure app has notification permissions
- Check notification settings in device settings
- For Android, ensure notification channels are properly created
- Test on physical device (notifications may not work in emulator) 