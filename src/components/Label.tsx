import React from 'react';
import { View, Text, StyleSheet, StyleProp, TextProps } from 'react-native';

import { typography, palette } from 'app/styles';

interface Props {
  labelStyle: StyleProp<TextProps>;
  children: string;
}

export const Label = ({ children, labelStyle }: Props) => (
  <View style={styles.labelWrapper}>
    <Text style={[styles.label, labelStyle]}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  labelWrapper: {
    display: 'flex',
  },
  label: {
    ...typography.status,
    backgroundColor: palette.mediumGrey,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 2,
    textAlign: 'center',
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
});
