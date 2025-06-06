import {AppState, AppStateStatus} from 'react-native';
import PushNotification from 'react-native-push-notification';
import {TokenService} from './tokenService';

export interface BackgroundServiceConfig {
  apiUrl: string;
  intervalMinutes: number;
  enableNotifications: boolean;
  enableLogging: boolean;
}

class BackgroundService {
  private static instance: BackgroundService | null = null;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private currentAppState: AppStateStatus = 'active';
  private watchdogId: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  private autoRestartEnabled: boolean = true;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 10;
  
  // Default configuration
  private config: BackgroundServiceConfig = {
    apiUrl: 'https://www.arkafile.info/api/check-status', // URL پیش فرض - باید تغییر کنید
    intervalMinutes: 5, // هر 5 دقیقه
    enableNotifications: true,
    enableLogging: true,
  };

  // Singleton pattern
  public static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  /**
   * Configure the background service
   */
  public configure(config: Partial<BackgroundServiceConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('Service configured with:', this.config);
  }

  /**
   * Start the background service
   */
  public start(): void {
    if (this.isRunning) {
      this.log('Service is already running');
      return;
    }

    this.isRunning = true;
    this.restartAttempts = 0;
    this.log('Starting background service...');

    // Start monitoring app state
    this.startAppStateMonitoring();

    // Start the main interval
    this.startMainInterval();

    // Start watchdog
    this.startWatchdog();

    // Run first check immediately
    this.performBackgroundTask();

    // Update heartbeat
    this.updateHeartbeat();
  }

  /**
   * Stop the background service
   */
  public stop(): void {
    if (!this.isRunning) {
      this.log('Service is not running');
      return;
    }

    this.isRunning = false;
    this.log('Stopping background service...');

    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Clear watchdog
    if (this.watchdogId) {
      clearInterval(this.watchdogId);
      this.watchdogId = null;
    }

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * Check if service is running
   */
  public getStatus(): { isRunning: boolean; config: BackgroundServiceConfig } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }

  /**
   * Monitor app state changes
   */
  private startAppStateMonitoring(): void {
    this.currentAppState = AppState.currentState;
    
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    this.log(`App state changed from ${this.currentAppState} to ${nextAppState}`);

    if (this.currentAppState === 'background' && nextAppState === 'active') {
      // App came to foreground - perform immediate check and verify service health
      this.log('App came to foreground - performing health check');
      this.checkServiceHealth();
      this.performBackgroundTask();
      
      // Ensure service is still running after coming back from background
      if (!this.isRunning) {
        this.log('Service was stopped while in background - restarting');
        this.start();
      }
    }

    if (nextAppState === 'background') {
      // App going to background - ensure persistence
      this.log('App going to background - ensuring service persistence');
      this.ensureServicePersistence();
    }

    this.currentAppState = nextAppState;
  }

  /**
   * Start the main interval for background tasks
   */
  private startMainInterval(): void {
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    
    this.intervalId = setInterval(() => {
      this.performBackgroundTask();
    }, intervalMs);

    this.log(`Main interval started with ${this.config.intervalMinutes} minutes`);
  }

