import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as bip39 from 'bip39';
import React, { PureComponent } from 'react';
import { View, StyleSheet, Text, Keyboard, Alert } from 'react-native';
import { connect } from 'react-redux';

import { Header, TextAreaItem, FlatButton, ScreenTemplate, InputItem } from 'app/components';
import { Button } from 'app/components/Button';
import { Route, Wallet, MainCardStackNavigatorParams, ActionMeta } from 'app/consts';
import { CreateMessage, MessageType } from 'app/helpers/MessageCreator';
import { ApplicationState } from 'app/state';
import { selectors } from 'app/state/wallets';
import { importWallet as importWalletAction, ImportWalletAction } from 'app/state/wallets/actions';
import { typography, palette } from 'app/styles';

import {
  SegwitP2SHWallet,
  LegacyWallet,
  WatchOnlyWallet,
  HDSegwitP2SHWallet,
  HDLegacyP2PKHWallet,
  HDSegwitP2SHArWallet,
  HDSegwitBech32Wallet,
  HDSegwitP2SHAirWallet,
} from '../../class';
import { isElectrumVaultMnemonic } from '../../utils/crypto';

const i18n = require('../../loc');

interface Props {
  navigation: StackNavigationProp<MainCardStackNavigatorParams, Route.ImportWallet>;
  route: RouteProp<MainCardStackNavigatorParams, Route.ImportWallet>;
  importWallet: (wallet: Wallet, meta?: ActionMeta) => ImportWalletAction;
  wallets: Wallet[];
}

interface State {
  text: string;
  label: string;
  validationError: string;
}

export class ImportWalletScreen extends PureComponent<Props, State> {
  state = {
    text: '',
    label: '',
    validationError: '',
  };

  showErrorMessageScreen = ({
    title = i18n.message.somethingWentWrong,
    description = i18n.message.somethingWentWrongWhileCreatingWallet,
    onPress = () => this.props.navigation.navigate(Route.ImportWalletChooseType),
    buttonTitle = i18n.message.returnToWalletChoose,
  }: {
    title?: string;
    description?: string;
    onPress?: () => void;
    buttonTitle?: string;
  }) =>
    CreateMessage({
      title,
      description,
      type: MessageType.error,
      buttonProps: {
        title: buttonTitle,
        onPress,
      },
    });

  showSuccessImportMessageScreen = () =>
    CreateMessage({
      title: i18n.message.hooray,
      description: i18n.message.successfullWalletImport,
      type: MessageType.success,
      buttonProps: {
        title: i18n.message.returnToDashboard,
        onPress: () => this.props.navigation.navigate(Route.Dashboard),
      },
    });

  onImportButtonPress = () => {
    Keyboard.dismiss();
    this.importMnemonic(this.state.text);
  };

  onChangeText = (mnemonic: string) => {
    this.setState({ text: mnemonic });
  };

  onLabelChange = (value: string) => {
    const { wallets } = this.props;
    const validationError = wallets.some(w => w.label === value)
      ? i18n.wallets.importWallet.walletInUseValidationError
      : '';
    this.setState({
      label: value,
      validationError,
    });
  };

  onScanQrCodeButtonPress = () => {
    return this.props.navigation.navigate(Route.ScanQrCode, {
      onBarCodeScan: (mnemonic: string) => this.importMnemonic(mnemonic),
    });
  };

  saveWallet = async (newWallet: any) => {
    const { importWallet, wallets } = this.props;
    if (wallets.some(wallet => wallet.secret === newWallet.secret)) {
      this.showErrorMessageScreen({
        title: i18n.wallets.importWallet.walletInUseValidationError,
        description: i18n.wallets.importWallet.walletInUseValidationError,
        onPress: () => this.navigateToImportWallet(),
        buttonTitle: i18n.message.returnToWalletImport,
      });
    } else {
      await newWallet.fetchUtxos();
      newWallet.setLabel(this.state.label || i18n.wallets.import.imported + ' ' + newWallet.typeReadable);
      importWallet(newWallet, {
        onSuccess: () => {
          this.showSuccessImportMessageScreen();
        },
        onFailure: (error: string) =>
          this.showErrorMessageScreen({
            description: error,
          }),
      });
    }
  };

  showAlert = (error: string) => {
    Alert.alert('Error', error, [
      {
        text: 'OK',
      },
    ]);
  };

  createWalletMessage = (asyncTask: () => void) => {
    CreateMessage({
      title: i18n.message.creatingWallet,
      description: i18n.message.creatingWalletDescription,
      type: MessageType.processingState,
      asyncTask,
    });
  };

