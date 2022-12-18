pragma solidity >= 0.8.0;


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
		uint48 cumulativeCount;
		uint48 cursor;
		bool sparse;
	}
	address public owner;

	// Collection of all unique token keys
	bytes32[] public tokens;

	// Define each batch of a token. (A unqiue token will have a single entry only).
	mapping(bytes32 => tokenSpec[]) public token;

	// Individual tokens from batches. A unique token is also represented by the same content.
	mapping(bytes32 => bytes32) public mintedToken;

	// Registry for the approve() method
	mapping(uint256 => address) tokenAllowance;

	// Registry for the setApprovalForAll() method
	mapping(address => address) tokenOperator;

	// ERC-721 (Metadata - optional)
	string public name;

	// ERC-721 (Metadata - optional)
	string public symbol;

	uint256 supply;

	// ERC-721
	event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);
	// ERC-721
	event Approval(address indexed _owner, address indexed _approved, uint256 indexed _tokenId);
	// ERC-721
	event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);
	// ERC-721
	event TransferWithData(address indexed _from, address indexed _to, uint256 indexed _tokenId, bytes32 _data);

	constructor(string memory _name, string memory _symbol) {
		owner = msg.sender;
		name = _name;
		symbol = _symbol;
	}

	// Check bit that is always set on the content data when a token has been minted
	function isActive(bytes32 _tokenContent) private view returns(bool) {
		return uint256(_tokenContent) & 0x8000000000000000000000000000000000000000000000000000000000000000 > 0;
	}

	// Returns true if the content data belongs to a unique token
	function isSingle(bytes32 _tokenContent) private view returns(bool) {
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

		digest &= 0x00ffffffffff0000000000000000000000000000000000000000000000000000;
		digest >>= 208;
		digest |= _truncatedId & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000;
		return digest;
	}

	// Allocate tokens for minting.
	// if count is set to 0, only a single unique token can be minted.
	function allocate(bytes32 content, uint48 count) public returns (bool) {
		uint256 l;
		uint48 _cumulativeCount;
		require(msg.sender == owner);
		
		tokenSpec memory _token;

		l = token[content].length;
		if (l > 0) {
			require(token[content][0].count > 0);
			_cumulativeCount = token[content][l-1].cumulativeCount;
		}

		_token.count = count;
		_token.cumulativeCount = _cumulativeCount + count;
		token[content].push(_token);
		tokens.push(content);

		if (count == 0) {
			supply += 1;	
		} else {
			supply += count;
		}
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
		uint256 first;
		
		require(msg.sender == owner);
		require(token[_content].length == 1);
		require(token[_content][0].count == 0);
		require(mintedToken[_content] == bytes32(0x00));
		
		right = uint160(_recipient);
		right |= (3 << 254);
		mintedToken[_content] = bytes32(right);

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
	function mintFromBatchTo(address _recipient, bytes32 _content, uint256 _batch) public returns (bytes32) {
		tokenSpec storage spec;
	
		spec = token[_content][_batch];

		require(!spec.sparse);
		if (_batch == 0 && spec.count == 0) {
			spec.cursor += 1;
			return mintTo(_recipient, _content);
		}
		require(msg.sender == owner);
		require(spec.cursor < spec.count);
		return mintBatchCore(_recipient, _content, _batch, spec.cursor, spec);
	}


	// Mint a token at a specific index of a batch
	// If the index is not the next sequential index in the batch, the token will be marked as sparse.
	// Sparse tokens cannot thereafter be minted using mintFromBatchTo
	// The method will fail if the token at the specified index has already been minted, or if the index is out of bounds of the batch.
	// This method cannot be used to mint a unique token.
	function mintExactFromBatchTo(address _recipient, bytes32 _content, uint256 _batch, uint48 _index) public returns (bytes32) {
		tokenSpec storage spec;

		spec = token[_content][_batch];
		require(msg.sender == owner);
		require(spec.count > 0);
		require(_index < spec.count);
		return mintBatchCore(_recipient, _content, _batch, _index, spec);
	}

	// Common code path for both batch mint methods.
	function mintBatchCore(address _recipient, bytes32 _content, uint256 _batch, uint48 _index, tokenSpec storage _spec) private returns (bytes32) {
		uint256 left;
		uint256 right;
		bytes32 k;
	
		left = uint256(_content) & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000;
		left |= (_batch << 20);
		left |= _index;	
		k = bytes32(left);
	
		require(mintedToken[k] == bytes32(0x00));
		
		if (!_spec.sparse) {
			if (_index != _spec.cursor) {
				_spec.sparse = true;
			}
		}

		right = uint256(_content) & ((1 << 40) - 1);
		right <<= 208;
		right |= (1 << 255);
		right |= uint160(_recipient);

		_spec.cursor += 1;
		mintedToken[k] = bytes32(right);

		return k;
	}
	
	// ERC-721
	function balanceOf(address _owner) external view returns (uint256) {
		return 0;
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
	function transferCore(address _from, address _to, uint256 _tokenId, bytes memory _data) internal {
		address currentTokenOwner;

		currentTokenOwner = this.ownerOf(_tokenId);

		require(currentTokenOwner == _from);
		if (_from != msg.sender) {
			require(tokenAllowance[_tokenId] == msg.sender || tokenOperator[currentTokenOwner] == msg.sender);
		}
		
		tokenAllowance[_tokenId] = address(0);
		setTokenOwner(_tokenId, _to);
	}

	// ERC-721
	function transferFrom(address _from, address _to, uint256 _tokenId) external payable {
		bytes memory _data;

		transferCore(_from, _to, _tokenId, _data);
		emit Transfer(_from, _to, _tokenId);
	}

	// ERC-721
	function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes memory _data) external payable {
		transferCore(_from, _to, _tokenId, _data);
		emit Transfer(_from, _to, _tokenId);
		emit TransferWithData(_from, _to, _tokenId, bytes32(0x00)); //tokenData[_tokenId][tokenData[_tokenId].length-1]);
	}

	// ERC-721
	function safeTransferFrom(address _from, address _to, uint256 _tokenId) external payable {
		bytes memory _data;

		transferCore(_from, _to, _tokenId, _data);
		emit Transfer(_from, _to, _tokenId);
	}

	// create sha256 scheme URI from tokenId
	function toURI(bytes32 _data) public pure returns(string memory) {
		bytes memory out;
		uint8 t;
		uint256 c;

		out = new bytes(64 + 7);
		out[0] = "s";
		out[1] = "h";
		out[2] = "a";
		out[3] = "2";
		out[4] = "5";
		out[5] = "6";
		out[6] = ":";
		
		c = 7;	
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
		return string(out);
	}

	// ERC-721 (Metadata - optional)
	function tokenURI(uint256 _tokenId) public view returns (string memory) {
		bytes32 digest;

		digest = this.getDigest(bytes32(_tokenId));

		return toURI(digest);
	}


	// EIP-165
	function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
		if (interfaceID == 0x80ac58cd) { // EIP 721
			return true;
		}
		if (interfaceID == 0x5b5e139f) { // EIP 721 (Metadata - optional)
			return true;
		}
		if (interfaceID == 0x780e9d63) { // EIP 721 (Enumerable - optional)
			return true;
		}
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
}
