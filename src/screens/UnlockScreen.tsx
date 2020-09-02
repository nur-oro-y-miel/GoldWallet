import dayjs from 'dayjs';
import React, { PureComponent } from 'react';
import { StatusBar, StyleSheet, Text, View, Keyboard } from 'react-native';
import { connect } from 'react-redux';

import { images } from 'app/assets';
import { Image, PinView, PinInputView } from 'app/components';
import { CONST, Route, firstAttempt, finalAttempt } from 'app/consts';
import { BiometricService, SecureStorageService, NavigationService } from 'app/services';
import { ApplicationState } from 'app/state';
import {
  setTimeCounter,
  SetTimeCounterAction,
  setFailedAttempts,
  SetFailedAttemptsAction,
  setFailedAttemptStep,
  SetFailedAttemptStepAction,
} from 'app/state/timeCounter/actions';
import { TimeCounterState } from 'app/state/timeCounter/reducer';
import { getStatusBarHeight, palette, typography } from 'app/styles';

const BlueApp = require('../../BlueApp');
const i18n = require('../../loc');

interface Props {
  onSuccessfullyAuthenticated?: () => void;
  isBiometricEnabledByUser: boolean;
  setTimeCounter: (timestamp: number) => SetTimeCounterAction;
  setFailedAttempts: (attempt: number) => SetFailedAttemptsAction;
  setFailedAttemptStep: (failedAttempt: number) => SetFailedAttemptStepAction;
  timeCounter: TimeCounterState;
}

interface State {
  pin: string;
  error: string;
  isCount: boolean;
}

class UnlockScreen extends PureComponent<Props, State> {
  state: State = {
    pin: '',
    error: '',
    isCount: true,
  };

  async componentDidMount() {
    await BlueApp.startAndDecrypt();
    if (this.props.isBiometricEnabledByUser && !this.isTimeCounterVisible()) {
      await this.unlockWithBiometrics();
    }
    Keyboard.dismiss();
  }

  unlockWithBiometrics = async () => {
    if (!!BiometricService.biometryType) {
      const result = await BiometricService.unlockWithBiometrics();
      if (result) {
        this.props.onSuccessfullyAuthenticated && this.props.onSuccessfullyAuthenticated();
      }
    }
  };

  handleFailedAttempt = (increasedFailedAttemptStep: number) => {
    const { attempt } = this.props.timeCounter;
    const { setFailedAttempts, setFailedAttemptStep, setTimeCounter } = this.props;
    const isFinalAttempt = increasedFailedAttemptStep === finalAttempt;
    let currentDate = dayjs();
    let blockedTimeInMinutes = 1;

    if (attempt === 1) {
      blockedTimeInMinutes = 2;
    } else if (attempt > 1) {
      blockedTimeInMinutes = 10;
    }
    currentDate = currentDate.add(blockedTimeInMinutes, 'minute');

    if (isFinalAttempt) {
      setTimeCounter(currentDate.unix());
      setFailedAttempts(attempt + 1);
      setFailedAttemptStep(0);
      this.setState({ isCount: true });
    } else {
      setFailedAttemptStep(increasedFailedAttemptStep);
    }

    return !isFinalAttempt
      ? `\n${i18n.onboarding.failedTimesErrorInfo} ${blockedTimeInMinutes} ${i18n.onboarding.minutes}\n${i18n.onboarding.failedTimes} ${increasedFailedAttemptStep}/${finalAttempt}`
      : '';
  };

  updatePin = (pin: string) => {
    const { setFailedAttempts, setFailedAttemptStep } = this.props;
    if (this.state.pin.length < CONST.pinCodeLength) {
      this.setState({ pin: this.state.pin + pin }, async () => {
        if (this.state.pin.length === CONST.pinCodeLength) {
          const setPin = await SecureStorageService.getSecuredValue(CONST.pin);
          if (setPin === this.state.pin) {
            setFailedAttempts(0);
            setFailedAttemptStep(0);
            this.props.onSuccessfullyAuthenticated && this.props.onSuccessfullyAuthenticated();
          } else {
            const increasedFailedAttemptStep = this.props.timeCounter.failedAttemptStep + 1;
            const failedTimesError = this.handleFailedAttempt(increasedFailedAttemptStep);
            this.setState({
              error: i18n.onboarding.pinDoesNotMatch + failedTimesError,
              pin: '',
            });
          }
        }
      });
    }
  };

  onClearPress = () => {
    this.setState({
      pin: this.state.pin.slice(0, -1),
    });
  };

  onTryAgain = () => {
    this.setState({ isCount: false, error: '' });
    this.unlockWithBiometrics();
  };

  isTimeCounterVisible = () => {
    return dayjs().unix() < this.props.timeCounter.timestamp && this.state.isCount;
  };

  render() {
    const { error, pin } = this.state;
    if (this.isTimeCounterVisible()) {
      NavigationService.navigate(Route.TimeCounter, {
        onTryAgain: this.onTryAgain,
        timestamp: this.props.timeCounter.timestamp,
      });
      return null;
    }
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.imageContainer}>
          <Image source={images.portraitLogo} style={styles.logo} resizeMode="contain" />
        </View>
        <PinView value={pin} length={CONST.pinCodeLength} />
        <Text style={styles.errorText}>{error}</Text>
        <PinInputView value={pin} onTextChange={this.updatePin} onClearPress={this.onClearPress} />
      </View>
    );
  }
}

const mapStateToProps = (state: ApplicationState) => ({
  timeCounter: state.timeCounter,
});

const mapDispatchToProps = {
  setTimeCounter,
  setFailedAttempts,
  setFailedAttemptStep,
};

export default connect(mapStateToProps, mapDispatchToProps)(UnlockScreen);

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.white,
    alignItems: 'center',
    ...StyleSheet.absoluteFillObject,
    paddingTop: getStatusBarHeight(),
    zIndex: 1000,
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    width: 150,
    height: 235,
  },
  errorText: {
    marginVertical: 20,
    color: palette.textRed,
    marginHorizontal: 20,
    textAlign: 'center',
    ...typography.headline6,
  },
});
