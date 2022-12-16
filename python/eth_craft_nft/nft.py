# standard imports
import os

# external imports
from chainlib.eth.tx import TxFormat
from eth_erc721 import ERC721
from hexathon import add_0x
from chainlib.eth.contract import ABIContractEncoder
from chainlib.eth.contract import ABIContractType
from chainlib.eth.contract import abi_decode_single
from chainlib.jsonrpc import JSONRPCRequest
from chainlib.eth.constant import ZERO_ADDRESS

# local imports
from eth_craft_nft.error import InvalidBatchError

moddir = os.path.dirname(__file__)
datadir = os.path.join(moddir, 'data')

INVALID_BATCH = (2**256)-1



class CraftNFT(ERC721):

    __abi = None
    __bytecode = None

    @staticmethod
    def abi():
        if CraftNFT.__abi == None:
            f = open(os.path.join(datadir, 'CraftNFT.json'), 'r')
            CraftNFT.__abi = json.load(f)
            f.close()
        return CraftNFT.__abi


    @staticmethod
    def bytecode():
        if CraftNFT.__bytecode == None:
            f = open(os.path.join(datadir, 'CraftNFT.bin'))
            CraftNFT.__bytecode = f.read()
            f.close()
        return CraftNFT.__bytecode


    @staticmethod
    def gas(code=None):
        return 4000000

    
    def constructor(self, sender_address, name, symbol, tx_format=TxFormat.JSONRPC):
        code = CraftNFT.bytecode()
        enc = ABIContractEncoder()
        enc.string(name)
        enc.string(symbol)
        code += enc.get()
        tx = self.template(sender_address, None, use_nonce=True)
        tx = self.set_code(tx, code)
        return self.finalize(tx, tx_format)

    
    def allocate(self, contract_address, sender_address, token_id, amount=0, tx_format=TxFormat.JSONRPC):
        enc = ABIContractEncoder()
        enc.method('allocate')
        enc.typ(ABIContractType.BYTES32)
        enc.typ(ABIContractType.UINT48)
        enc.bytes32(token_id)
        enc.uintn(amount, 48)
        data = enc.get()
        tx = self.template(sender_address, contract_address, use_nonce=True)
        tx = self.set_code(tx, data)
        tx = self.finalize(tx, tx_format)
        return tx


    def batch_of(self, contract_address, token_id, super_index, start_at=0, max_batches=0, sender_address=ZERO_ADDRESS, id_generator=None):
        j = JSONRPCRequest(id_generator)
        o = j.template()
        o['method'] = 'eth_call'
        enc = ABIContractEncoder()
        enc.method('batchOf')
        enc.typ(ABIContractType.BYTES32)
        enc.typ(ABIContractType.UINT256)
        enc.typ(ABIContractType.UINT256)
        enc.bytes32(token_id)
        enc.uint256(super_index)
        enc.uint256(start_at)
        data = add_0x(enc.get())
        tx = self.template(sender_address, contract_address)
        tx = self.set_code(tx, data)
        o['params'].append(self.normalize(tx))
        o['params'].append('latest')
        o = j.finalize(o)
        return o


    def get_token_raw(self, contract_address, token_id, sender_address=ZERO_ADDRESS, id_generator=None):
        j = JSONRPCRequest(id_generator)
        o = j.template()
        o['method'] = 'eth_call'
        enc = ABIContractEncoder()
        enc.method('mintedToken')
        enc.typ(ABIContractType.BYTES32)
        enc.bytes32(token_id)
        data = add_0x(enc.get())
        tx = self.template(sender_address, contract_address)
        tx = self.set_code(tx, data)
        o['params'].append(self.normalize(tx))
        o['params'].append('latest')
        o = j.finalize(o)
        return o


    def mint_to(self, contract_address, sender_address, token_id, batch, recipient, tx_format=TxFormat.JSONRPC):
        enc = ABIContractEncoder()
        enc.method('mintFromBatchTo')
        enc.typ(ABIContractType.BYTES32)
        enc.typ(ABIContractType.UINT256)
        enc.typ(ABIContractType.ADDRESS)
        enc.bytes32(token_id)
        enc.uint256(batch)
        enc.address(recipient)
        data = enc.get()
        tx = self.template(sender_address, contract_address, use_nonce=True)
        tx = self.set_code(tx, data)
        tx = self.finalize(tx, tx_format)
        return tx


    @classmethod
    def parse_batch_of(self, v):
        r = abi_decode_single(ABIContractType.UINT256, v)
        if r == INVALID_BATCH:
            raise InvalidBatchError()
        return r