  /**
   * Main background task - the core functionality
   */
  private async performBackgroundTask(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.log('Performing background task...');

      // Update heartbeat
      this.updateHeartbeat();

      // Step 1: Get user's cookies/token
      const accessToken = await TokenService.getValidAccessToken();
      
      if (!accessToken) {
        this.log('No valid access token found - skipping API call');
        return;
      }

      this.log('Valid access token found - making API call');

      // Step 2: Make API request
      const success = await this.makeApiRequest(accessToken);

      // Step 3: Show notification if successful
      if (success && this.config.enableNotifications) {
        this.showSuccessNotification();
      }

      // Update heartbeat after successful completion
      this.updateHeartbeat();

    } catch (error) {
      this.log('Error in background task:', error);
      this.handleTaskError(error);
    }
  }

  /**
   * Make API request with the user's token
   */
  private async makeApiRequest(token: string): Promise<boolean> {
    try {
      this.log(`Making API request to: ${this.config.apiUrl}`);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(this.config.apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      this.log(`API response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        this.log('API request successful:', data);
        return true;
      } else {
        this.log(`API request failed with status: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.log('API request error:', error);
      return false;
    }
  }

  /**
   * Show success notification
   */
  private showSuccessNotification(): void {
    try {
      PushNotification.localNotification({
        title: 'ArkaFile',
        message: 'عملیات با موفقیت انجام شد!',
        channelId: 'default-channel-id',
        playSound: true,
        soundName: 'default',
        importance: 'high',
        priority: 'high',
        autoCancel: true,
        largeIcon: 'ic_launcher',
        smallIcon: 'ic_notification',
        userInfo: {
          type: 'background_task_success',
          timestamp: Date.now(),
        },
      });

      this.log('Success notification sent');
    } catch (error) {
      this.log('Error sending notification:', error);
    }
  }

  /**
   * Logging utility
   */
  private log(message: string, data?: any): void {
    if (this.config.enableLogging) {
      const timestamp = new Date().toISOString();
      console.log(`[BackgroundService] ${timestamp}: ${message}`, data || '');
    }
  }

  /**
   * Force run background task manually
   */
  public async runTaskNow(): Promise<void> {
    this.log('Manual task execution requested');
    await this.performBackgroundTask();
  }

  /**
   * Update API URL
   */
  public setApiUrl(url: string): void {
    this.config.apiUrl = url;
    this.log(`API URL updated to: ${url}`);
  }

  /**
   * Update interval
   */
  public setInterval(minutes: number): void {
    this.config.intervalMinutes = minutes;
    this.log(`Interval updated to: ${minutes} minutes`);
    
    // Restart interval with new timing
    if (this.isRunning) {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
      this.startMainInterval();
    }
  }

  /**
   * Enable/disable notifications
   */
  public setNotifications(enabled: boolean): void {
    this.config.enableNotifications = enabled;
    this.log(`Notifications ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current statistics
   */
  public getStats(): {
    isRunning: boolean;
    appState: AppStateStatus;
    config: BackgroundServiceConfig;
    uptime: string;
    lastHeartbeat: string;
    restartAttempts: number;
  } {
    return {
      isRunning: this.isRunning,
      appState: this.currentAppState,
      config: this.config,
      uptime: this.isRunning ? 'Running' : 'Stopped',
      lastHeartbeat: new Date(this.lastHeartbeat).toLocaleString('fa-IR'),
      restartAttempts: this.restartAttempts,
    };
  }

  /**
   * Update heartbeat timestamp
   */
  private updateHeartbeat(): void {
    this.lastHeartbeat = Date.now();
  }

  /**
   * Start watchdog to monitor service health
   */
  private startWatchdog(): void {
    this.watchdogId = setInterval(() => {
      this.checkServiceHealth();
    }, 60000); // Check every minute

    this.log('Watchdog started');
  }

  /**
   * Check service health and restart if needed
   */
  private checkServiceHealth(): void {
    const now = Date.now();
    const timeSinceHeartbeat = now - this.lastHeartbeat;
    const maxHeartbeatAge = (this.config.intervalMinutes + 2) * 60 * 1000; // Add 2 minutes buffer

    if (timeSinceHeartbeat > maxHeartbeatAge && this.isRunning) {
      this.log(`Service appears to be stuck. Last heartbeat: ${timeSinceHeartbeat}ms ago`);
      this.handleServiceFailure('Heartbeat timeout');
    }

    // Additional health checks
    if (this.isRunning && !this.intervalId) {
      this.log('Service marked as running but no interval found');
      this.handleServiceFailure('Missing interval');
    }
  }

  /**
   * Handle service failure and attempt restart
   */
  private handleServiceFailure(reason: string): void {
    this.log(`Service failure detected: ${reason}`);

    if (!this.autoRestartEnabled) {
      this.log('Auto-restart is disabled');
      return;
    }

    if (this.restartAttempts >= this.maxRestartAttempts) {
      this.log(`Maximum restart attempts (${this.maxRestartAttempts}) reached`);
      this.autoRestartEnabled = false;
      return;
    }

    this.restartAttempts++;
    this.log(`Attempting to restart service (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);

    try {
      this.forceRestart();
    } catch (error) {
      this.log('Failed to restart service:', error);
    }
  }

  /**
   * Force restart the service
   */
  private forceRestart(): void {
    this.log('Force restarting service...');

    // Force stop
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.watchdogId) {
      clearInterval(this.watchdogId);
      this.watchdogId = null;
    }

    // Wait a moment then restart
    setTimeout(() => {
      this.start();
      this.log('Service force restarted successfully');
    }, 1000);
  }

  /**
   * Handle task errors
   */
  private handleTaskError(error: any): void {
    this.log('Task error occurred:', error);

    // If it's a critical error, trigger service check
    if (error?.name === 'AbortError' || error?.code === 'NETWORK_ERROR') {
      // Don't restart for network errors, just log
      this.log('Network error detected, will retry on next interval');
    } else {
      // For other errors, check if we need to restart
      this.log('Non-network error, checking service health');
      this.checkServiceHealth();
    }
  }

  /**
   * Enable or disable auto-restart
   */
  public setAutoRestart(enabled: boolean): void {
    this.autoRestartEnabled = enabled;
    if (enabled) {
      this.restartAttempts = 0; // Reset attempts when re-enabling
    }
    this.log(`Auto-restart ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Force restart the service manually
   */
  public forceRestartNow(): void {
    this.log('Manual force restart requested');
    this.restartAttempts = 0; // Reset attempts for manual restart
    this.forceRestart();
  }

  /**
   * Ensure service persistence when going to background
   */
  private ensureServicePersistence(): void {
    if (!this.isRunning) {
      this.log('Service not running, starting it for background persistence');
      this.start();
      return;
    }

    // Verify all components are running
    if (!this.intervalId) {
      this.log('Missing interval, restarting main interval');
      this.startMainInterval();
    }

    if (!this.watchdogId) {
      this.log('Missing watchdog, restarting watchdog');
      this.startWatchdog();
    }

    // Update heartbeat to show we're actively managing persistence
    this.updateHeartbeat();
    
    this.log('Service persistence ensured');
  }
}

// Export singleton instance
export const backgroundService = BackgroundService.getInstance();
export default backgroundService; 