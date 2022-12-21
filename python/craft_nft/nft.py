# standard imports
import os
import logging

# external imports
from chainlib.eth.tx import TxFormat
from eth_erc721 import ERC721
from hexathon import add_0x
from hexathon import strip_0x
from chainlib.eth.contract import ABIContractEncoder
from chainlib.eth.contract import ABIContractDecoder
from chainlib.eth.contract import abi_decode_single
from chainlib.jsonrpc import JSONRPCRequest
from chainlib.eth.constant import ZERO_ADDRESS
from chainlib.eth.constant import ZERO_CONTENT
from chainlib.eth.address import to_checksum_address

# local imports
from .error import InvalidBatchError
from .eth import ABIContractType

moddir = os.path.dirname(__file__)
datadir = os.path.join(moddir, 'data')

INVALID_BATCH = (2**256)-1

logg = logging.getLogger(__name__)


def to_batch_key(token_id, batch, index):
        token_id = strip_0x(token_id)
        if len(token_id) != 64:
            raise ValueError('token id must be 32 bytes')
        token_id = token_id[:48]
        token_id += batch.to_bytes(2, byteorder='big').hex()
        token_id += index.to_bytes(6, byteorder='big').hex()
        return token_id


class TokenSpec:

    def __init__(self, count, cursor, sparse):
        self.count = count
        self.cursor = cursor
        self.sparse = sparse


    def __str__(self):
        return '{} / {}'.format(self.cursor, self.count)


class MintedToken:

    def __init__(self, owner_address=ZERO_ADDRESS, token_id=None, batched=False, minted=False):
        self.minted = minted
        self.batched = batched
        self.owner = owner_address
        self.index = 0
        self.batch = 0
        self.token_id = token_id


    def __str__(self):
        owner = to_checksum_address(self.owner)
        if self.batched:
            return '{} owned by {}'.format(
                    self.token_id,
                    owner,
                    )
        token_key = to_batch_key(self.token_id, self.batch, self.index)
        return '{} owned by {} - (id {} batch {} index {})'.format(
                token_key,
                owner,
                self.token_id,
                self.batch,
                self.index,
                )


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

    
    def constructor(self, sender_address, name, symbol, declaration=None, tx_format=TxFormat.JSONRPC):
        if declaration == None:
            declaration = strip_0x(ZERO_CONTENT)
        code = CraftNFT.bytecode()
        enc = ABIContractEncoder()
        enc.string(name)
        enc.string(symbol)
        enc.bytes32(declaration)
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


    def token_at(self, contract_address, idx, sender_address=ZERO_ADDRESS, id_generator=None):
        j = JSONRPCRequest(id_generator)
        o = j.template()
        o['method'] = 'eth_call'
        enc = ABIContractEncoder()
        enc.method('tokens')
        enc.typ(ABIContractType.UINT256)
        enc.uint256(idx)
        data = add_0x(enc.get())
        tx = self.template(sender_address, contract_address)
        tx = self.set_code(tx, data)
        o['params'].append(self.normalize(tx))
        o['params'].append('latest')
        o = j.finalize(o)
        return o

    
    def batch_of(self, conn, contract_address, token_id, super_index, sender_address=ZERO_ADDRESS, id_generator=None):
        i = 0
        c = 0

        while True:
            o = self.get_token_spec(contract_address, token_id, i, sender_address=sender_address)
            try:
                r = conn.do(o)
            except:
                break
            spec = self.parse_token_spec(r)
            c += spec.count
            if super_index < c:
                return i
            i += 1

        raise ValueError(super_index)


    
    def get_token_spec(self, contract_address, token_id, batch, sender_address=ZERO_ADDRESS, id_generator=None):
        j = JSONRPCRequest(id_generator)
        o = j.template()
        o['method'] = 'eth_call'
        enc = ABIContractEncoder()
        enc.method('token')
        enc.typ(ABIContractType.BYTES32)
        enc.typ(ABIContractType.UINT256)
        enc.bytes32(token_id)
        enc.uint256(batch)
        data = add_0x(enc.get())
        tx = self.template(sender_address, contract_address)
        tx = self.set_code(tx, data)
        o['params'].append(self.normalize(tx))
        o['params'].append('latest')
        o = j.finalize(o)
        return o


    def get_token(self, contract_address, token_id, sender_address=ZERO_ADDRESS, id_generator=None):
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


    def get_digest(self, contract_address, token_id, sender_address=ZERO_ADDRESS, id_generator=None):
        j = JSONRPCRequest(id_generator)
        o = j.template()
        o['method'] = 'eth_call'
        enc = ABIContractEncoder()
        enc.method('getDigest')
        enc.typ(ABIContractType.BYTES32)
        enc.bytes32(token_id)
        data = add_0x(enc.get())
        tx = self.template(sender_address, contract_address)
        tx = self.set_code(tx, data)
        o['params'].append(self.normalize(tx))
        o['params'].append('latest')
        o = j.finalize(o)
        return o


    def mint_to(self, contract_address, sender_address, recipient, token_id, batch, index=None, tx_format=TxFormat.JSONRPC):
        enc = ABIContractEncoder()

        if index != None:
            enc.method('mintExactFromBatchTo')
            enc.typ(ABIContractType.ADDRESS)
            enc.typ(ABIContractType.BYTES32)
            enc.typ(ABIContractType.UINT16)
            enc.typ(ABIContractType.UINT48)
            enc.address(recipient)
            enc.bytes32(token_id)
            enc.uintn(batch, 16)
            enc.uintn(index, 48)
            data = enc.get()
        else:
            enc.method('mintFromBatchTo')
            enc.typ(ABIContractType.ADDRESS)
            enc.typ(ABIContractType.BYTES32)
            enc.typ(ABIContractType.UINT16)
            enc.address(recipient)
            enc.bytes32(token_id)
            enc.uintn(batch, 16)
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


    @classmethod
    def parse_token_spec(self, v):
        v = strip_0x(v)
        d = ABIContractDecoder()
        d.typ(ABIContractType.UINT48)
        d.typ(ABIContractType.UINT48)
        d.typ(ABIContractType.BOOLEAN)
        d.val(v[:64])
        d.val(v[64:128])
        d.val(v[128:192])
        r = d.decode()
        return TokenSpec(r[0], r[1], r[2])

    @classmethod
    def parse_token(self, v, token_id):
        v = strip_0x(v)
        if v == strip_0x(ZERO_CONTENT):
            return MintedToken()

        token_id = strip_0x(token_id)
        c = v[:2]
        addr = v[24:]
        if int(c, 16) & 0x40 > 0:
            return MintedToken(addr, token_id=token_id, batched=True, minted=True)

        o = MintedToken(addr, minted=True)
        o.batch = int(token_id[48:52], 16)
        o.index = int(token_id[52:64], 16)
        o.token_id = token_id[:48] + v[2:18]
        return o
