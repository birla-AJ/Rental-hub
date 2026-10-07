import React, { useState } from 'react';
import { StatusBar, View, ActivityIndicator, Text, TextInput } from 'react-native';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from './src/session';
import RootNavigator, { navigationRef } from './src/navigation';
import { t } from './src/theme';
import Icon from './src/components/Icon';
import Splash from './src/screens/Splash';

// Preserve the visual hierarchy across Android/iOS devices even when the OS font scale differs.
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;
Text.defaultProps.maxFontSizeMultiplier = 1;
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false;
TextInput.defaultProps.maxFontSizeMultiplier = 1;

// Shows a splash while a saved login is restored, then opens the right place.
function Root() {
  const { restoring, loggedIn, role } = useSession();
  if (restoring) return (<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background }}><Icon name="home" size={44} color={t.primaryDark} /><ActivityIndicator color={t.primary} style={{ marginTop: 16 }} /></View>);
  // Owners pass through Consent first: it opens the dashboard by itself when there is nothing waiting for them.
  return <RootNavigator initialRoute={loggedIn ? (role === 'owner' ? 'Consent' : 'Main') : 'Welcome'} />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  // When the session ends (log out, or the server rejects the token) go back to the start.
  const toWelcome = () => navigationRef.isReady() && navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Welcome' }] }));
  return (
    <SafeAreaProvider>
      <SessionProvider onLoggedOut={toWelcome}>
        <NavigationContainer ref={navigationRef}>
          {/* Keep the system status area visually joined to the green app chrome. */}
          <StatusBar barStyle="light-content" backgroundColor="#173728" translucent={false} />
          {showSplash ? <Splash onContinue={() => setShowSplash(false)} /> : <Root />}
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
