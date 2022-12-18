window.addEventListener('token', (e) => {
	const li = document.createElement('li');
	const a = document.createElement('a');
	a.setAttribute('onClick', 'uiViewToken("' + e.detail.tokenId + '")');
	li.id = 'token_' + e.detail.tokenId;
	a.textContent = e.detail.tokenId;
	li.appendChild(a);
	document.getElementById('token_list').appendChild(li);
});


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
	span.innerHTML = 'used ' + e.detail.cursor + ' of ' + e.detail.count + ' ';
	li.appendChild(span);

	const mintedTokenData = await window.craftnft.getMintedToken(session, e.detail.tokenId, e.detail.batch);
	console.debug('retrieved minted token data', mintedTokenData);

	//const isMintable = await window.craftnft.isMintAvailable(session, e.detail.tokenId, e.detail.batch);
	if (mintedTokenData.mintable) {
		const a = document.createElement('a');
		a.setAttribute('onClick', 'uiMintToken("' + e.detail.tokenId + '", ' + e.detail.batch + ')');
		a.innerHTML = 'mint';
		li.appendChild(a);
	}
	const batchList = document.getElementById('token_batches')
	batchList.appendChild(li);
});


async function generatePayload() {
	let tokenData = {
		name: undefined,
		description: undefined,
		amount: 0,
		parent_nft: undefined,
	};

	const amount = document.getElementById('panel_amount').value;
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

	let r = await session.contentGateway.put(s);
	if (r != digest) {
		throw 'digest mismatch (' + r + ' != ' + digest + ')';
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


async function generateMint() {
	const tokenId = document.getElementById('token_mint_id').innerHTML;
	let batch = document.getElementById('token_mint_batch').innerHTML;
	batch = parseInt(batch, 10);
	const recipient = document.getElementById('token_mint_recipient').value;
	window.craftnft.mintToken(session, tokenId, batch, recipient);
	uiViewToken(tokenId);
}


async function uiMintToken(tokenId, batch) {
	document.getElementById('token_mint_id').innerHTML = tokenId;
	document.getElementById('token_mint_batch').innerHTML = batch;

	document.getElementById('interactive').style.visibility = 'hidden';
	document.getElementById('detail').style.visibility = 'hidden';
	document.getElementById('mint').style.visibility = 'visible'
}


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


async function uiViewToken(tokenId) {
	const r = await session.contentGateway.get(tokenId);
	const tokenData = JSON.parse(r);


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


async function uiCreateToken() {
	document.getElementById('interactive').style.visibility = 'visible';
	document.getElementById('detail').style.visibility = 'hidden';
	document.getElementById('mint').style.visibility = 'hidden';
}


async function run(w3, generated_session) {
	session = generated_session;
	session.contentGateway = new Wala('http://localhost:8001');
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
	document.getElementById('panel_submit').addEventListener('click', generatePayload);
	document.getElementById('mint_submit').addEventListener('click', generateMint);
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
