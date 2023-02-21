var state = 0;
const STATE = {
	WALLET_SETTINGS: 1,
	CHAIN_SETTINGS: 2,
	CONTRACT_SETTINGS: 4,
	MINT: 8,
	SCAN_START: 16,
	SCAN_RESULT: 32,
	SCAN_STOP: 64,
	SCAN_CONFIRM: 128,
	SCAN_DONE: 256,
};

var settings = {
	privateKey: undefined,
	tokenAddress: undefined,
	tokenId: undefined,
	batchNumber: undefined,
	provider: undefined,
	wallet: undefined,
	chainId: undefined,
	dataPost: undefined,
	mintAmount: 1,
	minedAmount: 0,
	failedAmount: 0,
	recipient: undefined,
};

const txBase = {
	to: "0xb7cf275e96d3d0ea54aaa8f60133aa5dd3a6e3af",
	gasLimit: 200000,
	gasPrice: 1,
	data: "0xd824ee4f", // mintFromBatchTo(address,bytes32,uint16)
	value: 0,
	nonce: -1,
	chainId: 5050,
};

function checkState(stateCheck, exact) {
	masked = state & stateCheck;
	if (exact) {
		if (masked != stateCheck) {
			console.error('fail exact state', state, stateCheck);
			throw 'fail state transition check (exact)';
		}
	}
	if (masked == 0) {
		console.error('fail contains state', state, stateCheck);
		throw 'fail state transition check (partial)';
	}
}

