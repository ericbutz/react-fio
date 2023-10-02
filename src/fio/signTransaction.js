import { TextEncoder, TextDecoder } from "text-encoding";
//import { fetch } from "node-fetch";
import { base64ToBinary, arrayToHex } from "./chain-numeric"

//const ser = require("@fioprotocol/fiojs/dist/chain-serialize");
import { createInitialTypes, getTypesFromAbi, SerialBuffer } from "./chain-serialize";
import { JsSignatureProvider } from "./chain-jssig"

const httpEndpoint = 'http://testnet.fioprotocol.io'

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

export async function signTransaction() {

  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();

  /**
   * Serializing a transaction takes two steps:
   *  1. Serialize the data in the Actions[] field
   *  2. Serialize the entire transaction
   */
 
  // 1. Serialize the data in the Actions[] field
 
  // Retrieve the fio.address ABI
  const abiFioAddress = await (await fetch(httpEndpoint + '/v1/chain/get_abi', { body: `{"account_name": "fio.address"}`, method: 'POST' })).json();
  const rawAbi = await (await fetch(httpEndpoint + '/v1/chain/get_raw_abi', { body: `{"account_name": "fio.address"}`, method: 'POST' })).json();
  const abi = base64ToBinary(rawAbi.abi);

  //console.log('abi: ', abi)
  //const ser = new Serialize();
  // Get a Map of all the types from fio.address
  const typesFioAddress =  getTypesFromAbi(createInitialTypes(), abiFioAddress.abi);

  // Get the addaddress action type
  const actionAddaddress = typesFioAddress.get('addaddress');

  // Serialize the actions[] "data" field (This example assumes a single action, though transactions may hold an array of actions.)
  const buffer = new SerialBuffer({ textEncoder, textDecoder });
  actionAddaddress.serialize(buffer, transaction.actions[0].data);
  const serializedData = arrayToHex(buffer.asUint8Array())

  // Get the actions parameter from the transaction and replace the data field with the serialized data field
  let rawAction = transaction.actions[0]
  rawAction = {
    ...rawAction,
    data: serializedData
  };

  //console.log('rawAction: ', rawAction)


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

  
  const signatureProvider = new JsSignatureProvider(['5KNMbAhXGTt2Leit3z5JdqqtTbLhxWNf6ypm4r3pZQusNHHKV7a']);

  const requiredKeys = ['PUB_K1_6TWRA6o5UNeMVwG8oGxedvhizd8UpfGbnGKaXEiPH2kUZ2LUYm']
  const chainId = 'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e'
  const serializedContextFreeData = null;

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
  
//console.log(txn)
  //return txn;
  return "hello"
}
