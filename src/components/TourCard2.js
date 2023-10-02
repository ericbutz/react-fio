import { Paper, Grid } from '@mui/material';
import { useState, useEffect } from 'react';

const { Fio } = require('@fioprotocol/fiojs');
//const { TextEncoder, TextDecoder } = require('text-encoding');
//const fetch = require('node-fetch');
//import { fetch } from "node-fetch";

async function signTransaction() {

  const httpEndpoint = 'https://fiotestnet.blockpane.com'
 
  const info = await (await fetch(httpEndpoint + '/v1/chain/get_info')).json();
  const blockInfo = await (await fetch(httpEndpoint + '/v1/chain/get_block', {body: `{"block_num_or_id": ${info.last_irreversible_block_num}}`, method: 'POST'})).json()
  const chainId = info.chain_id;
  const currentDate = new Date();
  const timePlusTen = currentDate.getTime() + 10000;
  const timeInISOString = (new Date(timePlusTen)).toISOString();
  const expiration = timeInISOString.substr(0, timeInISOString.length - 1);

  const privateKey = '5KNMbAhXGTt2Leit3z5JdqqtTbLhxWNf6ypm4r3pZQusNHHKV7a'
  const publicKey = 'FIO6TWRA6o5UNeMVwG8oGxedvhizd8UpfGbnGKaXEiPH2kUWEPiEb'
  const account = 'ifnxuprs2uxv'
  const payeeKey = 'FIO6RkzYHuxaFt7YbyAGqEFFeFCoy2PJD1tZjzymghJk2z9gH2LVY'  // FIO Public Key of the payee
  const amount = 1000000000
  const maxFee = 100000000000

  const transaction = {
    expiration,
    ref_block_num: blockInfo.block_num & 0xffff,
    ref_block_prefix: blockInfo.ref_block_prefix,
    actions: [{
      account: 'fio.token',
      name: 'trnsfiopubky',
      authorization: [{
        actor: account,
        permission: 'active',
      }],
      data: {
        payee_public_key: payeeKey,
        amount: amount,
        max_fee: maxFee,
        tpid: '',
        actor: account
      }
    }]
  };

  const abiMap = new Map()
  const tokenRawAbi = await (await fetch(httpEndpoint + '/v1/chain/get_raw_abi', {body: `{"account_name": "fio.token"}`, method: 'POST'})).json()
  abiMap.set('fio.token', tokenRawAbi)
 
  var privateKeys = [privateKey];
 
  const tx = await Fio.prepareTransaction({
    transaction,
    chainId,
    privateKeys,
    abiMap,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  });

  const pushResult = await fetch(httpEndpoint + '/v1/chain/push_transaction', {
      body: JSON.stringify(tx),
      method: 'POST',
  });
  
  //const json = await pushResult.json();

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