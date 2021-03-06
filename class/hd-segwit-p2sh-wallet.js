import config from '../config';
import signer from '../models/signer';
import { AbstractHDSegwitP2SHWallet } from './abstract-hd-segwit-p2sh-wallet';

const bitcoin = require('bitcoinjs-lib');

export class HDSegwitP2SHWallet extends AbstractHDSegwitP2SHWallet {
  static type = 'HDsegwitP2SH';
  static typeReadable = 'HD P2SH';

  nodeToAddress(hdNode) {
    const { address } = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: hdNode.publicKey, network: config.network }),
      network: config.network,
    });
    return address;
  }

  /**
   *
   * @param utxos
   * @param amount Either float (BTC) or string 'MAX' (BitcoinUnit.MAX) to send all
   * @param fee
   * @param address
   * @returns {string}
   */
  createTx(utxos, amount, fee, address) {
    for (const utxo of utxos) {
      utxo.wif = this._getWifForAddress(utxo.address);
    }

    const amountPlusFee = this.calculateTotalAmount({ utxos, amount, fee });

    return signer.createHDSegwitTransaction(utxos, address, amountPlusFee, fee, this.getAddressForTransaction());
  }
}
