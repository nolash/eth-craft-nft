const constraints = {
	audio: false,
	video: {
		width: 400, height: 400,
	}
};

const addressPrePad = "000000000000000000000000";


const video = document.createElement('video');
video.setAttribute('id', 'video');
video.setAttribute('autoplay', true);
video.setAttribute('playsinline', true);

const STATUS_OK = 0;
const STATUS_BUSY = 1;
const STATUS_INFO = 2;
const STATUS_WARN = 3;
const STATUS_ERROR = 4;

function setStatus(s, typ) {
	const em = document.getElementById('statusText');
	em.innerHTML = s;
	switch (typ) {
		case STATUS_ERROR:
			em.setAttribute('class', 'statusError');
			break;
		case STATUS_BUSY:
			em.setAttribute('class', 'statusBusy');
			break;
		case STATUS_OK:
			em.setAttribute('class', 'statusOk');
			break;
		case STATUS_INFO:
			em.setAttribute('class', 'statusInfo');
			break;
		case STATUS_WARN:
			em.setAttribute('class', 'statusWarn');
			break;
		default:
			em.setAttribute('class', 'statusBusy');
	}
}

window.addEventListener('uistate', (e) => {
	console.debug('statechange', e);
	switch (e.detail.delta) {
		case STATE.WALLET_GENERATED:
			document.getElementById("keyFile").value = e.detail.settings.keyFile;
			break;
		case STATE.WALLET_FAIL:
			const btn = document.getElementById("keyFileSubmit");
			btn.removeAttribute('disabled');
			console.debug(btn);
			break;
		case STATE.WALLET_SETTINGS:
			updateSettingsView('Wallet address', e.detail.settings.wallet.address);
			document.getElementById("start").style.display = "none";
			document.getElementById("connect").style.display = "block";
			document.getElementById("keyFileSubmit").style.display = "none";
			break;
		case STATE.CHAIN_SETTINGS:
			updateSettingsView('RPC', e.detail.settings.provider.connection.url);
			updateSettingsView('Chain ID', e.detail.settings.chainId);
			document.getElementById("connect").style.display = "none";
			document.getElementById("contract").style.display = "block";
			break;
		case STATE.CONTRACT_SETTINGS:
			updateSettingsView('NFT contract address', e.detail.settings.tokenAddress);
			updateSettingsView('NFT name', e.detail.settings.tokenName);
			updateSettingsView('NFT symbol', e.detail.settings.tokenSymbol);
			updateSettingsView('Voucher contract address', e.detail.settings.voucherAddress);
			updateSettingsView('Voucher name', e.detail.settings.voucherName);
			updateSettingsView('Voucher symbol', e.detail.settings.voucherSymbol);
			updateSettingsView('Voucher decimals', e.detail.settings.voucherDecimals);
			document.getElementById("contract").style.display = "none";
			document.getElementById("product").style.display = "block";
			document.getElementById("setup").style.display = "none";
			document.getElementById("runtime").style.display = "block";
			break;
		case STATE.MINT:
			document.getElementById("scanTokenId").innerHTML = settings.tokenId;
			document.getElementById("scanTokenBatch").innerHTML = settings.batchNumber;
			document.getElementById("scanTokenAmount").innerHTML = settings.mintAmount;
			document.getElementById("scanVoucherAmount").innerHTML = settings.voucherTransferAmount / (10 ** settings.voucherDecimals);
			document.getElementById("requestAmount").value = null;
			document.getElementById("product").style.display = "none";
			document.getElementById("read").style.display = "block";
			document.getElementById("scanConfirm").style.display = "none";
			document.getElementById("scanReturn").style.display = "none";
			document.getElementById("scanAbort").style.display = "block";
			document.getElementById("scanManualMint").style.display = "block";
			live();
			break;
		case STATE.SCAN_RESULT:
			document.getElementById('scanAddress').value = e.detail.settings.recipient;
			document.getElementById("scanManualMint").style.display = "none";
			document.getElementById("scanConfirm").style.display = "block";
			break;
		case STATE.SCAN_STOP:
			window.stream.getTracks().forEach(track => track.stop());
			break;
		case STATE.SCAN_CONFIRM:
			document.getElementById('scanAddress').value = e.detail.settings.recipient;
			document.getElementById("scanManualMint").style.display = "none";
			document.getElementById("scanConfirm").style.display = "none";
			document.getElementById("scanAbort").style.display = "none";
			document.getElementById("scanReturn").style.display = "block";
			signAndSend();
			break;
		case STATE.SCAN_DONE:
			document.getElementById("read").style.display = "none";
			document.getElementById("product").style.display = "block";
			document.getElementById("scanAddress").value = "";
			const txList = document.getElementById("txList");
			while (txList.lastChild !== null) {
				txList.removeChild(txList.lastChild);
			}
			break;
		case STATE.AIEE:
			throw 'execution terminated';
		default:
			throw 'invalid state ' + e.detail.delta;
	}
});

