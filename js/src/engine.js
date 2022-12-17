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

async function mintToken(session, tokenId, batch, recipient) {
	const w3 = new Web3();
	const address = await w3.utils.toChecksumAddress(recipient);
	console.log('address', address, recipient);
	session.contract.methods.mintFromBatchTo(address, '0x' + tokenId, batch).send({
		from: session.account,
		value: 0,
	});
}

async function isMintAvailable(session, tokenId, batch) {
	let token = await session.contract.methods.token('0x' + tokenId, batch).call({from: session.account});
	if (batch == 0) {
		if (token.count == 0) {
			return token.cursor == 0;
		}
	}
	if (token.cursor < token.count) {
		return true;
	}
	return false;
}

async function getBatches(session, tokenId, callback) {
	let token = await session.contract.methods.token('0x' + tokenId, 0).call({from: session.account});
	if (token.count == 0) {
		callback(-1);
		return;
	}

	callback(0, token.count, token.cursor);
	let i = 1;
	while (true) {
		try {
			token = await session.contract.methods.token('0x' + tokenId, 1).call({from: session.account});
		} catch(e) {
			break;
		}
		callback(i, token.count, token.cursor);
		i++;
	}
}

async function isOwner(session, address) {
	let owner = await session.contract.methods.owner().call({from: session.account});

	const w3 = new Web3();
	address = await w3.utils.toChecksumAddress(address);
	owner = await w3.utils.toChecksumAddress(owner);

	return address == owner;
}

module.exports = {
	loadProvider: loadProvider,
	loadConn: loadConn,
	startSession: startSession,
	getTokens: getTokens,
	getBatches: getBatches,
	allocateToken: allocateToken,
	mintToken: mintToken,
	isMintAvailable: isMintAvailable,
	isOwner: isOwner,
};
