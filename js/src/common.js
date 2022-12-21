// This file contains browser interface code that is not explicitly linked to a specific implementation.


/**
 * The session object keeps the current known state of backends and settings during user interface execution.
 *
 * These are the only global properties.
 */
var session = {
	account: undefined,
	contractAddress: undefined,
	contract: undefined,
	name: undefined,
	symbol: undefined,
	declarationHash: undefined,
	contentGatewayUrl: undefined,
	contentGateway: undefined,
	supply: 0,
};


/**
 * Entry point.
 *
 * Passes UI entry point function to be executed after successful initialization.
 */
window.addEventListener('load', async () => {
	const provider = window.craftnft.loadProvider();
	const conn = window.craftnft.loadConn(provider);
	// TODO: if provider state changes (e.g. metamask change account) we need to catch this and update the session.
	// however, none of the suggestions tried so far worked (accountsChanged on provider, update on conn.provider publicconfigstore ...
//	window.addEventListener('update', async (e) => {
//		const oldAccount = session.account;
//		const newAccount = await conn.eth.getAccounts();
//		session.account = newAccount[0];
//		console.log('account changed from ' + oldACcount + ' to ' + session.account);
//	});

	let config = undefined;
	let rs = await fetch('settings.json');
	if (rs.ok) {
		config = await rs.json();
	}

	let abi = undefined;
	let bin = undefined;
	rs = await fetch('contract/CraftNFT.json');
	if (rs.ok) {
		abi = await rs.json();
	}
	rs = await fetch('contract/CraftNFT.bin');
	if (rs.ok) {
		bin = await rs.text();
	}
	config.abi = abi
	config.bin = bin

	// run() is defined in the implementation file.
	window.craftnft.startSession(conn, config, session, run);
});


/**
 * Emitted when the user requests a token allocation with the UI.
 */
window.addEventListener('tokenRequest', async(e) => {
	window.craftnft.allocateToken(session, e.detail.digest, e.detail.tokenData.amount);
});


/**
 * Emitted when the user requests a token minting with the UI.
 */
window.addEventListener('tokenMint', async(e) => {
	window.craftnft.mintToken(session, e.detail.digest, e.detail.batch, e.detail.recipient, e.detail.index);
});
