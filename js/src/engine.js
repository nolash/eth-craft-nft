const Web3 = require('web3');
import MetaMaskSDK from '@metamask/sdk';

const mm = new MetaMaskSDK({injectProvider: false});
const w3_provider = mm.getProvider();
w3_provider.request({method: 'eth_requestAccounts'});
const w3 = new Web3(w3_provider);

module.exports = {
	web3: w3,
};
