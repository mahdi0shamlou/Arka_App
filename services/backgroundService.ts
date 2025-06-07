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
  private static apiUrl = 'https://back.arkafile.info/Profile'; // URL پیش‌فرض - باید تغییر دهید

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
   * Simple background task that runs every minute
   */
  private static async backgroundTask(): Promise<void> {
    console.log('[BackgroundService] Background task started - checking every minute');
    
    // Keep running and check every minute
    while (true) {
      try {
        // Check if token exists
        const token = await TokenService.getValidAccessToken();
        
        if (token) {
          try {
            // Make API request with token and timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch('https://back.arkafile.info/Profile', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              console.log('[BackgroundService] API request successful');
              PushNotificationService.showSuccessNotification('درخواست API موفقیت‌آمیز بود!');
            } else {
              console.log(`[BackgroundService] API request failed: ${response.status}`);
            }
          } catch (fetchError) {
            console.log('[BackgroundService] Request error:', fetchError);
          }
        }
      } catch (error) {
        console.log('[BackgroundService] Error:', error);
      }
      
      // Wait 1 minute before next check
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }

  /**
   * Start the background service
   */
  static async start(apiUrl?: string): Promise<void> {
    if (this.isRunning) {
      console.log('[BackgroundService] Service is already running');
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
        linkingURI: 'arkafile://background',
        parameters: {
          delay: 1000,
        },
        progressBar: {
          max: 100,
          value: 0,
          indeterminate: false,
        }
      };

      await BackgroundActions.start(this.backgroundTask, options);
      this.isRunning = true;
      
      console.log('[BackgroundService] Started - checking every minute');
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
      console.log('[BackgroundService] Service is not running');
      return;
    }

    try {
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