window.addEventListener('token', (e) => {
	const li = document.createElement('li');
	const a = document.createElement('a');
	a.setAttribute('onClick', 'viewToken("' + e.detail.tokenId + '")');
	li.id = 'token_' + e.detail.tokenId;
	a.textContent = e.detail.tokenId;
	li.appendChild(a);
	document.getElementById('token_list').appendChild(li);
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

async function viewToken(tokenId) {
	const r = await session.contentGateway.get(tokenId);
	const tokenData = JSON.parse(r);

	document.getElementById('token_id').innerHTML = tokenId;
	document.getElementById('token_name').innerHTML = tokenData.name;
	document.getElementById('token_description').innerHTML = tokenData.description;
	document.getElementById('interactive').style.visibility = 'hidden';
	document.getElementById('detail').style.visibility = 'visible';
}

async function listTokens() {
	document.getElementById('interactive').style.visibility = 'visible';
	document.getElementById('detail').style.visibility = 'hidden';
}

function run(w3, generated_session) {
	session = generated_session;
	session.contentGateway = new Wala('http://localhost:8001');
	document.getElementById('data_account').innerHTML = session.account;
	document.getElementById('data_contract').innerHTML = session.contractAddress;
	document.getElementById('panel_submit').addEventListener('click', generatePayload);
	window.craftnft.getTokens(w3, session, (tokenId) => {
		if (tokenId.substring(0, 2) == '0x') {
			tokenId = tokenId.substring(2);
		}
		const tokenEvent = new CustomEvent('token', {
			detail: {
				tokenId: tokenId,
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		});
		window.dispatchEvent(tokenEvent);
	});
}
