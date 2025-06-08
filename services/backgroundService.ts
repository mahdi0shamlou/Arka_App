import BackgroundActions from 'react-native-background-actions';
import { PushNotificationService } from './pushNotificationService';
import { TokenService } from './tokenService';

export interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
}

export class BackgroundService {
  private static isRunning = false;
  private static shouldStop = false;
  private static currentTimeoutId: NodeJS.Timeout | null = null;
  private static apiUrl = 'https://back.arkafile.info/Profile';

  /**
   * Set the API URL for background requests
   */
  static setApiUrl(url: string): void {
    this.apiUrl = url;
  }

  /**
   * Get current API URL
   */
  static getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Single API check function
   */
  private static async performApiCheck(): Promise<void> {
    try {
      const token = await TokenService.getValidAccessToken();
      
      if (!token) {
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(this.apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log('[BackgroundService] API success');
          PushNotificationService.showSuccessNotification('درخواست API موفقیت‌آمیز بود!');
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.log('[BackgroundService] Request error');
      }
    } catch (error) {
      console.log('[BackgroundService] Check error');
    }
  }

  /**
   * Schedule next API check
   */
  private static scheduleNextCheck(): void {
    if (this.shouldStop) {
      return;
    }

    this.currentTimeoutId = setTimeout(async () => {
      if (!this.shouldStop) {
        await this.performApiCheck();
        this.scheduleNextCheck();
      }
    }, 60000); // 1 minute
  }

  /**
   * Improved background task
   */
  private static async backgroundTask(): Promise<void> {
    console.log('[BackgroundService] Service started');
    this.shouldStop = false;
    
    // Perform first check immediately
    await this.performApiCheck();
    
    // Schedule subsequent checks
    this.scheduleNextCheck();
    
    // Keep the background task alive
    while (!this.shouldStop) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('[BackgroundService] Background task ended');
  }

  /**
   * Start the background service
   */
  static async start(apiUrl?: string): Promise<void> {
    if (this.isRunning) {
      console.log('[BackgroundService] Already running');
      return;
    }

    if (apiUrl) {
      this.setApiUrl(apiUrl);
    }

    try {
      const options = {
        taskName: 'ArkaFile API Service',
        taskTitle: 'ArkaFile API Service', 
        taskDesc: 'بررسی دوره‌ای API هر دقیقه',
        taskIcon: {
          name: 'ic_launcher',
          type: 'mipmap',
        },
      };

      await BackgroundActions.start(this.backgroundTask, options);
      this.isRunning = true;
      
      console.log('[BackgroundService] Started successfully');
    } catch (error) {
      console.error('[BackgroundService] Start error:', error);
      this.isRunning = false;
    }
  }

  /**
   * Stop the background service
   */
  static async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.shouldStop = true;
      
      // Clear any pending timeout
      if (this.currentTimeoutId) {
        clearTimeout(this.currentTimeoutId);
        this.currentTimeoutId = null;
      }

      await BackgroundActions.stop();
      this.isRunning = false;
      console.log('[BackgroundService] Stopped');
    } catch (error) {
      console.error('[BackgroundService] Stop error:', error);
      this.isRunning = false;
    }
  }

  /**
   * Check if the service is currently running
   */
  static isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Update the API endpoint while service is running
   */
  static updateApiUrl(newUrl: string): void {
    this.setApiUrl(newUrl);
  }

  /**
   * Get service status information
   */
  static getStatus(): {
    isRunning: boolean;
    apiUrl: string;
  } {
    return {
      isRunning: this.isRunning,
      apiUrl: this.apiUrl,
    };
  }
} 