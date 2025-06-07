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
    console.log('[BackgroundService] Background task started');
    
    // Keep running and check every minute
    while (true) {
      try {
        // Check if token exists
        const token = await TokenService.getValidAccessToken();
        
        if (token) {
          console.log('[BackgroundService] Token found, making API request');
          
          // Make API request with token
          const response = await fetch(this.apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            console.log('[BackgroundService] API request successful');
            PushNotificationService.showSuccessNotification('درخواست API موفقیت‌آمیز بود!');
          } else {
            console.log(`[BackgroundService] API request failed: ${response.status}`);
          }
        } else {
          console.log('[BackgroundService] No token found, skipping API call');
        }
      } catch (error) {
        console.log('[BackgroundService] Error in background task:', error);
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
      console.log('[BackgroundService] Starting background service');
      
      const options = {
        taskName: 'ArkaFile API Service',
        taskTitle: 'ArkaFile API Service',
        taskDesc: 'پردازش درخواست‌های API',
        taskIcon: {
          name: 'ic_launcher',
          type: 'mipmap',
        }
      };

      await BackgroundActions.start(this.backgroundTask, options);
      this.isRunning = true;
      
      console.log('[BackgroundService] Background service started successfully');
    } catch (error) {
      console.error('[BackgroundService] Error starting background service:', error);
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
      console.log('[BackgroundService] Stopping background service');
      
      // Stop background actions
      await BackgroundActions.stop();
      this.isRunning = false;
      
      console.log('[BackgroundService] Background service stopped successfully');
    } catch (error) {
      console.error('[BackgroundService] Error stopping background service:', error);
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
    console.log(`[BackgroundService] API URL updated to: ${newUrl}`);
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