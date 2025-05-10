import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {styles} from '../styles/styles';

interface IProps {
  setHasError: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

function ErrorHandler({setHasError, setLoading}: IProps) {
  const handleReload = () => {
    setHasError(false);
    setLoading(true);
  };
  return (
    <View style={styles.container}>
      <Text style={{fontSize: 30}}>خطا در بارگذاری .</Text>
      <TouchableOpacity onPress={handleReload}>
        <Text
          style={{
            fontSize: 20,
            padding: 10,
            color: 'white',
            backgroundColor: '#1d4ed8',
            borderRadius: 16,
          }}>
          تلاش مجدد
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default ErrorHandler;
