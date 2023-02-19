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
from craft_nft.error import InvalidBatchError
from craft_nft.eth import ABIContractType
from craft_nft.nft import to_batch_key

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
        logg.debug('smart contract published with hash {}'.format(r))
        
        o = receipt(r)
        r = self.conn.do(o)
        self.address = to_checksum_address(r['contract_address'])


    def test_allocate(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

    
    def test_allocate_batch(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=10)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)


    def test_batch_of(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=10)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=20)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        r = c.batch_of(self.rpc, self.address, hash_of_foo, 9, sender_address=self.accounts[0])
        self.assertEqual(r, 0)

        r = c.batch_of(self.rpc, self.address, hash_of_foo, 10, sender_address=self.accounts[0])
        self.assertEqual(r, 1)

        r = c.batch_of(self.rpc, self.address, hash_of_foo, 29, sender_address=self.accounts[0])
        self.assertEqual(r, 1)

        with self.assertRaises(ValueError):
            c.batch_of(self.rpc, self.address, hash_of_foo, 30, sender_address=self.accounts[0])


    def test_mint_to(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=20)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)


    def test_mint_to_limit(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=10)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        for i in range(10):
            (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[(i%8)+i], hash_of_foo, 0)
            self.rpc.do(o)
            o = receipt(tx_hash_hex)
            r = self.conn.do(o)
            self.assertEqual(r['status'], 1)


        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)



    def test_mint_to_single(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 1)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 1)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[2], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)

        int_of_foo = int(hash_of_foo, 16)
        o = c.owner_of(self.address, int_of_foo, sender_address=self.accounts[0])
        r = self.rpc.do(o) 
        owner = strip_0x(r)
        self.assertTrue(is_same_address(owner[24:], self.accounts[1]))



    def test_mint_to_batch(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=10)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        expected_id = hash_of_foo[:64-16] + '0000000000000000'
        o = c.get_token(self.address, expected_id, sender_address=self.accounts[0])
        r = self.rpc.do(o)

        o = c.owner_of(self.address, int(expected_id, 16), sender_address=self.accounts[0])
        r = self.rpc.do(o) 
        owner = strip_0x(r)
        self.assertTrue(is_same_address(owner[24:], self.accounts[1]))

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[2], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        expected_id = hash_of_foo[:64-16] + '0000000000000001'
        o = c.get_token(self.address, expected_id, sender_address=self.accounts[0])
        r = self.rpc.do(o)

        o = c.owner_of(self.address, int(expected_id, 16), sender_address=self.accounts[0])
        r = self.rpc.do(o) 
        owner = strip_0x(r)
        self.assertTrue(is_same_address(owner[24:], self.accounts[2]))


    def test_mint_to_dup(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=10)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        enc = ABIContractEncoder()
        enc.method('mintTo')
        enc.typ(ABIContractType.ADDRESS)
        enc.typ(ABIContractType.BYTES32)
        enc.typ(ABIContractType.UINT256)
        enc.address(self.accounts[1])
        enc.bytes32(hash_of_foo)
        enc.uint256(0)
        data = enc.get()
        tx = c.template(self.accounts[0], self.address, use_nonce=True)
        tx = c.set_code(tx, data)
        (tx_hash_hex, o) = c.finalize(tx, TxFormat.JSONRPC)
        r = self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)


    def test_transfer(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=0)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)

        int_of_foo = int(hash_of_foo, 16)
        nonce_oracle = RPCNonceOracle(self.accounts[1], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash, o) = c.transfer_from(self.address, self.accounts[1], self.accounts[1], self.accounts[2], int_of_foo)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        o = c.owner_of(self.address, int_of_foo, sender_address=self.accounts[0])
        r = self.rpc.do(o) 
        owner = strip_0x(r)
        self.assertTrue(is_same_address(owner[24:], self.accounts[2]))


    def test_transfer_batched(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=10)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)

        expected_id = hash_of_foo[:64-16] + '0000000000000000'
        int_of_foo = int(expected_id, 16)

        nonce_oracle = RPCNonceOracle(self.accounts[1], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash, o) = c.transfer_from(self.address, self.accounts[1], self.accounts[1], self.accounts[2], int_of_foo)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)


    def test_fill_batches(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=6)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=8)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=4)
        self.rpc.do(o)

        for i in range(6+8+4):
            batch = c.batch_of(self.rpc, self.address, hash_of_foo, i, sender_address=self.accounts[0])

            (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[(i%7)+1], hash_of_foo, batch)
            r = self.rpc.do(o)
            o = receipt(tx_hash_hex)
            r = self.conn.do(o)
            self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[9], hash_of_foo, 2)
        r = self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)


    def test_digest_single(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)

        o = c.get_token_spec(self.address, hash_of_foo, 0, sender_address=self.accounts[0])
        r = self.rpc.do(o)

        o = c.get_token(self.address, hash_of_foo, sender_address=self.accounts[0])
        r = self.rpc.do(o)

        o = c.get_digest(self.address, hash_of_foo, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        self.assertEqual(strip_0x(r), hash_of_foo)



    def test_digest_batch(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=2)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=3)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.conn.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 1)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 1)
        self.rpc.do(o)

        expected_id = hash_of_foo[:64-16] + '0000000000000000'
        o = c.get_digest(self.address, expected_id, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        self.assertEqual(strip_0x(r), hash_of_foo)

        expected_id = hash_of_foo[:64-16] + '0001000000000000'
        o = c.get_token(self.address, expected_id, sender_address=self.accounts[0])
        self.rpc.do(o)

        o = c.get_digest(self.address, expected_id, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        self.assertEqual(strip_0x(r), hash_of_foo)

        expected_id = hash_of_foo[:64-16] + '0001000000000001'
        o = c.get_digest(self.address, expected_id, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        self.assertEqual(strip_0x(r), hash_of_foo)


    def test_multi(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=2)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=3)
        self.rpc.do(o)
 
        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_bar)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_bar, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_bar, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 0)

        expected_id = hash_of_foo[:64-16] + '0000000000000000'
        o = c.get_digest(self.address, expected_id, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        self.assertEqual(strip_0x(r), hash_of_foo)

        o = c.get_digest(self.address, hash_of_bar, sender_address=self.accounts[0])
        r = self.rpc.do(o)
        self.assertEqual(strip_0x(r), hash_of_bar)


    def test_balance(self):
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_foo, amount=3)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.allocate(self.address, self.accounts[0], hash_of_bar, amount=0)
        self.rpc.do(o)

        o = c.balance(self.address, self.accounts[1], sender_address=self.accounts[0])
        r = self.rpc.do(o)
        balance = c.parse_balance(r)
        self.assertEqual(balance, 0)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_foo, 0)
        self.rpc.do(o)

        (tx_hash_hex, o) = c.mint_to(self.address, self.accounts[0], self.accounts[1], hash_of_bar, 0)
        self.rpc.do(o)

        o = c.balance(self.address, self.accounts[1], sender_address=self.accounts[0])
        r = self.rpc.do(o)
        balance = c.parse_balance(r)
        self.assertEqual(balance, 3)

        nonce_oracle = RPCNonceOracle(self.accounts[1], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        expected_id = to_batch_key(hash_of_foo, 0, 1)
        (tx_hash_hex, o) = c.transfer_from(self.address, self.accounts[1], self.accounts[1], self.accounts[2], int(expected_id, 16))
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        o = c.balance(self.address, self.accounts[1], sender_address=self.accounts[0])
        r = self.rpc.do(o)
        balance = c.parse_balance(r)
        self.assertEqual(balance, 2)

        o = c.balance(self.address, self.accounts[2], sender_address=self.accounts[0])
        r = self.rpc.do(o)
        balance = c.parse_balance(r)
        self.assertEqual(balance, 1)

        (tx_hash_hex, o) = c.transfer_from(self.address, self.accounts[1], self.accounts[1], self.accounts[3], int(hash_of_bar, 16))
        self.rpc.do(o)
        o = receipt(tx_hash_hex)
        r = self.conn.do(o)
        self.assertEqual(r['status'], 1)

        o = c.balance(self.address, self.accounts[1], sender_address=self.accounts[0])
        r = self.rpc.do(o)
        balance = c.parse_balance(r)
        self.assertEqual(balance, 1)

        o = c.balance(self.address, self.accounts[3], sender_address=self.accounts[0])
        r = self.rpc.do(o)
        balance = c.parse_balance(r)
        self.assertEqual(balance, 1)


if __name__ == '__main__':
    unittest.main()
