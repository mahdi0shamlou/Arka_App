import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {PushNotificationService} from '../services/pushNotificationService';

const NotificationExample: React.FC = () => {
  const handleShowNotification = () => {
    PushNotificationService.showLocalNotification(
      'Test Notification',
      'This is a test notification!',
      {customData: 'test'}
    );
  };

  const handleScheduleNotification = () => {
    const futureDate = new Date(Date.now() + 10 * 1000); // 10 seconds from now
    PushNotificationService.scheduleNotification(
      'Scheduled Notification',
      'This notification was scheduled 10 seconds ago!',
      futureDate,
      {scheduled: true}
    );
    Alert.alert('Success', 'Notification scheduled for 10 seconds from now');
  };

  const handleCheckPermissions = () => {
    PushNotificationService.checkPermissions((permissions) => {
      Alert.alert('Permissions', JSON.stringify(permissions, null, 2));
    });
  };

  const handleCancelAll = () => {
    PushNotificationService.cancelAllNotifications();
    Alert.alert('Success', 'All notifications cancelled');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Push Notification Test</Text>
      
      <TouchableOpacity style={styles.button} onPress={handleShowNotification}>
        <Text style={styles.buttonText}>Show Immediate Notification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleScheduleNotification}>
        <Text style={styles.buttonText}>Schedule Notification (10s)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleCheckPermissions}>
        <Text style={styles.buttonText}>Check Permissions</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleCancelAll}>
        <Text style={styles.buttonText}>Cancel All Notifications</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
    minWidth: 250,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default NotificationExample; 