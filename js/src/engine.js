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
	session.supply = await session.contract.methods.totalSupply().call({from: session.account});
	console.debug('session', session);
	runner(w3, session);
}

async function refreshSession(session) {
	session.supply = await session.contract.methods.totalSupply().call({from: session.account});
	return session;
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
	if (token === undefined) {
		return false;
	}
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

async function toToken(session, tokenId, tokenContent) {
	console.log('process token content', tokenContent);
	if (tokenId.substring(0, 2) == '0x') {
		tokenId = tokenId.substring(2);
	}

	if (tokenContent.substring(0, 2) == '0x') {
		tokenContent = tokenContent.substring(2);
	}
	
	const v = parseInt(tokenContent.substring(0, 2), 16);
	console.debug('vvv', v);
	let data = {
		tokenId: tokenId,
		minted: false,
		mintedTokenId: undefined,
		owner: undefined,
		issue: undefined,
		batches: undefined,
		sparse: false,
	};

	let k = tokenId;
	let issue = undefined;

	if ((v & 0x80) == 0) {
		if ((v & 0x40) == 0) {
			issue = {};
			// TODO: the cap may be larger as we need to process for all batches, not matter whether theyre minted or not
			//const token = await session.contract.methods.token('0x' + tokenId, 0).call({from: session.account});
			const state = await getBatches(session, tokenId);
			data.batches = state.batches;
			issue.cap = state.cap;
			issue.count = state.count;
			data.issue = issue;
			return data;	
		}
	}

	data.minted = true;

	issue = {}
	if ((v & 0x40) == 0) {
		k = tokenId.substring(0, 48) + tokenContent.substring(2, 18);
		issue.batch = parseInt(tokenId.substring(48, 50), 16);
		issue.index = parseInt(tokenId.substring(50, 64), 16);

		data.cap = parseInt(token.count);
		data.count = parseInt(token.cursor);
		data.sparse = token.sparse;
	} else {
		data.batches = 0;
		issue.cap = 1;
		issue.count = 1;
		data.issue = issue;	
	}

	data.issue = issue;
	data.tokenId = k;
	data.owner = tokenContent.substring(24);

	return data;
}

async function getMintedToken(session, tokenId) {
	console.log('query for', tokenId);
	const v = await session.contract.methods.mintedToken('0x' + tokenId).call({from: session.account});
	
	const mintedToken = await toToken(session, tokenId, v);

	return mintedToken;
}

async function getBatches(session, tokenId, callback) {
	let token = await session.contract.methods.token('0x' + tokenId, 0).call({from: session.account});
	if (token.count == 0) {
		callback(-1);
		return;
	}

	if (callback !== undefined) {
		callback(0, token.count, token.cursor);
	}

	let i = 1;
	let count = parseInt(token.cursor);
	let cap = parseInt(token.count);
	while (true) {
		try {
			token = await session.contract.methods.token('0x' + tokenId, 1).call({from: session.account});
		} catch(e) {
			break;
		}
		if (callback !== undefined) {
			callback(i, token.count, token.cursor);
		}
		i++;
		count += parseInt(token.cursor);
		cap += parseInt(token.count);
	}
	return {
		batches: i,
		count: count,
		cap: cap,
	};
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
	getMintedToken: getMintedToken,
};
