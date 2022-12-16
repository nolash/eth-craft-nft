pragma solidity >= 0.8.0;

contract CraftNFT {

	address owner;
	bytes32[] tokens;
	mapping(bytes32 => uint48[]) token;
	mapping(bytes32 => bytes32) mintedToken;
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

	constructor(string memory _name, string memory _symbol) {
		owner = msg.sender;
		name = _name;
		symbol = _symbol;
	}

	function getDigest(bytes32 _truncatedId) public view returns (bytes32) {
		bytes32 digest;

		digest = mintedToken[_truncatedId];
		require(digest & 0x8000000000000000000000000000000000000000000000000000000000000000 > 0);

		digest >>= 200;
		digest |= _truncatedId & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000;
		return digest;
	}

	// allocate a batch of tokens
	function allocate(bytes32 content, uint48 count) public returns (bool) {
		require(msg.sender == owner);
		if (token[content].length > 0) {
			require(token[content][0] > 0);
		}
		token[content].push(count);
	}

	// ERC-721
	function ownerOf(bytes32 _tokenId) external view returns (address) {
		return address(bytes20(mintedToken[_tokenId]));
	}

	function batchOf(bytes32 content, uint256 superIndex, uint256 startAt) public view returns (int256) {
		for (uint256 i = startAt; i < token[content].length; i++) {
			if (token[content][i] > uint128(superIndex)) {
				return int256(i);
			}
		}
		return -1;
	}

	function mintFromBatchTo(bytes32 content, uint256 batch, uint48 index, address recipient) public returns (bytes32) {
		bytes32 left;
		bytes32 right;

		right = content & 0x0000000000000000000000000000000000000000000000000000000000ffffff;
		right |= 0x8000000000000000000000000000000000000000000000000000000000000000; // "is defined" bit
		right <<= 200;
		right |= bytes20(recipient);

		left = content & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000;
		left |= bytes6(index);

		mintedToken[left] = right;
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
	//function ownerOf(uint256 _tokenId) external view returns (address) {
	//	return tokenOwner[_tokenId];
	//}

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
