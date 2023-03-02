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
	AIEE: 512,
	WALLET_GENERATED: 1024,
	WALLET_FAIL: 2048,
};

var settings = {
	keyFile: undefined,
	privateKey: undefined,
	tokenAddress: undefined,
	tokenId: undefined,
	fungibleTokenAddress: undefined,
	batchUnitValue: 1,
	batchNumber: undefined,
	provider: undefined,
	wallet: undefined,
	chainId: undefined,
	dataPost: undefined,
	metaInterface: undefined,
	metaCanWrite: false,
	mintAmount: 1,
	minedAmount: 0,
	failedAmount: 0,
	recipient: undefined,
	tokenName: undefined,
	tokenSymbol: undefined,
	voucherName: undefined,
	voucherSymbol: undefined,
	voucherDecimals: undefined,
	voucherExpire: undefined,
	voucherTransferAmount: 0,
};

const txBase = {
	to: undefined,
	gasLimit: 200000,
	gasPrice: 1,
	data: "0xd824ee4f", // mintFromBatchTo(address,bytes32,uint16)
	value: 0,
	nonce: -1,
	chainId: 5050,
};

const txBaseERC20 = {
	to: undefined,
	gasLimit: 100000,
	gasPrice: 1,
	data: "0xa9059cbb", // transfer(address,uint256)
	value: 0,
	nonce: -1,
	chainId: 5050,
}

function checkAddress(addr) {
	if (addr.length < 40) {
		throw 'invalid ethereum address (too short): ' + addr;
	}
	if (addr.substring(0, 9) == "ethereum:") { // metamask qr
		addr = addr.substring(9);
	}
	if (addr.substring(0, 2) == "0x") {
		addr = addr.substring(2);
	}
	const re = new RegExp("^[0-9a-fA-F]{40}$");
	const m = addr.match(re);
	if (m === null) {
		throw 'invalid ethereum address (invalid hex or too long): ' + addr;
	}
	return addr;
}

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

let actSerial = 0;

function actLoad() {
	const v = localStorage.getItem("craftNftQr.act.serial");
	actSerial = parseInt(v);
	if (isNaN(actSerial)) {
		actSerial = 0;
		localStorage.setItem("craftNftQr.act.serial", actSerial);
	}
	console.log('actserial', actSerial);
}

function actRegister(address, tokenId, voucherValue) {
	const o = {
		recipient: address,
		tokenId: tokenId,
		voucherValue: voucherValue,
		serial: actSerial,
		dateCreated: Math.floor(Date.now() / 1000),
		dateUpdated: Math.floor(Date.now() / 1000),
		state: 0,
	}
	const j = JSON.stringify(o);
	localStorage.setItem("craftNftQr.act." + actSerial, j);
	const r = actSerial;
	actSerial++;
	localStorage.setItem("craftNftQr.act.serial", actSerial);
	return r;
}

function actUpdate(serial, success) {
	let j = localStorage.getItem("craftNftQr.act." + serial);
	let o = JSON.parse(j);
	if (o.state != 0) {
		console.error("update on final act state " + state + ", serial " + serial);
		return;
	}
	if (success) {
		o.state = 1;
	} else {
		o.state = -1;
	}
	o.dateUpdated = Math.floor(Date.now() / 1000);
	j = JSON.stringify(o);
	localStorage.setItem("craftNftQr.act." + serial, j);
}

