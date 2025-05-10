import React from 'react'
import { ActivityIndicator, View } from 'react-native'
import { styles } from '../styles/styles'

function Loader() {
  return (
    <View style={styles.loader}>
    <ActivityIndicator size="large" color="#1d4ed8" />
  </View>
  )
}

export default Loader