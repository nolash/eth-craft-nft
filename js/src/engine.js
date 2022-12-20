const Web3 = require('web3');
import MetaMaskSDK from '@metamask/sdk';

/**
 * Loads a chosen provider for the w3 inteface. Currently hard-coded to Metamask.
 *
 * @return {Object} Provider
 */
function loadProvider() {
	const mm = new MetaMaskSDK({injectProvider: false});
	const w3_provider = mm.getProvider();
	w3_provider.request({method: 'eth_requestAccounts'});
	return w3_provider;
}

/**
 * Returns a new web3 client instance.
 *
 * @return {Object} client
 */
function loadConn(provider) {
	const w3 = new Web3(provider);
	return w3;
}

/**
 * Instantiates the token smart contract using the web3 client instance.
 *
 * @param {Object} client
 * @param {Object} config
 */
function loadContract(w3, config) {
	const contract = new w3.eth.Contract(config.abi, config.contract);	
	return contract;
}


/**
 * Initialize the session object using config and client.
 *
 * Calls runner with client and session when initialization has been completed.
 *
 * @param {Object} client
 * @param {Object} config
 * @param {Object} session
 * @param {Function} runner
 * @throws free-form If contract cannot be loaded, or contract interface does not meet expectations.
 */
async function startSession(w3, config, session, runner) {
	const acc = await w3.eth.getAccounts();
	session.account = acc[0];
	session.contractAddress = config.contract;
	session.contentGatewayUrl = config.contentGatewayUrl;
	session.contract = loadContract(w3, config);
	session.name = await session.contract.methods.name().call({from: session.account});
	session.symbol = await session.contract.methods.symbol().call({from: session.account});
	session.supply = await session.contract.methods.totalSupply().call({from: session.account});
	session.declarationHash = await session.contract.methods.declaration().call({from: session.account});
	if (session.declarationHash.substring(0,2) == '0x') {
		session.declarationHash = session.declarationHash.substring(2);
	}
	runner(w3, session);
}


/**
 * Reload session with current states.
 *
 * @param {Object} session
 * @return {Object} session (refreshed)
 */
async function refreshSession(session) {
	session.supply = await session.contract.methods.totalSupply().call({from: session.account});
	return session;
}


/**
 * Visits callback with token spec as argument for every allocated token.
 *
 * @param {Object} client
 * @param {Object} session
 * @param {Function} callback
 * @throws free-form If token does not exist
 */
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
		i++;
	}
}


/**
 * Create a new token allocation. Refer to the smart contract function allocate() for further details.
 *
 * @param {Object} session
 * @param {String} tokenId (hex)
 * @param {Number} amount
 * @throws free-form If transaction is refused by the client
 */
async function allocateToken(session, tokenId, amount) {
	session.contract.methods.allocate('0x' + tokenId, amount).send({
		from: session.account,
		value: 0,
	});
}


/**
 * Mint a new token from an existing allocation. Refer to the smart contract function mintFromBatchTo() for further details.
 *
 * @param {Object} session
 * @param {String} tokenId (hex)
 * @param {Number} batch
 * @param {String} recipient of token mint
 * @throws free-form If transaction is refused by the client
 */
async function mintToken(session, tokenId, batch, recipient) {
	const w3 = new Web3();
	const address = await w3.utils.toChecksumAddress(recipient);
	session.contract.methods.mintFromBatchTo(address, '0x' + tokenId, batch).send({
		from: session.account,
		value: 0,
	});
}


/**
 * Assemble and return data describing a single minted token.
 *
 * @param {Object} session
 * @psram {String} tokenId (hex)
 * @param {Number} batch
 * @return {Object} 
 * @throws free-form if token does not exist
 */
async function getMintedToken(session, tokenId, batch) {
	let o = {
		mintable: false,
		single: false,
		cap: 0,
		count: 0,
		sparse: false,
	}
	let token = await session.contract.methods.token('0x' + tokenId, batch).call({from: session.account});
	if (token === undefined) {
		return o;
	}
	if (batch == 0) {
		if (token.count == 0) {
			o.cap = 1;
			o.count = parseInt(token.cursor);
			if (token.cursor == 0) {
				o.mintable = true;
			}
			o.single = true;
			return o;
		}
	}
	o.sparse = token.sparse;
	o.cap = parseInt(token.count);
	o.count = parseInt(token.cursor);
	if (o.count < o.cap) {
		o.mintable = true;
	}
	return o;
}


/**
 * Generate a Token Id from a resolved Token Key.
 *
 * In the case of a Unique Token, this will be the same string.
 *
 * In case of a Batched Token, this will replace the batch and index embedded in the key with the remainder of the Token Id hash.
 *
 * @param {Object} session
 * @param {String} tokenId (hex)
 * @param {String} tokenContent (hex)
 * @throws free-form If token does not exist
 * @todo Function is a bit long, could be shortened.
 */
async function toToken(session, tokenId, tokenContent) {
	if (tokenId.substring(0, 2) == '0x') {
		tokenId = tokenId.substring(2);
	}

	if (tokenContent.substring(0, 2) == '0x') {
		tokenContent = tokenContent.substring(2);
	}
	
	let data = {
		tokenId: tokenId,
		minted: false,
		mintedTokenId: undefined,
		owner: undefined,
		issue: undefined,
		batches: undefined,
		sparse: false,
	};

	let issue = undefined;

	// check whether it is an active minted token, and whether it's unique of batched.
	// if not active we stop processing here.
	const v = parseInt(tokenContent.substring(0, 2), 16);
	if ((v & 0x80) == 0) {
		// execute this only if token is batched.
		if ((v & 0x40) == 0) {
			issue = {};
			const state = await getBatches(session, tokenId);
			data.batches = state.batches;
			issue.cap = state.cap;
			issue.count = state.count;
			data.issue = issue;
		}
		return data;	
	} 

	data.minted = true;

	// Fill in stats as applicable to whether Unique or Batched.
	let k = tokenId;
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


/**
 * Retrieve current state of data for minted token.
 *
 * @param {Object} session
 * @param {String} tokenId
 * @return {Object} token
 */
async function getTokenChainData(session, tokenId) {
	const v = await session.contract.methods.mintedToken('0x' + tokenId).call({from: session.account});
	
	const mintedToken = await toToken(session, tokenId, v);

	return mintedToken;
}


/**
 * Visit callback with token spec of every allocated token.
 *
 * @param {Object} session
 * @param {String} tokenId (hex)
 * @param {Function} callback
 * @return {Object} summary of iteration.
 */
async function getBatches(session, tokenId, callback) {
	let token = await session.contract.methods.token('0x' + tokenId, 0).call({from: session.account});
	if (token.count == 0 && callback !== undefined) {
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
			token = await session.contract.methods.token('0x' + tokenId, i).call({from: session.account});
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


/**
 * Check if the given address is the owner of the smart contract.
 *
 * Only the owner may allocate and mint tokens.
 *
 * @param {Object} session
 * @param {String} address (hex)
 * @return {Boolean} true if owner
 */
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
	isOwner: isOwner,
	getTokenChainData: getTokenChainData,
	getMintedToken: getMintedToken,
};