  createARWallet = (mnemonic: string) => {
    try {
      const wallet = new HDSegwitP2SHArWallet();
      wallet.setMnemonic(mnemonic);
      this.props.navigation.navigate(Route.IntegrateKey, {
        onBarCodeScan: (key: string) => {
          try {
            wallet.addPublicKey(key);
            this.createWalletMessage(() => {
              this.saveVaultWallet(wallet);
            });
          } catch (e) {
            this.showAlert(e.message);
          }
        },
        headerTitle: i18n.wallets.importWallet.header,
        title: i18n.wallets.importWallet.scanCancelPubKey,
        description: i18n.wallets.importWallet.scanPublicKeyDescription,
        withLink: false,
      });
    } catch (e) {
      this.showAlert(e.message);
    }
  };

  navigateToImportWallet = () => {
    const { navigation, route } = this.props;
    navigation.navigate(Route.ImportWallet, { walletType: route.params.walletType });
  };

  addInstantPublicKey = (wallet: HDSegwitP2SHAirWallet) => {
    this.props.navigation.navigate(Route.IntegrateKey, {
      onBarCodeScan: (instantPublicKey: string) => {
        try {
          wallet.addPublicKey(instantPublicKey);
          this.addRecoveryKey(wallet);
        } catch (e) {
          this.showAlert(e.message);
        }
      },
      headerTitle: i18n.wallets.importWallet.header,
      title: i18n.wallets.importWallet.scanFastPubKey,
      description: i18n.wallets.importWallet.scanPublicKeyDescription,
      withLink: false,
      onBackArrow: () => {
        this.navigateToImportWallet();
      },
    });
  };

  createAIRWallet = (mnemonic: string) => {
    try {
      const wallet = new HDSegwitP2SHAirWallet();
      wallet.setMnemonic(mnemonic);
      this.addInstantPublicKey(wallet);
    } catch (e) {
      this.showAlert(e.message);
    }
  };

  saveVaultWallet = async (wallet: HDSegwitP2SHArWallet | HDSegwitP2SHAirWallet) => {
    try {
      await wallet.generateAddresses();
      await wallet.fetchTransactions();
      if (wallet.getTransactions().length !== 0) {
        this.saveWallet(wallet);
      } else {
        this.showErrorMessageScreen({
          title: i18n.message.noTransactions,
          description: i18n.message.noTransactionsDesc,
        });
      }
    } catch (error) {
      this.showErrorMessageScreen({
        title: i18n.message.generateAddressesError,
        description: error.message,
      });
    }
  };

  renderSubtitle = () => (
    <>
      <View style={styles.arSubtitleContainer}>
        <Text style={styles.subtitle}>{i18n.wallets.importWallet.importARDescription1}</Text>
        <Text style={styles.subtitle}>{i18n._.or}</Text>
        <Text style={styles.subtitle}>{i18n.wallets.importWallet.importARDescription2}</Text>
      </View>
      <InputItem error={this.state.validationError} setValue={this.onLabelChange} label={i18n.wallets.add.inputLabel} />
    </>
  );

  addRecoveryKey = (wallet: HDSegwitP2SHAirWallet) => {
    this.props.navigation.navigate(Route.IntegrateKey, {
      onBarCodeScan: (recoveryPublicKey: string) => {
        try {
          wallet.addPublicKey(recoveryPublicKey);
          this.createWalletMessage(() => {
            this.saveVaultWallet(wallet);
          });
        } catch (error) {
          this.showAlert(error.message);
        }
      },
      withLink: false,
      headerTitle: i18n.wallets.importWallet.header,
      title: i18n.wallets.importWallet.scanCancelPubKey,
      description: i18n.wallets.importWallet.scanPublicKeyDescription,
      onBackArrow: () => {
        wallet.clearPublickKeys();
        this.addInstantPublicKey(wallet);
      },
    });
  };

