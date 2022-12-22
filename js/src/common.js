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

	provider.on('accountsChanged', function(e) {
		console.debug('accountschanged', e);
	});


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

	// This is handler code for the Allocate event
	// Unfortunately, at least with openethereum 3.3.3, it does not post the log object, but the block header instead.
	let ev = conn.eth.subscribe('logs', {
		address: config.contract,
		topics: ['0xb85ba54b9f6f8241b7e1499e3cfc186ac0b1c8b7100f599bf6ca6844f896c342'], 
	}, (e, r) => {
		console.debug('results of subscribe', e, r);
	});

	provider.on('message', (m) => {
		console.debug('metamask log message for Allocate', m);
	});


	// run() is defined in the implementation file.
	window.craftnft.startSession(conn, config, session, run);
});


/**
 * Emitted when the user requests a token allocation with the UI.
 */
window.addEventListener('tokenRequest', (e) => {
	window.craftnft.allocateToken(session, e.detail.digest, e.detail.tokenData.amount);
});


/**
 * Emitted when the user requests a token minting with the UI.
 */
window.addEventListener('tokenMint', (e) => {
	window.craftnft.mintToken(session, e.detail.digest, e.detail.batch, e.detail.recipient, e.detail.index);
});
