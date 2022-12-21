// This file contains a rought-edged example implementation of a user interface for reading and writing Craft NFT tokens.


/**
 * Emitted when a new token has been found.
 */
window.addEventListener('token', (e) => {
	const li = document.createElement('li');
	const a = document.createElement('a');
	a.setAttribute('onClick', 'uiViewToken("' + e.detail.tokenId + '")');
	li.id = 'token_' + e.detail.tokenId;
	a.textContent = e.detail.tokenId;
	li.appendChild(a);
	document.getElementById('token_list').appendChild(li);
});


/**
 * Emitted when a new batch allocation of a token has been found.
 */
window.addEventListener('tokenBatch', async (e) => {
	let currentTokenId = document.getElementById('token_id').innerHTML;
	if (currentTokenId.substring(0, 2) == '0x') {
		currentTokenId = currentTokenId.substring(2);
	}
	if (e.detail.tokenId != currentTokenId) {
		throw 'batch event without matching token ' + tokenId + ' in view';
	}

	const li = document.createElement('li');
	const span = document.createElement('span');
	li.setAttribute('id', 'token_' + e.detail.tokenId + ' _batch_' + e.detail.batch);
	span.innerHTML = 'minted ' + e.detail.cursor + ' of ' + e.detail.count + ' ';
	li.appendChild(span);

	const mintedTokenData = await window.craftnft.getMintedToken(session, e.detail.tokenId, e.detail.batch);
	console.debug('retrieved minted token data', mintedTokenData);

	if (mintedTokenData.mintable) {
		const a = document.createElement('a');
		a.setAttribute('onClick', 'uiMintToken("' + e.detail.tokenId + '", ' + e.detail.batch + ')');
		a.innerHTML = 'mint';
		li.appendChild(a);
	}
	const batchList = document.getElementById('token_batches')
	batchList.appendChild(li);
});


/**
 * Request creation of a new token allocation.
 *
 * Parameters for the allocation are read directly from the DOM.
 *
 * Interpreted parameters are emitted with the tokenRequest event.
 */
async function generateAllocation() {
	let tokenData = {
		name: undefined,
		description: undefined,
		amount: 0,
	};

	let amount = document.getElementById('panel_amount').value;
	if (amount === '') {
		amount = '0';
	}
	tokenData.amount = parseInt(amount, 10);
	if (isNaN(tokenData.amount)) {
		throw 'amount must be numeric';
	}
	tokenData.name = document.getElementById('panel_title').value;
	tokenData.description = document.getElementById('panel_description').value;
	const s = JSON.stringify(tokenData);

	const sha_raw = new jsSHA("SHA-256", "TEXT", { encoding: "UTF8" });
	sha_raw.update(s);
	const digest = sha_raw.getHash("HEX");

	if (session.contentGateway !== undefined) {
		try {
			let r = await session.contentGateway.put(s);
			if (r != digest) {
				throw 'digest mismatch (' + r + ' != ' + digest + ')';
			}
		} catch(e) {
			console.error('failed to upload token data:', e);
		}
	}
	
	const tokenRequestEvent = new CustomEvent('tokenRequest', {
		detail: {
			digest: digest,
			tokenData: tokenData,
		},
		bubbles: true,
		cancelable: true,
		composed: false,
	});
	window.dispatchEvent(tokenRequestEvent);
}


/**
 * Request minting of a new token from an existing allocation.
 *
 * Parameters for the minting are read directly from the DOM.
 *
 * Interpreted parameters are emitted with the tokenMint event.
 */
async function generateMint() {
	const tokenId = document.getElementById('token_mint_id').innerHTML;

	let batch = document.getElementById('token_mint_batch').innerHTML;
	batch = parseInt(batch, 10);

	const recipient = document.getElementById('token_mint_recipient').value;

	let index = undefined;
	if (document.getElementById('token_mint_typ').value === 'batched') {
		index = parseInt(document.getElementById('token_mint_index').value, 10);
	}

	const tokenRequestEvent = new CustomEvent('tokenMint', {
		detail: {
			recipient: recipient,
			digest: tokenId,
			batch: batch,
			index: index,
		},
		bubbles: true,
		cancelable: true,
		composed: false,
	});
	window.dispatchEvent(tokenRequestEvent);
	//uiViewToken(tokenId);
}


/**
 * Render the mint token view.
 */
async function uiMintToken(tokenId, batch) {
	document.getElementById('token_mint_id').innerHTML = tokenId;
	document.getElementById('token_mint_batch').innerHTML = batch;

	document.getElementById('interactive').style.visibility = 'hidden';
	document.getElementById('detail').style.visibility = 'hidden';
	document.getElementById('mint').style.visibility = 'visible'
}


/**
 * Render the Unique Token part of the allocated token view.
 */
