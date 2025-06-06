import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import backgroundService, {BackgroundServiceConfig} from '../services/backgroundService';

const BackgroundServiceControl: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<BackgroundServiceConfig>({
    apiUrl: '',
    intervalMinutes: 5,
    enableNotifications: true,
    enableLogging: true,
  });
  const [tempApiUrl, setTempApiUrl] = useState('');
  const [tempInterval, setTempInterval] = useState('5');

  useEffect(() => {
    // Load initial status
    const status = backgroundService.getStatus();
    setIsRunning(status.isRunning);
    setConfig(status.config);
    setTempApiUrl(status.config.apiUrl);
    setTempInterval(status.config.intervalMinutes.toString());
  }, []);

  const handleStart = () => {
    try {
      backgroundService.start();
      setIsRunning(true);
      Alert.alert('موفقیت', 'سرویس بک گراند راه‌اندازی شد');
    } catch (error) {
      Alert.alert('خطا', 'خطا در راه‌اندازی سرویس');
    }
  };

  const handleStop = () => {
    try {
      backgroundService.stop();
      setIsRunning(false);
      Alert.alert('موفقیت', 'سرویس بک گراند متوقف شد');
    } catch (error) {
      Alert.alert('خطا', 'خطا در متوقف کردن سرویس');
    }
  };

  const handleRunNow = async () => {
    try {
      await backgroundService.runTaskNow();
      Alert.alert('موفقیت', 'تسک به صورت دستی اجرا شد');
    } catch (error) {
      Alert.alert('خطا', 'خطا در اجرای دستی تسک');
    }
  };

  const handleUpdateApiUrl = () => {
    if (tempApiUrl.trim()) {
      backgroundService.setApiUrl(tempApiUrl.trim());
      setConfig(prev => ({...prev, apiUrl: tempApiUrl.trim()}));
      Alert.alert('موفقیت', 'URL API بروزرسانی شد');
    }
  };

  const handleUpdateInterval = () => {
    const minutes = parseInt(tempInterval);
    if (minutes > 0) {
      backgroundService.setInterval(minutes);
      setConfig(prev => ({...prev, intervalMinutes: minutes}));
      Alert.alert('موفقیت', `بازه زمانی به ${minutes} دقیقه تغییر کرد`);
    } else {
      Alert.alert('خطا', 'بازه زمانی باید عددی مثبت باشد');
    }
  };

  const handleToggleNotifications = (value: boolean) => {
    backgroundService.setNotifications(value);
    setConfig(prev => ({...prev, enableNotifications: value}));
  };

  const getStats = () => {
    const stats = backgroundService.getStats();
    Alert.alert(
      'آمار سرویس',
      `وضعیت: ${stats.isRunning ? 'در حال اجرا' : 'متوقف'}\n` +
      `وضعیت اپ: ${stats.appState}\n` +
      `بازه زمانی: ${stats.config.intervalMinutes} دقیقه\n` +
      `نوتیفیکیشن: ${stats.config.enableNotifications ? 'فعال' : 'غیرفعال'}`
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>کنترل سرویس بک گراند</Text>

      {/* Service Status */}
      <View style={styles.section}>
        <View style={styles.statusContainer}>
          <Text style={styles.label}>وضعیت سرویس:</Text>
          <Text style={[styles.status, isRunning ? styles.running : styles.stopped]}>
            {isRunning ? 'در حال اجرا' : 'متوقف'}
          </Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.section}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, isRunning ? styles.stopButton : styles.startButton]}
            onPress={isRunning ? handleStop : handleStart}
          >
            <Text style={styles.buttonText}>
              {isRunning ? 'متوقف کردن' : 'راه‌اندازی'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleRunNow}>
            <Text style={styles.buttonText}>اجرای دستی</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.infoButton} onPress={getStats}>
          <Text style={styles.buttonText}>نمایش آمار</Text>
        </TouchableOpacity>
      </View>

      {/* API URL Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>تنظیمات API</Text>
        <Text style={styles.label}>URL API:</Text>
        <TextInput
          style={styles.textInput}
          value={tempApiUrl}
          onChangeText={setTempApiUrl}
          placeholder="https://example.com/api/endpoint"
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdateApiUrl}>
          <Text style={styles.buttonText}>بروزرسانی URL</Text>
        </TouchableOpacity>
      </View>

      {/* Interval Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>بازه زمانی</Text>
        <Text style={styles.label}>بازه (دقیقه):</Text>
        <TextInput
          style={styles.textInput}
          value={tempInterval}
          onChangeText={setTempInterval}
          placeholder="5"
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdateInterval}>
          <Text style={styles.buttonText}>بروزرسانی بازه</Text>
        </TouchableOpacity>
      </View>

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>تنظیمات نوتیفیکیشن</Text>
        <View style={styles.switchContainer}>
          <Text style={styles.label}>نوتیفیکیشن فعال:</Text>
          <Switch
            value={config.enableNotifications}
            onValueChange={handleToggleNotifications}
            trackColor={{false: '#767577', true: '#1d4ed8'}}
            thumbColor={config.enableNotifications ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Current Configuration Display */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>تنظیمات فعلی</Text>
        <Text style={styles.configText}>URL: {config.apiUrl}</Text>
        <Text style={styles.configText}>بازه: {config.intervalMinutes} دقیقه</Text>
        <Text style={styles.configText}>
          نوتیفیکیشن: {config.enableNotifications ? 'فعال' : 'غیرفعال'}
        </Text>
        <Text style={styles.configText}>
          لاگ: {config.enableLogging ? 'فعال' : 'غیرفعال'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1d4ed8',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#495057',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  running: {
    color: '#28a745',
  },
  stopped: {
    color: '#dc3545',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#28a745',
  },
  stopButton: {
    backgroundColor: '#dc3545',
  },
  updateButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  infoButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: 'white',
    textAlign: 'right',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  configText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});

export default BackgroundServiceControl; 