async function signAndSend() {
	let addr = settings.recipient;
	console.info('found recipient address', addr);
	let tx = txBase;
	let nonce = await settings.wallet.getTransactionCount();
	addr = addressPrePad + addr;
	tx.data += addr;
	tx.data += settings.dataPost;

	for (let i = 0; i < settings.mintAmount; i++) {
		setStatus('signing and sending transaction ' + (i + 1) + ' of ' + settings.mintAmount + '...', STATUS_BUSY);
		let txCopy = tx;
		txCopy.nonce = nonce;
		const txSigned = await settings.wallet.signTransaction(tx);
		console.log(txSigned);
		const txr = await settings.wallet.sendTransaction(txCopy);
		setStatus('sent transaction ' + (i + 1) + ' of ' + settings.mintAmount, STATUS_OK);
		const e = new CustomEvent('tx', {
			detail: {
				settings: settings,
				tx: txr,
				mintAmount: settings.mintAmount,
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		});
		window.dispatchEvent(e);
		console.debug(txr);
		nonce++;
	}
}

async function keyFileHandler(v, passphrase) {
	setStatus('unlocking keyfile...', STATUS_BUSY);
	console.debug('wallet', settings.wallet);
	// make sure dom updates are executed before unlock
	setTimeout(() => {
		settings.wallet = ethers.Wallet.fromEncryptedJsonSync(v, passphrase);
		state |= STATE.WALLET_SETTINGS;
		const e = new CustomEvent('uistate', {
			detail: {
				delta: STATE.WALLET_SETTINGS,
				settings: settings,
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		});
		window.dispatchEvent(e);
		setStatus('keyfile unlocked', STATUS_OK);
	}, 0);
	return true;
}

async function chainHandler(rpc, chainId) {
	setStatus('connecting to network', STATUS_BUSY);
	setTimeout(async () => {
		settings.provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
		settings.wallet = settings.wallet.connect(settings.provider);
		const network = await settings.provider.getNetwork();
		console.debug('connected to network', network, settings.provider);
		if (network.chainId != chainId) {
			throw 'chainId mismatch, requested ' + chainId + ', got ' + network.chainId;
		}
		settings.chainId = chainId;
		state |= STATE.CHAIN_SETTINGS;
		const e = new CustomEvent('uistate', {
			detail: {
				delta: STATE.CHAIN_SETTINGS,
				settings: settings,
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		});
		window.dispatchEvent(e);
		setStatus('connected to network', STATUS_OK);
	}, 0);
	return true;
}

async function contractHandler(contractAddress) {
	checkState(STATE.WALLET_SETTINGS | STATE.NETWORK_SETTINGS, true);
	setStatus('scanning contract for tokens...', STATUS_BUSY);
	setTimeout(async () => {
		const contract = new ethers.Contract(contractAddress, nftAbi, settings.provider);
		let i = 0;
		let tokens = [];
		while (true) {
			try {
				const tokenId = await contract.tokens(i);
				tokens.push(tokenId);
			} catch(e) {
				break;
			}
			i++;
		}

		let c = 0;
		for (let i = 0; i < tokens.length; i++) {
			const tokenId = tokens[i];
			const uri = await contract.tokenURI(ethers.BigNumber.from(tokenId));
			let j = 0;
			while (true) {
				try {
					const batch = await contract.token(tokenId, j);
					if (batch.count == 0) {
						console.debug('skipping unique token', tokenId);
						break;
					} else if (batch.sparse) {
						console.debug('skip sparse token', tokenId);
						j++;
						continue;
					}
					const e = new CustomEvent('token', {
						detail: {
							tokenId: tokenId,
							batch: j,
						},
						bubbles: true,
						cancelable: true,
						composed: false,
					});
					window.dispatchEvent(e);
					c++;
				} catch {
					break;
				}
				j++;
			}
		}
		

		settings.tokenAddress = contractAddress;
		state |= STATE.CONTRACT_SETTINGS;
		const e = new CustomEvent('uistate', {
			detail: {
				delta: STATE.CONTRACT_SETTINGS,
				settings: settings,
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		});
		window.dispatchEvent(e);
		setStatus('found ' + c + ' available token batches in contract', STATUS_OK);
	}, 0);
	return true;
}

function requestHandler(tokenBatch, amount) {
	setStatus('scan QR code or manually enter address...', STATUS_BUSY);
	const v = tokenBatch.split('.');
	let batchNumberHex = "0000000000000000000000000000000000000000000000000000000000000000" + v[1].toString(16);
	batchNumberHex = batchNumberHex.slice(-64);
	let tokenId  = v[0].substring(2);
	settings.dataPost = tokenId + batchNumberHex;
	settings.tokenId = tokenId;
	settings.batchNumber = v[1];
	settings.mintAmount = amount;
	const e = new CustomEvent('uistate', {
		detail: {
			delta: STATE.MINT,
			settings: settings,
		},
		bubbles: true,
		cancelable: true,
		composed: false,
	});
	window.dispatchEvent(e);
}




const nftAbi = [{"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"},{"internalType":"bytes32","name":"_declaration","type":"bytes32"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_minter","type":"address"},{"indexed":true,"internalType":"uint48","name":"_count","type":"uint48"},{"indexed":false,"internalType":"bytes32","name":"_tokenId","type":"bytes32"}],"name":"Allocate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_owner","type":"address"},{"indexed":true,"internalType":"address","name":"_approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_owner","type":"address"},{"indexed":true,"internalType":"address","name":"_operator","type":"address"},{"indexed":false,"internalType":"bool","name":"_approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_minter","type":"address"},{"indexed":true,"internalType":"address","name":"_beneficiary","type":"address"},{"indexed":false,"internalType":"uint256","name":"_value","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":true,"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":true,"internalType":"uint256","name":"_tokenId","type":"uint256"},{"indexed":false,"internalType":"bytes32","name":"_data","type":"bytes32"}],"name":"TransferWithData","type":"event"},{"inputs":[{"internalType":"bytes32","name":"content","type":"bytes32"},{"internalType":"uint48","name":"count","type":"uint48"}],"name":"allocate","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"baseURL","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"declaration","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_truncatedId","type":"bytes32"}],"name":"getDigest","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_data","type":"bytes32"}],"name":"getDigestHex","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"},{"internalType":"address","name":"_operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"bytes32","name":"_content","type":"bytes32"},{"internalType":"uint16","name":"_batch","type":"uint16"},{"internalType":"uint48","name":"_index","type":"uint48"}],"name":"mintExactFromBatchTo","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"bytes32","name":"_content","type":"bytes32"},{"internalType":"uint16","name":"_batch","type":"uint16"}],"name":"mintFromBatchTo","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"bytes32","name":"_content","type":"bytes32"}],"name":"mintTo","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"mintedToken","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_operator","type":"address"},{"internalType":"bool","name":"_approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_baseString","type":"string"}],"name":"setBaseURL","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceID","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_data","type":"bytes32"}],"name":"toURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_data","type":"bytes32"}],"name":"toURL","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"token","outputs":[{"internalType":"uint48","name":"count","type":"uint48"},{"internalType":"uint48","name":"cursor","type":"uint48"},{"internalType":"bool","name":"sparse","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"tokens","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_newOwner","type":"address"},{"internalType":"bool","name":"_final","type":"bool"}],"name":"transferOwnership","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}];
