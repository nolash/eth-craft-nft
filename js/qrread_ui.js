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

window.addEventListener('uistate', (e) => {
	console.debug('statechange', e);
	switch (e.detail.delta) {
		case STATE.WALLET_SETTINGS:
			updateSettingsView('Wallet address', e.detail.settings.wallet.address);
			document.getElementById("start").style.display = "none";
			document.getElementById("connect").style.display = "block";
			break;
		case STATE.CHAIN_SETTINGS:
			updateSettingsView('RPC', e.detail.settings.provider.connection.url);
			updateSettingsView('Chain ID', e.detail.settings.chainId);
			document.getElementById("connect").style.display = "none";
			document.getElementById("contract").style.display = "block";
			break;
		case STATE.CONTRACT_SETTINGS:
			updateSettingsView('NFT contract address', e.detail.settings.tokenAddress);
			document.getElementById("contract").style.display = "none";
			document.getElementById("product").style.display = "block";
			break;
		case STATE.MINT:
			document.getElementById("scanTokenId").innerHTML = settings.tokenId;
			document.getElementById("scanTokenBatch").innerHTML = settings.batchNumber;
			document.getElementById("scanTokenAmount").innerHTML = settings.mintAmount;
			document.getElementById("product").style.display = "none";
			document.getElementById("read").style.display = "block";
			live();
			break;
		case STATE.SCAN_RESULT:
			document.getElementById('scanAddress').value = e.detail.settings.recipient;
			break;
		case STATE.SCAN_STOP:
			window.stream.getTracks().forEach(track => track.stop());
			break;
		case STATE.SCAN_DONE:
			document.getElementById("read").style.display = "none";
			document.getElementById("product").style.display = "block";
			break;

		default:
			throw 'invalid state ' + e.detail.delta;
	}
});

window.addEventListener('token', (e) => {
	const ls = document.getElementById('tokenChooser');
	const v = e.detail.tokenId + '.' + e.detail.batch;
	const input = document.createElement('input');
	input.setAttribute('id', 'tokenBatch');
	input.setAttribute('name', 'tokenBatch');
	input.setAttribute('type', 'radio');
	input.setAttribute('value', v);
	console.log('lastchild', ls.lastChild);
	if (ls.lastChild === null) {
		input.setAttribute('checked', 'checked');
	}
	const label = document.createElement('label');
	label.setAttribute('for', v);
	label.innerHTML = v;
	ls.appendChild(input);
	ls.appendChild(label);
});

window.addEventListener('tx', (e) => {
	const ls = document.getElementById('txList');
	const li = document.createElement('li');
	const l = document.createElement('span');
	l.innerHTML = e.detail.tx.hash;
	const r = document.createElement('span');
	r.setAttribute('id', 'status.' + e.detail.tx.hash);
	r.innerHTML = 'status: pending';
	li.appendChild(l);
	li.appendChild(r);
	ls.appendChild(li);
	watchTx(e.detail.tx);
});

async function watchTx(tx) {
	const rcpt = await settings.provider.waitForTransaction(tx.hash);
	const txRow = document.getElementById('status.' + tx.hash);
	console.debug('rcpt', rcpt);
	if (rcpt.status == 1) {
		txRow.innerHTML = 'status: confirmed';
	} else {
		txRow.innerHTML = 'status: failed';
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

var scanning = true;
var canvas;
var ctx;

// Load init

function test() {
	signAndSend("0x7F8301136a596D64f1b7E5C882FCB0FCD0623745");
}

function live() {
	initCamera();
	canvas = document.getElementById('qr-canvas');
	ctx = canvas.getContext('2d', { willReadFrequently: true });
	scan();
}

function scan() {
	ctx.drawImage(video, 0, 0, 400, 400);
	const imageData = ctx.getImageData(0, 0, 400, 400).data;
	const code = jsQR(imageData, 400, 400);
	if (code) {
		console.log("Found QR code", code);
		let addr = code.data;
		if (addr.length < 40) {
			console.error('invalid ethereum address (too short)', addr);
			return;
		}
		if (addr.substring(0, 9) == "ethereum:") { // metamask qr
			addr = addr.substring(9);
		}
		if (addr.substring(0, 2) == "0x") {
			addr = addr.substring(2);
		}
		settings.recipient = addr;
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
		signAndSend(addr);
		return;
	}
	setTimeout(scan, 10);
}

async function signAndSend(addr) {

	const re = new RegExp("^[0-9a-fA-F]{40}$");
	const m = addr.match(re);
	if (m === null) {
		console.error('invalid ethereum address (invalid hex or too long)', addr);
		return;
	}
	console.info('found recipient address', addr);
	let tx = txBase;
	let nonce = await settings.wallet.getTransactionCount();
	addr = addressPrePad + addr;
	tx.data += addr;
	tx.data += settings.dataPost;

	for (let i = 0; i < settings.mintAmount; i++) {
		let txCopy = tx;
		txCopy.nonce = nonce;
		const txSigned = await settings.wallet.signTransaction(tx);
		console.log(txSigned);
		const txr = await settings.wallet.sendTransaction(txCopy);
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
