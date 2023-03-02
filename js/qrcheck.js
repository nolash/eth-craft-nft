ZEROADDR = '0x0000000000000000000000000000000000000000000000000000000000000000';

function registerScan(address) {
	let r = localStorage.getItem('holderAddressScanned');
	if (r === null) {
		r = 0;
	}
	r++;
	localStorage.setItem('holderAddressScanned', r);
	return r.toString();

}

async function handleScan(holderAddress) {
	document.getElementById('scan').style.display = 'none';
	document.getElementById('result').style.display = 'block';

	setStatus('connecting to network', STATUS_BUSY);
	providerString = document.getElementById('chainRpcUrl').value;
	settings.provider = new ethers.providers.JsonRpcProvider(providerString);
	settings.tokenAddress = document.getElementById('contractAddress').value;
	const network = await settings.provider.getNetwork();
	console.debug('connected to network', network, settings.provider);
	console.debug('handling scan', network, settings.provider, settings.tokenAddress, holderAddress);

	setStatus('check NFT balance', STATUS_BUSY);
	const contract = new ethers.Contract(settings.tokenAddress, nftAbi, settings.provider);
	let r = await contract.balanceOf(holderAddress);

	const balance = r.toNumber();
	let scans = '(not registered)';
	if (balance > 0) {
		scans = registerScan(holderAddress);
		if (scans > 1) {
			setStatus('address holds NFT (scanned ' + scans + ' times)', STATUS_WARN);
		} else {
			setStatus('address holds NFT', STATUS_OK);
		}
	} else {
		setStatus('address ' + holderAddress + ' not holder', STATUS_WARN);
	}
	document.getElementById('resultHolderAddress').innerHTML = holderAddress;
	document.getElementById('resultBalance').innerHTML = balance;
	document.getElementById('resultHolderAddressTimes').innerHTML = scans;
}

function manualLookup() {
	const holderAddress = document.getElementById('holderAddress').value;
	try {
		scanHandler(holderAddress, handleScan);
	} catch(e) {
		console.error(e);
	}
}

function resetScan() {
	document.getElementById('holderAddress').value = null;
	document.getElementById('result').style.display = 'none';
	document.getElementById('scan').style.display = 'block';
	document.getElementById('resultHolderAddress').innerHTML = '';
	document.getElementById('resultBalance').innerHTML = '';
	live(handleScan);
}
