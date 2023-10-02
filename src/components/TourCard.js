import { Paper, Grid } from '@mui/material';
//import { sign } from '../fio/sign';
//import { signTransaction } from "../fio/signTransaction"
import { useState, useEffect } from 'react';
import { createInitialTypes, getTypesFromAbi, SerialBuffer } from "../fio/chain-serialize";
import { base64ToBinary, arrayToHex, convertLegacyPublicKey } from "../fio/chain-numeric"
import { JsSignatureProvider } from "../fio/chain-jssig"
//import { ecc } from "../fio/ecc/api_common"

import { Signature } from "../fio/ecc/signature"
import { Buffer } from 'buffer';
const PrivateKey = require('../fio/ecc/key_private');
const BigInteger = require('bigi');
const ecdsa = require('../fio/ecc/ecdsa');
const curve = require('ecurve').getCurveByName('secp256k1');
const hash = require('../fio/ecc/hash');
const ecc = require('../fio/ecc');

const transaction = {
    expiration: '2021-04-30T22:30:57.811',
    ref_block_num: 54473,
    ref_block_prefix: 1292004762,
    actions: [{
      account: 'fio.address',
      name: 'addaddress',
      authorization: [{
        actor: 'ifnxuprs2uxv',
        permission: 'active',
      }],
      data: {
        fio_address: 'etest6@fiotestnet',
        public_addresses: [
          {
            chain_code: 'BCH',
            token_code: 'BCH',
            public_address: 'bitcoincash:asdfasdfasdf',
          },
          {
            chain_code: 'DASH',
            token_code: 'DASH',
            public_address: 'asdfasdfasdf',
          }
        ],
        max_fee: 600000000,
        tpid: 'rewards@wallet',
        actor: 'ifnxuprs2uxv',
      },
    }]
  };

  function hexToUint8Array(hex) {
    if (typeof hex !== 'string') {
        throw new Error('Expected string containing hex digits');
    }
    if (hex.length % 2) {
        throw new Error('Odd number of hex digits');
    }
    const l = hex.length / 2;
    const result = new Uint8Array(l);
    for (let i = 0; i < l; ++i) {
        const x = parseInt(hex.substr(i * 2, 2), 16);
        if (Number.isNaN(x)) {
            throw new Error('Expected hex string');
        }
        result[i] = x;
    }
    return result;
  }
  

  function signHash(dataSha256, privateKey, encoding = 'hex') {
    if(typeof dataSha256 === 'string') {
        dataSha256 = Buffer.from(dataSha256, encoding)
    }
    if( dataSha256.length !== 32 || ! Buffer.isBuffer(dataSha256) )
        throw new Error("dataSha256: 32 byte buffer requred")

    privateKey = PrivateKey(privateKey)

    var der, e, ecsignature, i, lenR, lenS, nonce;
    i = null;
    nonce = 0;
    e = BigInteger.fromBuffer(dataSha256);
    while (true) {
      ecsignature = ecdsa.sign(curve, dataSha256, privateKey.d, nonce++);
      der = ecsignature.toDER();
      lenR = der[3];
      lenS = der[5 + lenR];
      if (lenR === 32 && lenS === 32) {
        i = ecdsa.calcPubKeyRecoveryParam(curve, e, ecsignature, privateKey.toPublic().Q);
        i += 4;  // compressed
        i += 27; // compact  //  24 or 27 :( forcing odd-y 2nd key candidate)
        break;
      }
      if (nonce % 10 === 0) {
        console.log("WARN: " + nonce + " attempts to find canonical signature");
      }
    }
    return Signature(ecsignature.r, ecsignature.s, i);
};

