const Web3 = require('web3');
import MetaMaskSDK from '@metamask/sdk';

function loadProvider() {
	const mm = new MetaMaskSDK({injectProvider: false});
	const w3_provider = mm.getProvider();
	w3_provider.request({method: 'eth_requestAccounts'});
	return w3_provider;
}

function loadConn(provider) {
	const w3 = new Web3(provider);
	return w3;
}

function loadContract(w3, config) {
	const contract = new w3.eth.Contract(config.abi, config.contract);	
	return contract;
}

async function startSession(w3, config, session, runner) {
	const acc = await w3.eth.getAccounts();
	session.account = acc[0];
	session.contractAddress = config.contract;
	session.contract = loadContract(w3, config);
	session.name = await session.contract.methods.name().call({from: session.account});
	session.symbol = await session.contract.methods.symbol().call({from: session.account});
	console.debug('session', session);
	runner(w3, session);
}

async function getTokens(w3, session, callback) {
	let i = 0;
	while (true) {
		let token = undefined;
		try {
			token = await session.contract.methods.tokens(i).call({from: session.account});
			callback(token);
		} catch(e) {
			break;
		};
		console.debug('found token', token);
		i++;
	}
}

async function allocateToken(session, tokenId, amount) {
	session.contract.methods.allocate('0x' + tokenId, amount).send({
		from: session.account,
		value: 0,
	});
}

module.exports = {
	loadProvider: loadProvider,
	loadConn: loadConn,
	startSession: startSession,
	getTokens: getTokens,
	allocateToken: allocateToken,
};
