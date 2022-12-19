import os
import unittest
import json
import logging

# external imports
from chainlib.eth.unittest.ethtester import EthTesterCase
from chainlib.connection import RPCConnection
from chainlib.eth.nonce import RPCNonceOracle
from chainlib.eth.address import to_checksum_address
from chainlib.eth.tx import (
        receipt,
        transaction,
        TxFormat,
        )
from chainlib.eth.contract import (
        abi_decode_single,
        ABIContractType,
        )
from chainlib.eth.address import is_same_address
from chainlib.error import JSONRPCException
from chainlib.eth.constant import ZERO_ADDRESS
from hexathon import (
        add_0x,
        strip_0x,
        )
from chainlib.eth.tx import TxFormat
from chainlib.eth.contract import ABIContractEncoder
from chainlib.eth.contract import ABIContractType


# local imports
from craft_nft import CraftNFT
from craft_nft.error import InvalidBatchError

logging.basicConfig(level=logging.DEBUG)
logg = logging.getLogger()

testdir = os.path.dirname(__file__)

hash_of_foo = '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
hash_of_bar = 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9'


class Test(EthTesterCase):

    def setUp(self):
        super(Test, self).setUp()
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash, o) = c.constructor(self.accounts[0], 'DevBadge', 'DEV')
        self.conn = RPCConnection.connect(self.chain_spec, 'default')
        r = self.conn.do(o)
        logg.debug('deployed with hash {}'.format(r))
        
        o = receipt(r)
        r = self.conn.do(o)
        self.address = to_checksum_address(r['contract_address'])


    def test_supply_single(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo)
        self.rpc.do(o)

        o = c.total_supply(self.address, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        supply = c.parse_total_supply(r)
        self.assertEqual(supply, 1);
        
    
    def test_supply_batch(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=9)
        self.rpc.do(o)

        o = c.total_supply(self.address, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        supply = c.parse_total_supply(r)
        self.assertEqual(supply, 9);
     


    def test_supply_mixed(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=0)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_bar, amount=10)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_bar, amount=5)
        self.rpc.do(o)

        o = c.total_supply(self.address, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        supply = c.parse_total_supply(r)
        self.assertEqual(supply, 16);


if __name__ == '__main__':
    unittest.main()
 
