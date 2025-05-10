import React from 'react'
import { Image, Text, View } from 'react-native'

function SplashScreen() {
  return (
    <View
    style={{
      flex: 1,
      backgroundColor: '#1d4ed8',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    }}>
    <Image
      source={require('../assets/icon.png')}
      style={{width: 200, height: 200}}
    />
    <Text style={{fontSize: 40, color: 'white', fontWeight: 600}}>
      آرکا فایل
    </Text>
    <Text
      style={{
        fontSize: 20,
        color: 'white',
        fontWeight: 400,
        textAlign: 'center',
      }}>
      به لحظه ترین فایلینگ املاک کشور
    </Text>
  </View>
  )
}

export default SplashScreen