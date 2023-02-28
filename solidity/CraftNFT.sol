pragma solidity >= 0.8.0;

// SPDX-License-Identifier: GPL-3.0-or-later

contract CraftNFT {
	// Defines the behavior of a single token batch.
	// 
	// count defines the amount of tokens there are in a batch. A count of 0 indicates a unique token.
	// A batched token can never have a token count of 0 in any batch.
	// 
	// cursor keeps track of how many tokens have been minted in the batch.
	//
	// If sparse is set, token indexes in mintedToken may not be in order.
        // In this case a full iteration up to count is required to discover all minted tokens.
	struct tokenSpec {
		uint48 count;
		uint48 cursor;
		bool sparse;
	}

	// The owner of the token contract.
	// Only the owner may mint tokens.
	address public owner;

	// Addresses with access to allocate and mint tokens..
	mapping ( address => bool ) writer;

	// If set, ownership of the token contract cannot change.
	bool ownerFinal;

	// Collection of all unique token keys
	bytes32[] public tokens;

	// Define each batch of a token. (A unqiue token will have a single entry only).
	mapping(bytes32 => tokenSpec[]) public token;

	// All Minted Tokens.
	// Represents both Unique Tokens and Batch Tokens.
	mapping(bytes32 => bytes32) public mintedToken;

	// Registry for the approve() method
	mapping(uint256 => address) tokenAllowance;

	// Registry for the setApprovalForAll() method
	mapping(address => address) tokenOperator;

	// ERC-721 (Metadata - optional)
	string public name;

	// ERC-721 (Metadata - optional)
	string public symbol;

	// The total Token Allocations across all tokens, regardless of whether they have been minted or not.
	uint256 supply;

	// The digest of a human-readable resource that describes the rationale and terms for all tokens created by this contract.
	bytes32 public declaration;

	// Editable base URI against which to look up token data by token id
	bytes public baseURL;

	// Balance
	mapping ( address => uint256 ) balance;

	// ERC-721
	event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);
	// ERC-721
	event Approval(address indexed _owner, address indexed _approved, uint256 indexed _tokenId);
	// ERC-721
	event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);
	// ERC-721
	event TransferWithData(address indexed _from, address indexed _to, uint256 indexed _tokenId, bytes32 _data);

	// Minter
	event Mint(address indexed _minter, address indexed _beneficiary, uint256 _value);

	// Batcher
	event Allocate(address indexed _minter, uint48 indexed _count, bytes32 _tokenId);

	// Content hashes
	// Represents a multicodec item
	struct MultiHash {
		uint8 l;
		uint8 codecRLength;
		uint8 prefixRLength;
		bytes16 prefix;
		bytes8 codec;
	}
	// All registered multicodecs
	mapping (uint256 => MultiHash) public multiCodecs;
	uint256 msgCodec;
	bytes currentMsg;


	event Msg(bytes _multiHash);

	constructor(string memory _name, string memory _symbol, bytes32 _declaration) {
		owner = msg.sender;
		declaration =_declaration;
		name = _name;
		symbol = _symbol;
		addCodec(32, 0x12, "sha256");
		setMsgCodec(0x12);
		currentMsg = new bytes(32);
	}

	// Transfer ownership of token contract to new owner.
	//
	// If _final is true, future ownership transfers will not be permitted.
	function transferOwnership(address _newOwner) public returns(bool) {
		require(msg.sender == owner);
		owner = _newOwner;
		return true;
	}

	// implements Writer
	function addWriter(address _writer) public {
		require(msg.sender == owner, 'ERR_ACCESS');
		writer[_writer] = true;
	}

	// implements Writer
	function deleteWriter(address _writer) public {
		require(msg.sender == _writer || msg.sender == owner, 'ERR_ACCESS');
		writer[_writer] = false;
	}

	// implements Writer
	function isWriter(address _writer) public view returns(bool) {
		return writer[_writer] || _writer == owner;
	}

	// Check bit that is always set on the content data when a token has been minted.
	function isActive(bytes32 _tokenContent) private pure returns(bool) {
		return uint256(_tokenContent) & 0x8000000000000000000000000000000000000000000000000000000000000000 > 0;
	}

	// Returns true if the content data belongs to a Unique Token
	function isSingle(bytes32 _tokenContent) private pure returns(bool) {
		return uint256(_tokenContent) & 0x4000000000000000000000000000000000000000000000000000000000000000 > 0;
	}

	// Reassemble unique token key from indexed token id
	function getDigest(bytes32 _truncatedId) public view returns (bytes32) {
		bytes32 digest;

		digest = mintedToken[_truncatedId];
		require(isActive(digest));

		if (isSingle(digest)) {
			return _truncatedId;
		}

		digest &= 0x00ffffffffffffffff0000000000000000000000000000000000000000000000;
		digest >>= 184;
		digest |= _truncatedId & 0xffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000;
		return digest;
	}

	// Allocate tokens for minting.
	// if count is set to 0, only a single unique token can be minted.
	function allocate(bytes32 content, uint48 count) public returns (bool) {
		uint256 l;
		require(msg.sender == owner || writer[msg.sender]);
		
		tokenSpec memory _token;

		l = token[content].length;
		if (l > 0) {
			require(token[content][0].count > 0);
		}

		_token.count = count;
		token[content].push(_token);
		tokens.push(content);

		if (count == 0) {
			supply += 1;	
		} else {
			supply += count;
		}
		emit Allocate(msg.sender, count, content);
		return true;
	}

	// Find the token batch which contains the given index.
	// Search scope can be controlled using the _startAt and _endAt properties.