async function signAndSend() {
	let serials = [];
	for (let i = 0; i < settings.mintAmount; i++) {
		const serial = actRegister(settings.recipient, settings.tokenId, settings.batchUnitValue);
		serials.push(serial);
	}

	let addr = settings.recipient;
	console.info('found recipient address', addr);
	let tx = txBase;
	tx.to = settings.tokenAddress;
	if (tx.to.substring(0, 2) != '0x') {
		tx.to = '0x' + tx.to;
	}

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
				serial: serials.shift(),
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		});
		window.dispatchEvent(e);
		console.debug(txr);
		nonce++;
	}

	const value = settings.voucherTransferAmount; 
	setStatus('signing and sending fungible token transaction of value ' + (value / (10 ** settings.voucherDecimals)) + '...', STATUS_BUSY);
	let txVoucher = txBaseERC20;
	txVoucher.to = settings.voucherAddress;
	if (txVoucher.to.substring(0, 2) != '0x') {
		txVoucher.to = '0x' + txVoucher.to;
	}
	txVoucher.nonce = nonce;
	txVoucher.data += addr;
	let valueHex = "0000000000000000000000000000000000000000000000000000000000000000" + value.toString(16);
	valueHex = valueHex.slice(-64);
	txVoucher.data += valueHex;
	const txSigned = await settings.wallet.signTransaction(txVoucher);
	console.log(txSigned);
	const txr = await settings.wallet.sendTransaction(txVoucher);
	setStatus('sent fungible transaction of value ' + value, STATUS_OK);
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

	setStatus('verifying transactions...', STATUS_BUSY);
}

function unlockWalletProgress(v) {
	setStatus("unlocking wallet: " + parseInt(v * 100) + "%", STATUS_BUSY);
}

