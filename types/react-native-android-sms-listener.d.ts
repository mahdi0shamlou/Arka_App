declare module '@ernestbies/react-native-android-sms-listener' {
  /**
   * SMS message object received by the listener
   */
  interface SmsMessage {
    /** The body/content of the SMS message */
    body: string;
    /** The phone number that sent the SMS */
    originatingAddress: string;
    /** Timestamp when the SMS was received (optional) */
    timestamp?: number;
  }

  /**
   * Subscription object returned by addListener
   */
  interface CancellableSubscription {
    /** Remove the SMS listener */
    remove: () => void;
  }

  /**
   * Callback function type for SMS listener
   */
  type SmsListenerCallback = (message: SmsMessage) => void;

  /**
   * SMS Listener interface
   */
  interface SmsListenerModule {
    /**
     * Add a listener for incoming SMS messages
     * @param callback Function to be called when SMS is received
     * @returns Cancellable subscription to remove the listener
     */
    addListener: (callback: SmsListenerCallback) => CancellableSubscription;
  }

  const SmsListener: SmsListenerModule;
  export default SmsListener;
}
