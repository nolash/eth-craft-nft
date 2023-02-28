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


# local imports
from craft_nft import CraftNFT
from craft_nft.unittest import TestCraftNFT
from craft_nft.error import InvalidBatchError
from craft_nft.eth import ABIContractType
from craft_nft.nft import to_batch_key

logging.basicConfig(level=logging.DEBUG)
logg = logging.getLogger()

testdir = os.path.dirname(__file__)

hash_of_foo = '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
hash_of_bar = 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9'


class TestURI(TestCraftNFT):

    def test_base_uri(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        o = c.to_uri(self.address, hash_of_foo, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        uri = c.parse_uri(r)
        self.assertEqual('sha256:' + hash_of_foo, uri)


    def test_explicit_url(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.set_base_url(self.address, self.accounts[0], 'http://localhost')
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        o = c.to_url(self.address, hash_of_foo, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        uri = c.parse_uri(r)
        self.assertEqual('http://localhost/' + hash_of_foo, uri)

        o = c.token_uri(self.address, int(hash_of_foo, 16), sender_address=self.accounts[0])
        with self.assertRaises(JSONRPCException):
            self.rpc.do(o)
        uri = c.parse_uri(r)
        self.assertEqual('http://localhost/' + hash_of_foo, uri)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=2)
        self.rpc.do(o)
        o = c.token_uri(self.address, int(hash_of_foo, 16), sender_address=self.accounts[0])
        self.rpc.do(o)
        uri = c.parse_uri(r)
        self.assertEqual('http://localhost/' + hash_of_foo, uri)

        (tx_hash_hex, o) = c.set_base_url(self.address, self.accounts[0], 'https://example.org/')
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        o = c.to_url(self.address, hash_of_bar, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        uri = c.parse_uri(r)
        self.assertEqual('https://example.org/' + hash_of_bar, uri)


    def test_batch_to_uri(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=1000)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0, index=666)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)
        token_batch_id = hash_of_foo[:64-16] + '000000000000029a'

        o = c.token_uri(self.address, int(token_batch_id, 16), sender_address=self.accounts[0])
        r = self.rpc.do(o)
        uri = c.parse_uri(r)
        self.assertEqual(hash_of_foo, uri)


if __name__ == '__main__':
    unittest.main()