window.addEventListener('token', (e) => {
	const ls = document.getElementById('tokenChooser');
	const tid = e.detail.tokenId + '.' + e.detail.batch;
	let v = e.detail.nice + ' (batch ' + e.detail.batch + ')';
	if (v === null) {
		v = tid;
	}
	const input = document.createElement('input');
	input.setAttribute('id', 'tokenBatch.' + tid);
	input.setAttribute('name', 'tokenBatch');
	input.setAttribute('type', 'radio');
	input.setAttribute('value', v);
	console.log('lastchild', ls.lastChild);
	if (ls.lastChild === null) {
		input.setAttribute('checked', 'checked');
	}
	const label = document.createElement('label');
	label.setAttribute('for', 'tokenBatch.' + tid);
	label.innerHTML = v;
	ls.appendChild(input);
	ls.appendChild(label);
});

window.addEventListener('tx', (e) => {
	const ls = document.getElementById('txList');
	const li = document.createElement('li');
	const l = document.createElement('span');
	l.innerHTML = e.detail.tx;
	const r = document.createElement('span');
	r.setAttribute('id', 'status.' + e.detail.tx);
	r.setAttribute('class', 'statusBusy');
	r.innerHTML = 'status: pending';
	li.appendChild(l);
	li.appendChild(r);
	ls.appendChild(li);
	watchTx(e.detail.tx, e.detail.serial);
});

async function watchTx(hsh, i) {
	const rcpt = await settings.provider.waitForTransaction(hsh);
	const txRow = document.getElementById('status.' + hsh);
	console.debug('rcpt', rcpt);
	settings.minedAmount++;
	if (rcpt.status == 1) {
		if (i !== undefined) {
			actUpdate(i, true);
		}
		txRow.setAttribute('class', 'statusOk');
		txRow.innerHTML = 'status: confirmed';
		setStatus('transaction ' + i + ' of ' + settings.mintAmount + ' confirmed', STATUS_OK);
	} else {
		if (i !== undefined) {
			actUpdate(i, false);
		}
		txRow.setAttribute('class', 'statusError');
		txRow.innerHTML = 'status: failed';
		setStatus('transaction ' + i + ' of ' + settings.mintAmount + ' failed', STATUS_ERROR);
		settings.failedAmount++;
	}
	if (settings.failedAmount > 0) {
		setStatus('some transactions failed', STATUS_ERROR);
	}
	else {
		setStatus('token minting successully completed', STATUS_OK);
	}
}

function updateSettingsView(k, v) {
	const dl = document.getElementById("settingsView");
	const dt = document.createElement("dt");
	dt.innerHTML = k;
	dl.appendChild(dt);
	const dd = document.createElement("dd");
	dd.innerHTML = v;
	dl.appendChild(dd);
}

// Access webcam
async function initCamera() {
	console.debug('starting camera');
	try {
		const stream = await navigator.mediaDevices.getUserMedia(constraints);
		handleSuccess(stream);
	} catch (e) {
		console.error(e);
	}
}

// Success
function handleSuccess(stream) {
	//const video = document.getElementById('video');
	window.stream = stream;
	video.srcObject = stream;
}

// Draw image
var canvas;
var ctx;

// Load init
function live(handler) {
	initCamera();
	canvas = document.getElementById('qr-canvas');
	ctx = canvas.getContext('2d', { willReadFrequently: true });
	setStatus('waiting for address', STATUS_INFO);
	scan(handler);
}

async function addressHandler(addr) {
	const e = new CustomEvent('uistate', {
		detail: {
			delta: STATE.SCAN_RESULT,
			settings: settings,
		},
		bubbles: true,
		cancelable: true,
		composed: false,
	});
	window.dispatchEvent(e);
	setStatus('confirm address...', STATUS_BUSY);
}

function scanHandler(addr, handler) {
	try {
		settings.recipient = checkAddress(addr); 
	} catch(e) {
		console.error(e);
		return false;
	}
	handler(settings.recipient);
	return true;
}

function scan(handler) {
	if (handler === undefined) {
		handler = addressHandler;
	}
	ctx.drawImage(video, 0, 0, 400, 400);
	const imageData = ctx.getImageData(0, 0, 400, 400).data;
	const code = jsQR(imageData, 400, 400);
	if (code) {
		console.log("Found QR code", code);
		if (scanHandler(code.data, handler)) {
			return;
		}
	}
	setTimeout(scan, 10, handler);
}