async function uiViewTokenSingle(tokenId) {
	let li = document.createElement('li');
	li.setAttribute('id', 'token_' + tokenId + '_single');

	const mintedTokenData = await window.craftnft.getMintedToken(session, tokenId, 0);
	console.debug('retrieved minted single token data', mintedTokenData);

	if (!mintedTokenData.mintable) {
		console.debug('token ' + tokenId + ' is already minted');
		li.innerHTML = '(already minted)';
	} else {
		let a = document.createElement('a');
		a.setAttribute('onClick', 'uiMintToken("' + tokenId + '", ' + 0 + ')');
		a.innerHTML = 'mint';
		li.appendChild(a);
	}

	const batch = document.getElementById('token_batches');
	batch.appendChild(li);

}


/**
 * Render the allocated token view.
 */
async function uiViewToken(tokenId) {
	let tokenData = {
		name: '(unavailable)',
		description: '(unavailable)',
	};
	if (session.contentGateway !== undefined) {
		try {
			const r = await session.contentGateway.get(tokenId);
			tokenData = JSON.parse(r);
		} catch(e) {
			tokenData.name = '(failed)';
			tokenData.description = '(failed)';
			console.error('could not fetch token content:', e);
		}
	}

	const batch_shit = document.getElementById('token_batches');
	while (batch_shit.lastChild) {
		batch_shit.removeChild(batch_shit.lastChild);
	}

	const tokenChainData = await window.craftnft.getTokenChainData(session, tokenId);
	console.debug('retrieved token chain data', tokenChainData);

	document.getElementById('token_id').innerHTML = tokenId;
	document.getElementById('token_name').innerHTML = tokenData.name;
	document.getElementById('token_description').innerHTML = tokenData.description;
	document.getElementById('token_cap').innerHTML = tokenChainData.issue.cap;
	if (tokenChainData.issue.cap == 0) {
		document.getElementById('token_mint_typ').value = 'unique';
		document.getElementById('token_mint_index').value = '';
		document.getElementById('mint_index').style.visibility = 'hidden';
	} else {
		document.getElementById('token_mint_typ').value = 'batched';
		document.getElementById('mint_index').style.visibility = 'inherit';
	}

	window.craftnft.getBatches(session, tokenId, (batch, count, cursor) => {
		if (batch == -1) {
			uiViewTokenSingle(tokenId);
			return;
		}
		const e = new CustomEvent('tokenBatch', {
			detail: {
				tokenId: tokenId,
				batch: batch,
				count: count,
				cursor: cursor,
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		});
		window.dispatchEvent(e);
	});
	document.getElementById('interactive').style.visibility = 'hidden';
	document.getElementById('detail').style.visibility = 'visible';
	document.getElementById('mint').style.visibility = 'hidden';
}


/**
 * Render the create token allocation view.
 */
async function uiCreateToken() {
	document.getElementById('interactive').style.visibility = 'visible';
	document.getElementById('detail').style.visibility = 'hidden';
	document.getElementById('mint').style.visibility = 'hidden';
}


/**
 * UI entry point.
 */
async function run(w3, generated_session) {
	session = generated_session;
	console.debug('running with session', session);

	if (session.contentGatewayUrl !== undefined) {
		session.contentGateway = new Wala('http://localhost:8001');
	}
	const account = document.getElementById('data_account');
	let s = document.createElement('span');
	s.innerHTML = session.account; 
	account.append(s);

	let f = document.createElement('font');
	if (await window.craftnft.isOwner(session, session.account)) {
		f.setAttribute('color', 'green');
		f.innerHTML += ' (contract owner)';
		account.append(s);
	} else {
		f.setAttribute('color', 'red');
		f.innerHTML = ' (not contract owner!)';
	}
	account.append(f);

	document.getElementById('data_contract').innerHTML = session.contractAddress;
	document.getElementById('data_name').innerHTML = session.name;
	document.getElementById('data_symbol').innerHTML = session.symbol;
	document.getElementById('data_supply').innerHTML = session.supply;
	document.getElementById('panel_submit').addEventListener('click', () => {
		generateAllocation();
		return false;
	});
	document.getElementById('mint_submit').addEventListener('click', () => {
		generateMint();
		return false;
	});

	if (session.contentGateway !== undefined) {
		declarationUrl = session.contentGateway.url(session.declarationHash);
		let a = document.createElement('a')
		a.setAttribute('href', declarationUrl);
		a.innerHTML = declarationUrl;
		document.getElementById('data_declaration').appendChild(a);
	} else {
		document.getElementById('data_declaration').innerHTML = 'sha256:' + session.declarationHash;
	}

	window.craftnft.getTokens(w3, session, (tokenId) => {
		if (tokenId.substring(0, 2) == '0x') {
			tokenId = tokenId.substring(2);
		}
		const e = new CustomEvent('token', {
			detail: {
				tokenId: tokenId,
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		});
		window.dispatchEvent(e);
	});
}