async function signTransaction() {

    const httpEndpoint = 'http://testnet.fioprotocol.io'
    const textDecoder = new TextDecoder();
    const textEncoder = new TextEncoder();
  
    /**
     * Serializing a transaction takes two steps:
     *  1. Serialize the data in the Actions[] field
     *  2. Serialize the entire transaction
     */
   
    // 1. Serialize the data in the Actions[] field
   
    // Retrieve the fio.address ABI
    //const abiFioAddress =  await fetch(httpEndpoint + '/v1/chain/get_info');
    const abiData = await fetch(httpEndpoint + '/v1/chain/get_abi', { body: `{"account_name": "fio.address"}`, method: 'POST' });
    const abiFioAddress = await abiData.json();
    //console.log('data: ',  data);
    const rawAbi = await (await fetch(httpEndpoint + '/v1/chain/get_raw_abi', { body: `{"account_name": "fio.address"}`, method: 'POST' })).json();
    const abi = base64ToBinary(rawAbi.abi);
    const newMap = createInitialTypes();

    const typesFioAddress =  getTypesFromAbi(newMap, abiFioAddress.abi);

    // Get the addaddress action type
    const actionAddaddress = typesFioAddress.get('addaddress');

    // Serialize the actions[] "data" field (This example assumes a single action, though transactions may hold an array of actions.)
    //const buffer = new SerialBuffer({ textEncoder, textDecoder });
    //const blah = transaction.actions[0].data;
    //const test = actionAddaddress.serialize(buffer, blah);
    //const serializedData = arrayToHex(buffer.asUint8Array())

    const buffer = new SerialBuffer({ textEncoder, textDecoder });
    actionAddaddress.serialize(buffer, transaction.actions[0].data);
    const serializedData = arrayToHex(buffer.asUint8Array())

    // Get the actions parameter from the transaction and replace the data field with the serialized data field
    let rawAction = transaction.actions[0]
    rawAction = {
        ...rawAction,
        data: serializedData
    };

    // 2. Serialize the entire transaction

  const abiMsig = await (await fetch(httpEndpoint + '/v1/chain/get_abi', { body: `{"account_name": "eosio.msig"}`, method: 'POST' })).json()

  const types33 = getTypesFromAbi(createInitialTypes(), abiMsig.abi)

  const action2 = types33.get('transaction');
  //console.log('action2: ', action2)
  //console.log('header: ', types33.get('transaction_header'))

  const rawTransaction = {
    ...transaction,  // The order of this matters! The last items put in overwrite earlier items!
    max_net_usage_words: 0,
    max_cpu_usage_ms: 0,
    delay_sec: 0,
    context_free_actions: [],
    actions: [rawAction],     //Actions have to be an array
    transaction_extensions: [],
  }

  // Serialize the transaction
  const buffer2 = new SerialBuffer({ textEncoder, textDecoder });
  action2.serialize(buffer2, rawTransaction);
  const serializedTransaction = buffer2.asUint8Array()

    //Next the serialized transaction must be signed

 
   //const signatureProvider = new JsSignatureProvider(['5KNMbAhXGTt2Leit3z5JdqqtTbLhxWNf6ypm4r3pZQusNHHKV7a']);

   const buffer3 = new SerialBuffer({ textEncoder, textDecoder });
    const requiredKeys = ['PUB_K1_6TWRA6o5UNeMVwG8oGxedvhizd8UpfGbnGKaXEiPH2kUZ2LUYm']
    const chainId = 'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e'
    const serializedContextFreeData = null;

    var buf1 = Buffer.from(chainId, 'hex')
    var buf2 = Buffer.from(serializedTransaction)
    var buf3 = Buffer.from(new Uint8Array(32))

    var arr = [buf1, buf2, buf3]
    //var signBuf = Buffer.concat(arr)

    const signBuf = Buffer.concat([
      new Buffer(chainId, 'hex'),
      new Buffer(serializedTransaction),
      new Buffer(
          serializedContextFreeData ?
              hexToUint8Array(ecc.sha256(serializedContextFreeData)) :
              new Uint8Array(32)
      ),
  ]); 

  const keys = new Map();
  const k2 = requiredKeys[0];
  //const pub = convertLegacyPublicKey(ecc.PrivateKey.fromString(k).toPublic().toString());
  const x1 = ecc.PrivateKey.fromString('5KNMbAhXGTt2Leit3z5JdqqtTbLhxWNf6ypm4r3pZQusNHHKV7a');


  for (const k of requiredKeys) {
 //     const pub = convertLegacyPublicKey(ecc.PrivateKey.fromString(k).toPublic().toString());
//      keys.set(pub, k);
  }

//  const signatures = requiredKeys.map(
//    (pub) => ecc.Signature.sign(signBuf, this.keys.get(convertLegacyPublicKey(pub))).toString(),
//  );
//const data2 = hash.sha256(signBuf)
//const blah22 = signHash(data2, '5KNMbAhXGTt2Leit3z5JdqqtTbLhxWNf6ypm4r3pZQusNHHKV7a')

  //const testss = Signature.sign()
  //const testss = Signature.sign(signBuf, '5KNMbAhXGTt2Leit3z5JdqqtTbLhxWNf6ypm4r3pZQusNHHKV7a', 'utf8').toString()
      //const test =  ecc.Signature.sign(signBuf, '5KNMbAhXGTt2Leit3z5JdqqtTbLhxWNf6ypm4r3pZQusNHHKV7a');
  
  /*   
  ecc.Signature.sign(signBuf, this.keys.get(convertLegacyPublicKey(pub))).toString(),
  
  const signedTxn = await signatureProvider.sign({
      chainId: chainId,
      requiredKeys: requiredKeys,
      serializedTransaction: serializedTransaction,
      serializedContextFreeData: serializedContextFreeData,
      abis: abi,
    });
  
  
    // Last, both the serialized transaction and the signature are sent to push_transaction
  
    const txn = {
      signatures: signedTxn.signatures,
      compression: 0,
      packed_context_free_data: arrayToHex(serializedContextFreeData || new Uint8Array(0)),
      packed_trx: arrayToHex(serializedTransaction)
    }
    */
    return "hello";
}


export const TourCard = () => {
    const [token, setToken] = useState("empty");
    useEffect(() => {
       async function getToken() {
           const token = await signTransaction();
           setToken(token);
       }
       getToken();
    }, [])

    return (
        <Grid item xs={3}>
            <Paper elevation={3} square>
                    {token}
            </Paper>
        </Grid>

    );
};

/**
 * 
 
export const TourCard = () => {
    const [token, setToken] = useState("empty");
    useEffect(() => {
       async function getToken() {
           const token = await signTransaction();
           setToken(token);
       }
       getToken();
    }, [])

    return (
        <Grid item xs={3}>
            <Paper elevation={3} square>
                    {token}
            </Paper>
        </Grid>

    );
};

 */