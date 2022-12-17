function Wala(url) {
	this.url = url;
}

Wala.prototype.put = async function(v) {
	let r = await fetch(this.url, {
		method: 'put',
		body: v,
	});
	if (!r.ok) {
		throw ('failed put');
	}
	return r.text();
}

Wala.prototype.get = async function(k) {
	let r = await fetch(this.url + '/' + k);
	if (!r.ok) {
		throw ('failed get');
	}
	return r.text();
}
