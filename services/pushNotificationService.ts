import PushNotification from 'react-native-push-notification';

export class PushNotificationService {
  static showLocalNotification(title: string, message: string, data?: any) {
    PushNotification.localNotification({
      title: title,
      message: message,
      channelId: 'default-channel-id',
      userInfo: data,
      playSound: true,
      soundName: 'default',
      importance: 'high',
      priority: 'high',
    });
  }

  static scheduleNotification(
    title: string,
    message: string,
    date: Date,
    data?: any
  ) {
    PushNotification.localNotificationSchedule({
      title: title,
      message: message,
      date: date,
      channelId: 'default-channel-id',
      userInfo: data,
      playSound: true,
      soundName: 'default',
      importance: 'high',
      priority: 'high',
    });
  }

  static cancelAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  static cancelNotification(id: string) {
    PushNotification.cancelLocalNotifications({id});
  }

  static requestPermissions() {
    PushNotification.requestPermissions();
  }

  static getChannels(callback: (channels: any) => void) {
    PushNotification.getChannels(callback);
  }

  static checkPermissions(callback: (permissions: any) => void) {
    PushNotification.checkPermissions(callback);
  }
} 