import * as Sentry from '@sentry/react-native';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { View, YellowBox, StyleSheet } from 'react-native';
import { createAppContainer } from 'react-navigation';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { i18n } from 'app/locale';
import { RootNavigator } from 'app/navigators';
import { UnlockScreen } from 'app/screens';
import { NavigationService, SecureStorageService, AppStateManager } from 'app/services';
import EventDispatcher from 'app/state/EventDispatcher';
import { persistor, store } from 'app/state/store';

YellowBox.ignoreWarnings(['VirtualizedLists should never be nested inside', `\`-[RCTRootView cancelTouches]\``]);

if (process.env.NODE_ENV !== 'development') {
  Sentry.init({
    dsn: 'https://23377936131848ca8003448a893cb622@sentry.io/1295736',
  });
}

const AppContainer = createAppContainer(RootNavigator);

interface State {
  isPinSet: boolean;
  successfullyAuthenticated: boolean;
}

export default class App extends React.PureComponent<State> {
  state: State = {
    isPinSet: false,
    successfullyAuthenticated: false,
  };

  async componentDidMount() {
    const isPinSet = await SecureStorageService.getSecuredValue('pin');
    if (isPinSet) {
      this.setState({ isPinSet });
    }
  }

  handleAppComesToForeground = async () => {
    this.setState({
      successfullyAuthenticated: false,
    });
  };

  onSuccessfullyAuthenticated = () => {
    this.setState({
      successfullyAuthenticated: true,
    });
  };

  render() {
    const { successfullyAuthenticated, isPinSet } = this.state;
    const isBiometricEnabledByUser = store.getState().appSettings.isBiometricsEnabled;
    return (
      <I18nextProvider i18n={i18n}>
        <Provider store={store}>
          <AppStateManager handleAppComesToForeground={this.handleAppComesToForeground} />
          <PersistGate loading={null} persistor={persistor}>
            <View style={styles.wrapper}>
              {isPinSet && !successfullyAuthenticated ? (
                <UnlockScreen
                  onSuccessfullyAuthenticated={this.onSuccessfullyAuthenticated}
                  isBiometricEnabledByUser={isBiometricEnabledByUser}
                />
              ) : (
                <AppContainer ref={NavigationService.setTopLevelNavigator} />
              )}
              <EventDispatcher />
            </View>
          </PersistGate>
        </Provider>
      </I18nextProvider>
    );
  }
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});
