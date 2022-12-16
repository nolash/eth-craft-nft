pragma solidity >= 0.8.0;


contract CraftNFT {

	struct tokenSpec {
		uint8 v;
		uint48 count;
		uint48 cursor;
	}
	address public owner;
	bytes32[] public tokens;
	mapping(bytes32 => tokenSpec[]) public token;
	mapping(bytes32 => bytes32) public mintedToken;
	mapping(uint256 => address) tokenAllowance; // backend for approve
	mapping(address => address) tokenOperator; // backend for setApprovalForAll

	// ERC-721 (Metadata - optional)
	string public name;

	// ERC-721 (Metadata - optional)
	string public symbol;


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

	function isActiveContent(bytes32 _tokenContent) public view returns(bool) {
		return uint256(_tokenContent) & 0x8000000000000000000000000000000000000000000000000000000000000000 > 0;
	}

	function getDigest(bytes32 _truncatedId) public view returns (bytes32) {
		bytes32 digest;

		digest = mintedToken[_truncatedId];
		require(isActiveContent(digest));

		digest >>= 160;
		digest |= _truncatedId & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000;
		return digest;
	}

	// allocate a batch of tokens
	function allocate(bytes32 content, uint48 count) public returns (bool) {
		require(msg.sender == owner);
		tokenSpec memory _token;

		if (token[content].length > 0) {
			require(token[content][0].count > 0);
		}

		_token.count = count;
		token[content].push(_token);
	}

	function batchOf(bytes32 _content, uint256 _superIndex, uint256 _startAt) public view returns(int256) {
		for (uint256 i = _startAt; i < token[_content].length; i++) {
			if (token[_content][i].count > uint128(_superIndex)) {
				return int256(i);
			}
		}
		return -1;
	}

	function mintTo(bytes32 _content, address _recipient) public returns (bytes32) {
		uint256 right;
		require(mintedToken[_content] == bytes32(0x00));

		right = uint160(_recipient);
		right |= (1 << 255);
		mintedToken[_content] = bytes32(right);

		return _content;
	}
	
	function setOwner(uint256 _tokenId, address _newOwner) private {
		uint256 _data;
		bytes32 _k;

		_k = bytes32(_tokenId);
	
		_data = uint256(mintedToken[_k]);
		require(_data != 0);

		_data &= 0xffffffffffffffffffffffff0000000000000000000000000000000000000000;
		_data |= uint160(_newOwner);
		mintedToken[_k] = bytes32(_data);
	}

	function mintFromBatchTo(bytes32 _content, uint256 _batch, address _recipient) public returns (bytes32) {
		uint256 left;
		uint256 right;
		tokenSpec storage spec;
	
		spec = token[_content][_batch];
		if (spec.count == 0 && spec.count == 0) {
			return mintTo(_content, _recipient);
		}
		require(spec.cursor < spec.count);

		right = uint256(_content) & ((1 << 48) - 1);
		right <<= 200;
		right |= (1 << 255);
		right |= uint160(_recipient);

		left = uint256(_content) & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000;
		left |= (_batch << 40);
		left |= spec.cursor;

		mintedToken[bytes32(left)] = bytes32(right);
		spec.cursor += 1;
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

	// shared function for transfer methods
	function transferCore(address _from, address _to, uint256 _tokenId, bytes memory _data) internal {
		address currentTokenOwner;

		currentTokenOwner = this.ownerOf(_tokenId);

		require(currentTokenOwner == _from);
		if (_from != msg.sender) {
			require(tokenAllowance[_tokenId] == msg.sender || tokenOperator[currentTokenOwner] == msg.sender);
		}
		
		tokenAllowance[_tokenId] = address(0);
		setOwner(_tokenId, _to);
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
		if (interfaceID == 0x01ffc9a7) { // EIP 165
			return true;
		}
		return false;
	}
}
