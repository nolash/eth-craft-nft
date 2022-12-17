var session = {
	account: undefined,
	contractAddress: undefined,
	contract: undefined,
	name: undefined,
	symbol: undefined,
};


window.addEventListener('load', async () => {
	const provider = window.craftnft.loadProvider();
	const conn = window.craftnft.loadConn(provider);
	// none of the suggestions tried so far worked (accountsChanged on provider, update on conn.provider publicconfigstore ...
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

	window.craftnft.startSession(conn, config, session, run);
});

window.addEventListener('tokenRequest', async(e) => {
	window.craftnft.allocateToken(session, e.detail.digest, e.detail.tokenData.amount);
});

