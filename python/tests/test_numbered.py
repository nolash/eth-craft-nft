# standard imports
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
from craft_nft.unittest import TestCraftNFT
from craft_nft.error import InvalidBatchError

logging.basicConfig(level=logging.DEBUG)
logg = logging.getLogger()

testdir = os.path.dirname(__file__)

hash_of_foo = '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
hash_of_bar = 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9'


class Test(TestCraftNFT):


    def test_set_numbered(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=2)
        self.rpc.do(o)

        o = c.get_token_spec(self.address, hash_of_foo, 0, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        spec = c.parse_token_spec(r) 


    def test_mint_number(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=1000)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0, index=666)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        expected_id = hash_of_foo[:64-16] + '000000000000029a'
        o = c.get_token(self.address, expected_id, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        content = c.parse_token(r, expected_id)
        self.assertEqual(content.token_id, hash_of_foo);

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0, index=666)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)


    def test_mint_auto_after_number(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=10)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0, index=2)
        self.rpc.do(o)

        expected_id = hash_of_foo[:64-10] + '000000029a'
        o = c.get_token(self.address, expected_id, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        content = c.parse_token(r, hash_of_foo) 

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)


    def test_complete_number(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=3)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0, index=1)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0, index=2)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0, index=0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0, index=3)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0, index=2)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)


if __name__ == '__main__':
    unittest.main()
