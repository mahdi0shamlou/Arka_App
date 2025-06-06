import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useToken} from '../services/useToken';

const TokenStatus: React.FC = () => {
  const {
    tokens,
    accessToken,
    isTokenValid,
    isLoading,
    error,
    refreshTokens,
    clearTokens,
    syncFromCookies,
  } = useToken();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>در حال بارگذاری توکن‌ها...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>وضعیت توکن</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.label}>وضعیت:</Text>
        <Text style={[styles.status, isTokenValid ? styles.valid : styles.invalid]}>
          {isTokenValid ? 'معتبر' : 'نامعتبر'}
        </Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.label}>توکن دسترسی:</Text>
        <Text style={styles.token}>
          {accessToken ? `${accessToken.substring(0, 20)}...` : 'موجود نیست'}
        </Text>
      </View>

      {tokens?.expires_at && (
        <View style={styles.statusContainer}>
          <Text style={styles.label}>انقضا:</Text>
          <Text style={styles.expiry}>
            {new Date(tokens.expires_at).toLocaleString('fa-IR')}
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.statusContainer}>
          <Text style={styles.errorLabel}>خطا:</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={refreshTokens}>
          <Text style={styles.buttonText}>بروزرسانی</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={syncFromCookies}>
          <Text style={styles.buttonText}>همگام‌سازی کوکی‌ها</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearTokens}>
          <Text style={styles.buttonText}>پاک کردن</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    margin: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1d4ed8',
  },
  loadingText: {
    textAlign: 'center',
    color: '#6c757d',
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  label: {
    fontWeight: 'bold',
    marginRight: 8,
    color: '#495057',
    minWidth: 80,
  },
  status: {
    fontWeight: 'bold',
  },
  valid: {
    color: '#28a745',
  },
  invalid: {
    color: '#dc3545',
  },
  token: {
    flex: 1,
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  expiry: {
    color: '#6c757d',
    fontSize: 12,
  },
  errorLabel: {
    fontWeight: 'bold',
    color: '#dc3545',
    marginRight: 8,
  },
  errorText: {
    color: '#dc3545',
    flex: 1,
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  button: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default TokenStatus; 