import bigi from 'bigi';
import * as bip39 from 'bip39';
import { crypto, ECPair } from 'bitcoinjs-lib';
import CryptoJS from 'crypto-js';
import hmacSHA512 from 'crypto-js/hmac-sha512';
import * as ecurve from 'ecurve';
import { pbkdf2 } from 'pbkdf2';

import config from '../config';
import { ELECTRUM_VAULT_SEED_PREFIXES, ELECTRUM_VAULT_SEED_KEY } from '../src/consts';
import { bytesToBits, bitsToBytes } from './buffer';

const i18n = require('../loc');

interface GeneratePrivateKey {
  password: Buffer;
  salt: Buffer;
  iterations?: number;
  keylen?: number;
  digest?: string;
}

const ENCODING = 'hex';

export const generatePrivateKey = ({
  password,
  salt,
  iterations = 512,
  keylen = 32,
  digest = 'sha256',
}: GeneratePrivateKey): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
      if (err) {
        reject(err);
      }
      resolve(derivedKey);
    });
  });

export const privateKeyToPublicKey = (privateKey: Buffer) =>
  ecurve
    .getCurveByName('secp256k1')
    .G.multiply(bigi.fromBuffer(privateKey))
    .getEncoded(false)
    .toString(ENCODING);

const create132BitKeyWithSha256 = (bytes: Buffer, random128bits: string) => {
  const SALT_LENGHT = 4;
  const sha256Bits = bytesToBits(crypto.sha256(bytes));
  return sha256Bits.slice(0, SALT_LENGHT) + random128bits;
};

const generateWordsFromBytes = (random132bits: string) => {
  const dividedBits = random132bits.match(/.{1,11}/g);
  if (dividedBits === null) {
    throw new Error('Couldn`t parse bits');
  }
  return dividedBits.map(bit => {
    const index = parseInt(bit, 2);
    return bip39.wordlists.english[index];
  });
};

export const bytesToMnemonic = (bytes: Buffer): string => {
  const random128bits = bytesToBits(bytes);
  const random132bits = create132BitKeyWithSha256(bytes, random128bits);
  return generateWordsFromBytes(random132bits).join(' ');
};

export const mnemonicToBits = (mnemonic: string) => {
  const WORD_BIT_LENGHT = 11;

  return mnemonic.split(' ').reduce((bits, word) => {
    const index = bip39.wordlists.english.indexOf(word);
    if (index === -1) {
      throw new Error(
        i18n.formatString(i18n.wallets.errors.noIndexForWord, {
          word,
        }),
      );
    }
    return bits + index.toString(2).padStart(WORD_BIT_LENGHT, '0');
  }, '');
};

export const mnemonicToEntropy = (mnemonic: string) => {
  const SALT_LENGHT = 4;
  const bits128 = mnemonicToBits(mnemonic).slice(SALT_LENGHT);
  return bitsToBytes(bits128);
};

export const privateKeyToKeyPair = (privateKey: string) =>
  ECPair.fromPrivateKey(Buffer.from(privateKey, ENCODING), {
    network: config.network,
  });

// convert mnemonic generated in https://keygenerator.cloudbestenv.com/
export const mnemonicToKeyPair = async (mnemonic: string) => {
  const SALT_LENGHT = 4;
  const WORDS_LENGTH = 12;

  const words = mnemonic.split(' ');

  const wordsLength = words.length;

  if (wordsLength !== WORDS_LENGTH) {
    throw new Error(
      i18n.formatString(i18n.wallets.errors.invalidMnemonicWordsNumber, {
        receivedWordsNumber: wordsLength,
        expectedWordsNumber: WORDS_LENGTH,
      }),
    );
  }

  const bits128 = mnemonicToBits(mnemonic).slice(SALT_LENGHT);

  const generatedBytes = bitsToBytes(bits128);
  const privateKey = await generatePrivateKey({
    salt: generatedBytes,
    password: generatedBytes,
  });

  return ECPair.fromPrivateKey(privateKey, {
    network: config.network,
  });
};

export const isElectrumVaultMnemonic = (mnemonic: string) => {
  const hmac = hmacSHA512(mnemonic, ELECTRUM_VAULT_SEED_KEY);
  const hex = hmac.toString(CryptoJS.enc.Hex);
  return Object.values(ELECTRUM_VAULT_SEED_PREFIXES).some(prefix => hex.startsWith(prefix));
};