//	function batchOf(bytes32 _content, uint256 _superIndex, uint256 _startAt) public view returns(int256) {
//		for (uint256 i = _startAt; i < token[_content].length; i++) {
//			if (token[_content][i].cumulativeCount > uint128(_superIndex)) {
//				return int256(i);
//			}
//		}
//		return -1;
//	}

	// Mint a unique token. The method will fail if the token was allocated as a batch.
	function mintTo(address _recipient, bytes32 _content) public returns (bytes32) {
		uint256 right;
		
		require(msg.sender == owner || writer[msg.sender]);
		require(token[_content].length == 1);
		require(token[_content][0].count == 0);
		require(mintedToken[_content] == bytes32(0x00));
		
		right = uint160(_recipient);
		right |= (3 << 254);
		mintedToken[_content] = bytes32(right);

		balance[_recipient] += 1;

		emit Mint(msg.sender, _recipient, uint256(_content));

		return _content;
	}

	// Apply the token owner to the token content data.
	function setTokenOwner(uint256 _tokenId, address _newOwner) private {
		uint256 _data;
		bytes32 _k;

		_k = bytes32(_tokenId);
	
		_data = uint256(mintedToken[_k]);
		require(_data != 0);

		_data &= 0xffffffffffffffffffffffff0000000000000000000000000000000000000000;
		_data |= uint160(_newOwner);
		mintedToken[_k] = bytes32(_data);
	}

	// Mint a token from a batch.
	// Will fail if:
	// * All tokens in the batch have already been minted
	// * One or more tokens have been minted out of sequential order (see mintExactFromBatchTo)
	//
	// If the token was allocated as a single token (which has not yet been minted),
	// this method will transparently alias to mintTo
	function mintFromBatchTo(address _recipient, bytes32 _content, uint16 _batch) public returns (bytes32) {
		tokenSpec storage spec;
	
		spec = token[_content][uint256(_batch)];

		require(!spec.sparse, 'ERR_SPARSE');
		if (_batch == 0 && spec.count == 0) {
			spec.cursor += 1;
			return mintTo(_recipient, _content);
		}
		require(msg.sender == owner || writer[msg.sender], 'ERR_ACCESS');
		require(spec.cursor < spec.count);
		return mintBatchCore(_recipient, _content, _batch, spec.cursor, spec);
	}


	// Mint a token at a specific index of a batch
	// If the index is not the next sequential index in the batch, the token will be marked as sparse.
	// Sparse tokens cannot thereafter be minted using mintFromBatchTo
	// The method will fail if the token at the specified index has already been minted, or if the index is out of bounds of the batch.
	// This method cannot be used to mint a unique token.
	function mintExactFromBatchTo(address _recipient, bytes32 _content, uint16 _batch, uint48 _index) public returns (bytes32) {
		tokenSpec storage spec;

		spec = token[_content][_batch];
		require(msg.sender == owner || writer[msg.sender], 'ERR_ACCESS');
		require(spec.count > 0);
		require(_index < spec.count);
		return mintBatchCore(_recipient, _content, _batch, _index, spec);
	}

	// Common code path for both batch mint methods.
	function mintBatchCore(address _recipient, bytes32 _content, uint16 _batch, uint48 _index, tokenSpec storage _spec) private returns (bytes32) {
		uint256 left;
		uint256 right;
		bytes32 k;
	
		left = uint256(_content) & 0xffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000;
		left |= ((_batch & 0xffffffffffffffff) << 48);
		left |= _index;	
		k = bytes32(left);
	
		require(mintedToken[k] == bytes32(0x00));
		
		if (!_spec.sparse) {
			if (_index != _spec.cursor) {
				_spec.sparse = true;
			}
		}

		right = uint256(_content) & ((1 << 64) - 1);
		right <<= 184;
		right |= (1 << 255);
		right |= uint160(_recipient);

		_spec.cursor += 1;
		mintedToken[k] = bytes32(right);

		balance[_recipient] += 1;

		emit Mint(msg.sender, _recipient, left);

		return k;
	}
	
	// ERC-721
	function balanceOf(address _owner) external view returns (uint256) {
		return balance[_owner];
	}	

	// ERC-721
	function setApprovalForAll(address _operator, bool _approved) external {
		if (_approved) {
			require(tokenOperator[msg.sender] == address(0)); // save a few bucks in gas if fail
			tokenOperator[msg.sender] = _operator;
		} else {
			require(tokenOperator[msg.sender] != address(0));
			tokenOperator[msg.sender] = address(0);
		}
		emit ApprovalForAll(msg.sender, _operator, _approved);
	}

	// ERC-721
	function getApproved(uint256 _tokenId) external view returns (address) {
		return tokenAllowance[_tokenId];
	}

	// ERC-721
	function isApprovedForAll(address _owner, address _operator) external view returns (bool) {
		return tokenOperator[_owner] == _operator;
	}

	// ERC-721
	function ownerOf(uint256 _tokenId) external view returns (address) {
		bytes32 _tokenContent;

		_tokenContent = mintedToken[bytes32(_tokenId)];
		return address(bytes20(_tokenContent << 96));
	}

	// Common code path for transfer methods
	function transferCore(address _from, address _to, uint256 _tokenId) internal {
		address currentTokenOwner;

		currentTokenOwner = this.ownerOf(_tokenId);

		require(currentTokenOwner == _from);
		if (_from != msg.sender) {
			require(tokenAllowance[_tokenId] == msg.sender || tokenOperator[currentTokenOwner] == msg.sender);
		}
		
		tokenAllowance[_tokenId] = address(0);
		setTokenOwner(_tokenId, _to);

		balance[_from] -= 1;
		balance[_to] += 1;
	}

	// ERC-721
	function transferFrom(address _from, address _to, uint256 _tokenId) external payable {
		transferCore(_from, _to, _tokenId);
		emit Transfer(_from, _to, _tokenId);
	}

	// ERC-721
	function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes memory _data) external payable {
		transferCore(_from, _to, _tokenId);
		emit Transfer(_from, _to, _tokenId);
		emit TransferWithData(_from, _to, _tokenId, bytes32(_data)); //tokenData[_tokenId][tokenData[_tokenId].length-1]);
	}

	// ERC-721
	function safeTransferFrom(address _from, address _to, uint256 _tokenId) external payable {
		transferCore(_from, _to, _tokenId);
		emit Transfer(_from, _to, _tokenId);
	}

	// Allow mutable explicit url base
	function setBaseURL(string memory _baseString) public {
		bytes memory _base;
		uint256 l;
		require(msg.sender == owner);
		
		_base = bytes(_baseString);
		l = _base.length;
		if (_base[l-1] != 0x2f) {
			l++;
		}
		baseURL = new bytes(l);
		for (uint256 i = 0; i < _base.length; i++) {
			baseURL[i] = _base[i];
		}
		if (l != _base.length) {
			baseURL[_base.length] = "/";
		}
	}

	function toURL(bytes memory _data) public view returns(string memory) {
		bytes memory out;
		bytes memory _hexDigest;
		uint256 c;

		_hexDigest = getDigestHex(_data);
	
		c = baseURL.length;
		out = new bytes(_hexDigest.length + c);

		for (uint256 i = 0; i < c; i++) {
			out[i] = baseURL[i];
		}
		for (uint256 i = 0; i < _hexDigest.length; i++) {
			out[c] = _hexDigest[i];
			c++;
		}
		return string(out);
	}

	function getDigestHex(bytes memory _data) public pure returns(bytes memory) {
		bytes memory out;
		uint8 t;
		uint256 c;

		out = new bytes(_data.length * 2);
		c = 0;
		for (uint256 i = 0; i < 32; i++) {
			t = (uint8(_data[i]) & 0xf0) >> 4;
			if (t < 10) {
				out[c] = bytes1(t + 0x30);
			} else {
				out[c] = bytes1(t + 0x57);
			}
			t = uint8(_data[i]) & 0x0f;
			if (t < 10) {
				out[c+1] = bytes1(t + 0x30);
			} else {
				out[c+1] = bytes1(t + 0x57);
			}
			c += 2;
		}
		return out;
	}

	// ERC-721 (Metadata - optional)
	function tokenURI(uint256 _tokenId) public view returns (string memory) {
		bytes32 _tokenIdBytesFixed;
		bytes memory _tokenIdBytes;
		
		_tokenIdBytesFixed = bytes32(_tokenId);
	
		// If not direct match, check if it is a batch.
		// Fail if still not found (length 0).
		if (token[_tokenIdBytesFixed].length == 0) {
			_tokenIdBytesFixed = getDigest(_tokenIdBytesFixed);
		}
		require(token[_tokenIdBytesFixed].length > 0);

		_tokenIdBytes = new bytes(32);
		for (uint256 i = 0; i < 32; i++) {
			_tokenIdBytes[i] = _tokenIdBytesFixed[i];
		}

		return toURL(_tokenIdBytes);
	}

	// EIP-165
	function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
		if (interfaceID == 0x80ac58cd) { // EIP 721
			return true;
		}
		if (interfaceID == 0x5b5e139f) { // EIP 721 (Metadata - optional)
			return true;
		}
		//if (interfaceID == 0x780e9d63) { // EIP 721 (Enumerable - optional)
		//	return true;
		//}
		if (interfaceID == 0x449a52f8) { // Minter
			return true;
		}
		if (interfaceID == 0x01ffc9a7) { // EIP 165
			return true;
		}
		return false;
	}

	// ERC-721
	function totalSupply() public view returns(uint256) {
		return supply;
	}

	// Add a multicodec that can later be set as current codec
	function addCodec(uint8 _length, uint64 _codecId, string memory _uriPrefix) public {
		bytes memory prefixBytes;

		prefixBytes = bytes(_uriPrefix);
		require(prefixBytes.length <= 16, 'ERR_PREFIX_TOO_LONG');
		MultiHash memory _hsh;
		uint8 c;

		c = 7;
		while (c >= 0) {
			uint64 mask = uint64(0xff << (c * 8));
			if ((mask & _codecId) > 0) {
				break;
			}
			c--;
		}
		_hsh.codecRLength = c + 1;
		_hsh.codec = bytes8(_codecId << ((7 - c) * 8));
		_hsh.prefixRLength = uint8(prefixBytes.length);
		_hsh.prefix = bytes16(prefixBytes);
		_hsh.l = _length;
		
		multiCodecs[uint256(_codecId)] = _hsh;
	}

	// Generate a multihash from the given digest and current selected multicodec
	function toHash(bytes memory _digest) public view returns(bytes memory) {
		MultiHash storage m;
		bytes memory r;

		m = multiCodecs[msgCodec];
		r = new bytes(_digest.length + m.l + m.codecRLength);

		uint256 i = 0;
		for (i; i < m.codecRLength; i++) {
			r[i] = m.codec[i];
		}
		r[i] = bytes1(m.l);
		i++;
		for (uint256 j = 0; j < _digest.length; j++) {
			r[i+j] = _digest[j];	
		}

		return r;
	}

	// Generate a URI representing the digest and the string prefix representation
	// of the currently selected multicodec
	function toURI(bytes memory _digest) public view returns(string memory) {
		MultiHash storage m;

		bytes memory codecString;
		bytes memory digestHex;
	        uint256 l;
	      
	       	digestHex = toHex(_digest);	
		m = multiCodecs[msgCodec];
		l = m.prefixRLength;
		codecString = new bytes(l + digestHex.length + 1);
		for (uint256 i = 0; i < l; i++) {
			codecString[i] = m.prefix[i];
		}
		codecString[l] = 0x3a;
		l++;

		for (uint256 i = 0; i < digestHex.length; i++) {
			codecString[l+i] = digestHex[i];
		}
		return string(codecString);

	}

	// TODO: move to internal library method
	// bytes to hex conversion
	function toHex(bytes memory _data) public pure returns(bytes memory) {
		bytes memory out;
		uint8 t;
		uint256 c;

		out = new bytes(_data.length * 2);
		c = 0;
		for (uint256 i = 0; i < 32; i++) {
			t = (uint8(_data[i]) & 0xf0) >> 4;
			if (t < 10) {
				out[c] = bytes1(t + 0x30);
			} else {
				out[c] = bytes1(t + 0x57);
			}
			t = uint8(_data[i]) & 0x0f;
			if (t < 10) {
				out[c+1] = bytes1(t + 0x30);
			} else {
				out[c+1] = bytes1(t + 0x57);
			}
			c += 2;
		}
		return out;
	}

	// Set the current multicodec to use for multihash generation
	function setMsgCodec(uint256 _codec) public {
		MultiHash storage _hsh;

		_hsh = multiCodecs[_codec];
		require(_hsh.l > 0);

		msgCodec = _codec;
		currentMsg = new bytes(_hsh.l);

		emit Msg(getMsg());
	}

	// Set the latest pesistent message on contract
	function setMsg(bytes memory _digest) public {
		MultiHash storage _hsh;

		_hsh = multiCodecs[msgCodec];
		require(_digest.length == _hsh.l);

		currentMsg = _digest;
		emit Msg(getMsg());
	}

	// Return a multihash of the latest persistent message
	function getMsg() public view returns(bytes memory) {
		return toHash(currentMsg);
	}
}
