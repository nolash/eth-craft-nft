function Wala(url) {
	this._url = url;
}

Wala.prototype.put = async function(v) {
	let r = await fetch(this._url, {
		method: 'put',
		body: v,
	});
	if (!r.ok) {
		throw ('failed put');
	}
	return r.text();
}

Wala.prototype.get = async function(k) {
	const url = this.url(k)
	let r = await fetch(url);
	if (!r.ok) {
		throw ('failed get');
	}
	return r.text();
}

Wala.prototype.url = function(k) {
	return this._url + '/' + k;	
}
