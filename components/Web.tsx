import React from 'react';
import {Linking} from 'react-native';
import WebView from 'react-native-webview';

interface IProps {
  setHasError: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCanGoBack: React.Dispatch<React.SetStateAction<boolean>>;
  webViewRef: React.RefObject<WebView<{}> | null>;
}

function Web({setHasError, setLoading, setCanGoBack, webViewRef}: IProps) {
  const handleNavigation = (event: any) => {
    const url = event.url;
    if (url.startsWith('tel:')) {
      Linking.openURL(url);
      return false;
    }
    return true;
  };
  return (
    <WebView
      source={{uri: 'https://www.arkafile.info/dashboard'}}
      ref={webViewRef}
      onLoadProgress={event => {
        setCanGoBack(event.nativeEvent.canGoBack);
      }}
      onLoadEnd={() => setLoading(false)}
      onShouldStartLoadWithRequest={handleNavigation}
      originWhitelist={['*']}
      style={{flex: 1}}
      onError={() => {
        setHasError(true);
      }}
      onHttpError={e => {
        setHasError(true);
      }}
    />
  );
}

export default Web;
