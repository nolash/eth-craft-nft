window.addEventListener('load', () => {
	alive();
});

async function alive() {
	console.debug('g', await window.craftnft.web3.eth.getGasPrice());
};
