export interface PushNotificationData {
  [key: string]: any;
}

export interface LocalNotificationOptions {
  title: string;
  message: string;
  channelId?: string;
  userInfo?: PushNotificationData;
  playSound?: boolean;
  soundName?: string;
  importance?: 'default' | 'high' | 'low' | 'min';
  priority?: 'default' | 'high' | 'low' | 'min';
  vibrate?: boolean;
  vibration?: number;
  tag?: string;
  group?: string;
  groupSummary?: boolean;
  ongoing?: boolean;
  id?: number;
  ticker?: string;
  autoCancel?: boolean;
  largeIcon?: string;
  smallIcon?: string;
  bigText?: string;
  subText?: string;
  color?: string;
  number?: number;
  actions?: string[];
  invokeApp?: boolean;
  when?: number;
  usesChronometer?: boolean;
  timeoutAfter?: number;
}

export interface ScheduledNotificationOptions extends LocalNotificationOptions {
  date: Date;
  repeatType?: 'day' | 'week' | 'month' | 'year';
  repeatTime?: number;
}

export interface NotificationPermissions {
  alert?: boolean;
  badge?: boolean;
  sound?: boolean;
}

export interface PushNotificationToken {
  token: string;
  os: string;
}

export interface ReceivedNotification {
  foreground: boolean;
  userInteraction: boolean;
  message: string;
  data: PushNotificationData;
  badge?: number;
  alert?: any;
  sound?: string;
  finish: (fetchResult: string) => void;
} 