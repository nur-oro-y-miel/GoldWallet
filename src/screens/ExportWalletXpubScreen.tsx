import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { NavigationScreenProps } from 'react-navigation';
import { useNavigationParam } from 'react-navigation-hooks';

import { images } from 'app/assets';
import { Header, ScreenTemplate } from 'app/components';
import { CopyButton } from 'app/components/CopyButton';
import { Wallet } from 'app/consts';
import { en } from 'app/locale';
import { typography, palette } from 'app/styles';

export const ExportWalletXpubScreen = () => {
  const wallet: Wallet = useNavigationParam('wallet');
  const xpub = wallet.getXpub();

  return (
    <ScreenTemplate>
      <Text style={styles.title}>{wallet.label}</Text>
      <View style={styles.qrCodeContainer}>
        <QRCode
          value={xpub}
          logo={images.qrCode}
          size={160}
          logoSize={40}
          logoBackgroundColor={palette.background}
          ecl={'H'}
        />
      </View>
      <Text style={styles.xpub}>{xpub}</Text>
      <CopyButton textToCopy={xpub} />
    </ScreenTemplate>
  );
};

ExportWalletXpubScreen.navigationOptions = (props: NavigationScreenProps) => ({
  header: <Header title={en.exportWalletXpub.header} isCancelButton={true} navigation={props.navigation} />,
});

const styles = StyleSheet.create({
  qrCodeContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: { ...typography.headline4, marginTop: 16, textAlign: 'center' },
  xpub: {
    ...typography.caption,
  },
});