  importLegacyWallet = async (trimmedMnemonic: string) => {
    try {
      const segwitWallet = new SegwitP2SHWallet();
      segwitWallet.setSecret(trimmedMnemonic);
      if (segwitWallet.getAddress()) {
        // ok its a valid WIF
        await segwitWallet.fetchTransactions();
        if (segwitWallet.getTransactions().length !== 0) {
          return this.saveWallet(segwitWallet);
        }
      }

      // case - WIF is valid, just has uncompressed pubkey

      const legacyWallet = new LegacyWallet();
      legacyWallet.setSecret(trimmedMnemonic);
      if (legacyWallet.getAddress()) {
        await legacyWallet.fetchTransactions();
        if (legacyWallet.getTransactions().length !== 0) {
          return this.saveWallet(legacyWallet);
        }
      }

      // if we're here - nope, its not a valid WIF

      const hdSegwitP2SH = new HDSegwitP2SHWallet();
      await hdSegwitP2SH.setSecret(trimmedMnemonic);
      if (hdSegwitP2SH.validateMnemonic()) {
        await hdSegwitP2SH.fetchTransactions();
        if (hdSegwitP2SH.getTransactions().length !== 0) {
          return this.saveWallet(hdSegwitP2SH);
        }
      }

      const hdSegwitBech32 = new HDSegwitBech32Wallet();
      await hdSegwitBech32.setSecret(trimmedMnemonic);
      if (hdSegwitBech32.validateMnemonic()) {
        await hdSegwitBech32.fetchTransactions();
        if (hdSegwitBech32.getTransactions().length !== 0) {
          return this.saveWallet(hdSegwitBech32);
        }
      }

      const hdLegactP2PKH = new HDLegacyP2PKHWallet();
      await hdLegactP2PKH.setSecret(trimmedMnemonic);
      if (hdLegactP2PKH.validateMnemonic()) {
        await hdSegwitBech32.fetchTransactions();
        if (hdSegwitBech32.getTransactions().length !== 0) {
          return this.saveWallet(hdSegwitBech32);
        }
      }

      const watchOnly = new WatchOnlyWallet();
      watchOnly.setSecret(trimmedMnemonic);
      if (watchOnly.valid()) {
        await watchOnly.fetchTransactions();
        if (watchOnly.getTransactions().length !== 0) {
          return this.saveWallet(watchOnly);
        }
      }

      // TODO: try a raw private key
    } catch (e) {
      this.showErrorMessageScreen({ description: e.message });
    }
    this.showErrorMessageScreen({ title: i18n.message.wrongMnemonic, description: i18n.message.wrongMnemonicDesc });
    // ReactNativeHapticFeedback.trigger('notificationError', {
    //   ignoreAndroidSystemSettings: false,
    // });
    // Plan:
    // 0. check if its HDSegwitBech32Wallet (BIP84)
    // 1. check if its HDSegwitP2SHWallet (BIP49)
    // 2. check if its HDLegacyP2PKHWallet (BIP44)
    // 3. check if its HDLegacyBreadwalletWallet (no BIP, just "m/0")
    // 4. check if its Segwit WIF (P2SH)
    // 5. check if its Legacy WIF
    // 6. check if its address (watch-only wallet)
    // 7. check if its private key (segwit address P2SH) TODO
    // 7. check if its private key (legacy address) TODO
  };

  importMnemonic = (mnemonic: string) => {
    const trimmedMnemonic = mnemonic.trim().replace(/ +/g, ' ');

    if (isElectrumVaultMnemonic(trimmedMnemonic) && !bip39.validateMnemonic(trimmedMnemonic)) {
      this.showErrorMessageScreen({ description: i18n.wallets.importWallet.unsupportedElectrumVaultMnemonic });
      return;
    }

    if (this.props?.route.params.walletType === HDSegwitP2SHArWallet.type) {
      return this.createARWallet(trimmedMnemonic);
    }
    if (this.props?.route.params.walletType === HDSegwitP2SHAirWallet.type) {
      return this.createAIRWallet(trimmedMnemonic);
    }
    this.createWalletMessage(() => {
      this.importLegacyWallet(trimmedMnemonic);
    });
  };
  render() {
    const { validationError, text } = this.state;
    return (
      <ScreenTemplate
        footer={
          <>
            <Button
              disabled={!text || !!validationError}
              title={i18n.wallets.importWallet.import}
              onPress={this.onImportButtonPress}
            />
            <FlatButton
              containerStyle={styles.scanQRCodeButtonContainer}
              title={i18n.wallets.importWallet.scanQrCode}
              onPress={this.onScanQrCodeButtonPress}
            />
          </>
        }
        header={
          <Header navigation={this.props.navigation} isBackArrow={true} title={i18n.wallets.importWallet.header} />
        }
      >
        <View style={styles.inputItemContainer}>
          <Text style={styles.title}>{i18n.wallets.importWallet.title}</Text>
          {this.renderSubtitle()}
          <TextAreaItem
            error={validationError}
            onChangeText={this.onChangeText}
            placeholder={i18n.wallets.importWallet.placeholder}
            style={styles.textArea}
          />
        </View>
      </ScreenTemplate>
    );
  }
}

const mapStateToProps = (state: ApplicationState) => ({
  wallets: selectors.wallets(state),
});

const mapDispatchToProps = {
  importWallet: importWalletAction,
};

export default connect(mapStateToProps, mapDispatchToProps)(ImportWalletScreen);

const styles = StyleSheet.create({
  inputItemContainer: {
    paddingTop: 16,
    width: '100%',
    flexGrow: 1,
  },
  title: {
    ...typography.headline4,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: palette.textGrey,
    paddingTop: 18,
    textAlign: 'center',
  },
  textArea: {
    marginTop: 24,
    height: 250,
  },
  scanQRCodeButtonContainer: {
    marginTop: 12,
  },
  arSubtitleContainer: {
    paddingHorizontal: 30,
    marginBottom: 30,
  },
});