async function keyFileHandler(v, passphrase) {
	//setStatus('unlocking keyfile...', STATUS_BUSY);
	console.debug('wallet', settings.wallet);
	// make sure dom updates are executed before unlock
	setTimeout(async () => {
		try {
			//settings.wallet = await ethers.Wallet.fromEncryptedJson(v, passphrase, unlockWalletProgress);
			settings.wallet = ethers.Wallet.fromEncryptedJsonSync(v, passphrase);
		} catch(e) {
			state |= STATE.WALLET_SETTINGS;
			const ev = new CustomEvent('uistate', {
				detail: {
					delta: STATE.WALLET_FAIL,
					settings: settings,
				},
				bubbles: true,
				cancelable: true,
				composed: false,
			});
			window.dispatchEvent(ev);
			setStatus('keyfile unlock fail. wrong passphrase?', STATUS_ERROR);
			console.error(e);
			return;
		}
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
		providerString = document.getElementById('chainRpcUrl').value;
		settings.provider = new ethers.providers.JsonRpcProvider(providerString);
		settings.wallet = settings.wallet.connect(settings.provider);
		const network = await settings.provider.getNetwork();
		console.debug('connected to network', network, settings.provider);
		if (network.chainId != chainId) {
			throw 'chainId mismatch, requested ' + chainId + ', got ' + network.chainId;
		}
		// TODO: get chainid for txbase from settings directly
		settings.chainId = parseInt(chainId);
		txBase.chainId = settings.chainId;
		txBaseERC20.chainId = settings.chainId;

		const gasPrice = await settings.provider.getGasPrice();
		txBase.gasPrice = parseInt(gasPrice);
		txBaseERC20.gasPrice = parseInt(gasPrice);

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

async function checkContractOwner(contractAddress, voucherAddress) {
	const contract = new ethers.Contract(contractAddress, nftAbi, settings.provider);
	const voucher = new ethers.Contract(voucherAddress, erc20Abi, settings.provider);
	const r = await contract.isWriter(settings.wallet.address);
	const rr = true;
	if (!(r && rr)) {
		setStatus('address ' + settings.wallet.address + ' does not have mint access to contracts. plesae start over.', STATUS_ERROR);
		const e = new CustomEvent('uistate', {
			detail: {
				delta: STATE.AIEE,
				settings: settings,
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		});
		window.dispatchEvent(e);
		return;
	}
	setStatus('scanning contract...', STATUS_BUSY);
	setTimeout(scanContract, 0, contractAddress, voucherAddress);
}

async function scanContract(contractAddress, voucherAddress) {
	const contract = new ethers.Contract(contractAddress, nftAbi, settings.provider);
	const voucher = new ethers.Contract(voucherAddress, erc20Abi, settings.provider);
	settings.tokenName = await contract.name();
	settings.tokenSymbol = await contract.symbol();
	settings.voucherName = await voucher.name();
	settings.voucherSymbol = await voucher.symbol();
	const decimals = await voucher.decimals();
	settings.voucherDecimals = decimals.toNumber();
	setStatus('scanning contract for tokens...', STATUS_BUSY);
	setTimeout(scanContractTokens, 0, contractAddress, voucherAddress);
}

async function contractHandler(contractAddress, voucherAddress) {
	checkState(STATE.WALLET_SETTINGS | STATE.NETWORK_SETTINGS, true);
	setStatus('check if wallet can mint...', STATUS_BUSY);
	setTimeout(checkContractOwner, 0, contractAddress, voucherAddress);
}

async function metaHandler(url) {
	settings.metaInterface = new Wala(url);
	try {
		settings.metaInterface.put('foo');
		settings.metaCanWrite = true;
	} catch {
		console.warn('cannot write to data URL', url);
	}
	//try {
	//	settings.metaInterface.get('');
	//} catch(e) {
	//	console.warn('cannot read from data URL', url, e);
	//	settings.metaInterace = undefined;
	//}
}

async function scanContractTokens(contractAddress, voucherAddress) {
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
	let z = 0;
	for (let i = 0; i < tokens.length; i++) {
		const tokenId = tokens[i];
		const uri = await contract.tokenURI(ethers.BigNumber.from(tokenId));
		let j = 0;
		while (true) {
			let batch = undefined;
			try {
				batch = await contract.token(tokenId, j);
			} catch(e) {
				break;
			}
			if (batch.count == 0) {
				console.debug('skipping unique token', tokenId);
				break;
			} else if (batch.sparse) {
				console.debug('skip sparse token', tokenId);
				j++;
				continue;
			}
			let nice = null;
			try {
				const tokenMeta = await fetch(uri);
				const o = await tokenMeta.json();
				console.debug('token metadata retrieved', tokenId, o);
				nice = o.name;
			} catch(e) {
				console.warn('metadata lookup fail', e);
			}
			console.debug('count cursor', (batch.count - batch.cursor), settings.batchUnitValue);
			z += (batch.count - batch.cursor)
			const e = new CustomEvent('token', {
				detail: {
					tokenId: tokenId,
					batch: j,
					nice: nice,
				},
				bubbles: true,
				cancelable: true,
				composed: false,
			});
			window.dispatchEvent(e);
			c++;
			j++;
		}
	}
	if (c == 0) {
		setStatus('no NFTs found. please fix and start over.', STATUS_ERROR);
		throw 'missing at least one available NFT';
	}
	setStatus('found ' + c + ' available token batches in contract', STATUS_OK);
	settings.tokenAddress = contractAddress;
	setStatus('check fungible token coverage...', STATUS_BUSY);
	checkVoucherBalance(voucherAddress, z)
}

async function checkVoucherBalance(addr, unitCount) {
	const voucher = new ethers.Contract(addr, erc20Abi, settings.provider);
	const balance = await voucher.balanceOf(settings.wallet.address);
	const target = unitCount * settings.batchUnitValue;
	if (balance.lt(target)) {
		console.warn('insufficient funds to cover all batch token units. need ' + target + ', have ' + balance);
		setStatus('watch out; insufficient fungible token coverage for batch token units.', STATUS_ERROR);
	} else {
		setStatus('fungible token balance ' + (balance / (10 ** settings.voucherDecimals)) , STATUS_OK);
	}

	settings.voucherAddress = addr;
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
}

async function scanTokenMetadata(tokenId) {
	if (settings.metaInterface === undefined) {
		console.debug('skip metadata lookup since interface is not available');
		return;
	}
	setStatus('scan token metadata...', STATUS_BUSY);
	if (tokenId.length < 64) {
		setStatus('invalid token id length', STATUS_ERROR);
		throw 'invalid token id length';
	} else if (tokenId.substring(0, 2) == '0x') {
		tokenId = tokenId.substring(2);
	}
	let r = undefined;
	try {
		r = await settings.metaInterface.get(tokenId);
	} catch(e) {
		setStatus('metadata lookup failed', STATUS_ERROR);
		document.getElementById('scanTokenMetaName').innerHTML = '(unavailable)';
		document.getElementById('scanTokenMetaDescription').innerHTML = '(unavailable)';
		return;
	}
	const o = JSON.parse(r);
	setStatus('found token metadata', STATUS_OK);
	console.debug('metadata token', tokenId, o);
	document.getElementById('scanTokenMetaName').innerHTML = o['name'];
	document.getElementById('scanTokenMetaDescription').innerHTML = o['description'];
}

async function manualConfirmHandler(addr) {
	try {
		settings.recipient = checkAddress(addr);
	} catch(e) {
		console.error(e);
		return;
	}
	const e = new CustomEvent('uistate', {
		detail: {
			delta: STATE.SCAN_STOP,
			settings: settings,
		},
		bubbles: true,
		cancelable: true,
		composed: false,
	});
	window.dispatchEvent(e);
	const ee = new CustomEvent('uistate', {
		detail: {
			delta: STATE.SCAN_CONFIRM,
			settings: settings,
		},
		bubbles: true,
		cancelable: true,
		composed: false,
	});
	window.dispatchEvent(ee);
}

async function requestHandler(tokenBatch, amount) {
	const v = tokenBatch.split('.');
	let batchNumberHex = "0000000000000000000000000000000000000000000000000000000000000000" + v[1].toString(16);
	batchNumberHex = batchNumberHex.slice(-64);
	let tokenId  = v[0].substring(2);
	await scanTokenMetadata(tokenId);
	setStatus('scan QR code or manually enter address...', STATUS_BUSY);
	settings.dataPost = tokenId + batchNumberHex;
	settings.tokenId = tokenId;
	settings.batchNumber = v[1];
	//settings.mintAmount = amount;
	settings.mintAmount = 1;
	//settings.voucherTransferAmount = (settings.mintAmount * settings.batchUnitValue) * (10 ** settings.voucherDecimals);
	settings.voucherTransferAmount = amount * (10 ** settings.voucherDecimals);
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

function generateWalletProgress(v) {
	setStatus('encrypting wallet for ' + settings.wallet.address + ": " + parseInt(v * 100) + "%", STATUS_BUSY);
}

async function generateWallet(passphrase) {
	setStatus('generating new wallet', STATUS_BUSY);
	const mn = await ethers.Wallet.createRandom();
	const wallet = new ethers.Wallet(mn.privateKey);
	settings.wallet = wallet;
	const keyfile = await wallet.encrypt(passphrase, {}, generateWalletProgress);
	settings.keyFile = keyfile;
	console.debug('settings now', settings);
	setStatus('generated new wallet: ' + settings.wallet.address + ". <blink>REMEMBER TO COPY AND STORE!</blink>", STATUS_OK);
	const e = new CustomEvent('uistate', {
		detail: {
			delta: STATE.WALLET_GENERATED,
			settings: settings,
		},
		bubbles: true,
		cancelable: true,
		composed: false,
	});
	window.dispatchEvent(e);
}


const nftAbi = [{"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_minter","type":"address"},{"indexed":true,"internalType":"uint48","name":"_count","type":"uint48"},{"indexed":true,"internalType":"bool","name":"_capped","type":"bool"},{"indexed":false,"internalType":"bytes32","name":"_tokenId","type":"bytes32"}],"name":"Allocate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_owner","type":"address"},{"indexed":true,"internalType":"address","name":"_approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_owner","type":"address"},{"indexed":true,"internalType":"address","name":"_operator","type":"address"},{"indexed":false,"internalType":"bool","name":"_approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_minter","type":"address"},{"indexed":true,"internalType":"address","name":"_beneficiary","type":"address"},{"indexed":false,"internalType":"uint256","name":"_value","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes","name":"_multiHash","type":"bytes"}],"name":"Msg","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":true,"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":true,"internalType":"uint256","name":"_tokenId","type":"uint256"},{"indexed":false,"internalType":"bytes32","name":"_data","type":"bytes32"}],"name":"TransferWithData","type":"event"},{"inputs":[{"internalType":"uint8","name":"_length","type":"uint8"},{"internalType":"uint64","name":"_codecId","type":"uint64"},{"internalType":"string","name":"_uriPrefix","type":"string"}],"name":"addCodec","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_writer","type":"address"}],"name":"addWriter","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"content","type":"bytes32"},{"internalType":"int48","name":"count","type":"int48"}],"name":"allocate","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"baseURL","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_writer","type":"address"}],"name":"deleteWriter","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_truncatedId","type":"bytes32"}],"name":"getDigest","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"getDigestHex","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getMsg","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"},{"internalType":"address","name":"_operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_writer","type":"address"}],"name":"isWriter","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"bytes32","name":"_content","type":"bytes32"},{"internalType":"uint16","name":"_batch","type":"uint16"},{"internalType":"uint48","name":"_index","type":"uint48"}],"name":"mintExactFromBatchTo","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"bytes32","name":"_content","type":"bytes32"},{"internalType":"uint16","name":"_batch","type":"uint16"}],"name":"mintFromBatchTo","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_recipient","type":"address"},{"internalType":"bytes32","name":"_content","type":"bytes32"}],"name":"mintTo","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"mintedToken","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"multiCodecs","outputs":[{"internalType":"uint8","name":"l","type":"uint8"},{"internalType":"uint8","name":"codecRLength","type":"uint8"},{"internalType":"uint8","name":"prefixRLength","type":"uint8"},{"internalType":"bytes16","name":"prefix","type":"bytes16"},{"internalType":"bytes8","name":"codec","type":"bytes8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_operator","type":"address"},{"internalType":"bool","name":"_approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_baseString","type":"string"}],"name":"setBaseURL","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_content","type":"bytes32"},{"internalType":"uint16","name":"_batch","type":"uint16"},{"internalType":"uint48","name":"_cap","type":"uint48"}],"name":"setCap","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes","name":"_digest","type":"bytes"}],"name":"setMsg","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_codec","type":"uint256"}],"name":"setMsgCodec","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceID","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"_digest","type":"bytes"}],"name":"toHash","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"toHex","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"bytes","name":"_digest","type":"bytes"}],"name":"toURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"toURL","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"token","outputs":[{"internalType":"uint48","name":"count","type":"uint48"},{"internalType":"uint48","name":"cursor","type":"uint48"},{"internalType":"bool","name":"sparse","type":"bool"},{"internalType":"bool","name":"capped","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"tokenByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"tokens","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}];

const erc20Abi =  [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_owner","type":"address"},{"indexed":true,"internalType":"address","name":"_spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"_value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":false,"internalType":"uint256","name":"_value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":true,"internalType":"address","name":"_spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"_value","type":"uint256"}],"name":"TransferFrom","type":"event"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"},{"internalType":"address","name":"_spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_spender","type":"address"},{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_holder","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}];

const writerAbi = [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"_writer","type":"address"}],"name":"WriterAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"_writer","type":"address"}],"name":"WriterRemoved","type":"event"},{"inputs":[{"internalType":"address","name":"_writer","type":"address"}],"name":"addWriter","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_writer","type":"address"}],"name":"deleteWriter","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_writer","type":"address"}],"name":"isWriter","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_idx","type":"uint256"}],"name":"writers","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}];

const expireAbi = [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"_timestamp","type":"uint256"}],"name":"Expired","type":"event"},{"inputs":[],"name":"applyExpiry","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"expires","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}];
