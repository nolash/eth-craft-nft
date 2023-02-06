function Wala(url) {
	this._url = url;
}

Wala.prototype.put = async function(v, filename, mimetype) {
	let headers = {};
	if (filename !== undefined) {
		headers['X-Filename'] = filename;
	}
	let r = await fetch(this._url, {
		method: 'put',
		headers: headers,
		body: v,
	});
	if (!r.ok) {
		throw ('failed put');
	}
	return r.text();
}

Wala.prototype.get = async function(k, binary=false) {
	const url = this.url(k)
	let r = await fetch(url);
	if (!r.ok) {
		throw ('failed get');
	}
	if (binary) {
		return r.blob();
	}
	return r.text();
}

Wala.prototype.url = function(k) {
	return this._url + '/' + k;	
}
