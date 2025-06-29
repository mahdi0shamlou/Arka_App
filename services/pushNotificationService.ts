import PushNotification, {
  ChannelObject,
  LocalNotificationOptions,
  PushNotificationPermissions,
  ScheduledNotificationOptions,
} from 'react-native-push-notification';

export interface NotificationData {
  [key: string]: any;
}

export class PushNotificationService {
  /**
   * Show a local notification immediately
   */
  static showLocalNotification(
    title: string,
    message: string,
    data?: NotificationData,
  ): void {
    const options: LocalNotificationOptions = {
      title,
      message,
      channelId: 'default-channel-id',
      userInfo: data,
      playSound: true,
      soundName: 'default',
      importance: 'high',
      priority: 'high',
      autoCancel: true,
      largeIcon: 'ic_launcher',
      smallIcon: 'ic_notification',
    };

    PushNotification.localNotification(options);
  }

  /**
   * Schedule a notification for a specific date
   */
  static scheduleNotification(
    title: string,
    message: string,
    date: Date,
    data?: NotificationData,
  ): void {
    const options: ScheduledNotificationOptions = {
      title,
      message,
      date,
      channelId: 'default-channel-id',
      userInfo: data,
      playSound: true,
      soundName: 'default',
      importance: 'high',
      priority: 'high',
      autoCancel: true,
      largeIcon: 'ic_launcher',
      smallIcon: 'ic_notification',
    };

    PushNotification.localNotificationSchedule(options);
  }

  /**
   * Show a success notification
   */
  static showSuccessNotification(
    message: string = 'عملیات با موفقیت انجام شد!',
  ): void {
    this.showLocalNotification('ArkaFile', message, {
      type: 'success',
      timestamp: Date.now(),
    });
  }

  /**
   * Show an error notification
   */
  static showErrorNotification(message: string = 'خطا در انجام عملیات!'): void {
    this.showLocalNotification('ArkaFile - خطا', message, {
      type: 'error',
      timestamp: Date.now(),
    });
  }

  /**
   * Show an info notification
   */
  static showInfoNotification(message: string): void {
    this.showLocalNotification('ArkaFile - اطلاعیه', message, {
      type: 'info',
      timestamp: Date.now(),
    });
  }

  /**
   * Cancel all local notifications
   */
  static cancelAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  /**
   * Cancel a specific notification by ID
   */
  static cancelNotification(id: string): void {
    PushNotification.cancelLocalNotifications({id});
  }

  /**
   * Request notification permissions
   */
  static async requestPermissions(): Promise<PushNotificationPermissions> {
    return await PushNotification.requestPermissions();
  }

  /**
   * Check current notification permissions
   */
  static checkPermissions(
    callback: (permissions: PushNotificationPermissions) => void,
  ): void {
    PushNotification.checkPermissions(callback);
  }

  /**
   * Get all notification channels
   */
  static getChannels(callback: (channels: string[]) => void): void {
    PushNotification.getChannels(callback);
  }

  /**
   * Create a notification channel (Android)
   */
  static createChannel(
    channelId: string,
    channelName: string,
    channelDescription?: string,
    callback?: (created: boolean) => void,
  ): void {
    const channel: ChannelObject = {
      channelId,
      channelName,
      channelDescription,
      playSound: true,
      soundName: 'default',
      importance: 4,
      vibrate: true,
    };

    PushNotification.createChannel(channel, callback);
  }

  /**
   * Delete a notification channel (Android)
   */
  static deleteChannel(channelId: string): void {
    PushNotification.deleteChannel(channelId);
  }

  /**
   * Check if a channel exists (Android)
   */
  static channelExists(
    channelId: string,
    callback: (exists: boolean) => void,
  ): void {
    PushNotification.channelExists(channelId, callback);
  }

  /**
   * Set application badge number (iOS)
   */
  static setApplicationIconBadgeNumber(badgeCount: number): void {
    PushNotification.setApplicationIconBadgeNumber(badgeCount);
  }

  /**
   * Get application badge number (iOS)
   */
  static getApplicationIconBadgeNumber(
    callback: (badgeCount: number) => void,
  ): void {
    PushNotification.getApplicationIconBadgeNumber(callback);
  }

  /**
   * Remove all delivered notifications
   */
  static removeAllDeliveredNotifications(): void {
    PushNotification.removeAllDeliveredNotifications();
  }

  /**
   * Get delivered notifications
   */
  static getDeliveredNotifications(
    callback: (notifications: object[]) => void,
  ): void {
    PushNotification.getDeliveredNotifications(callback);
  }

  /**
   * Get scheduled notifications
   */
  static getScheduledLocalNotifications(
    callback: (notifications: object[]) => void,
  ): void {
    PushNotification.getScheduledLocalNotifications(callback);
  }
}
