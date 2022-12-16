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
from chainlib.error import JSONRPCException
from chainlib.eth.constant import ZERO_ADDRESS
from hexathon import (
        add_0x,
        strip_0x,
        )


# local imports
from eth_craft_nft import CraftNFT

logging.basicConfig(level=logging.DEBUG)
logg = logging.getLogger()

testdir = os.path.dirname(__file__)


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

    def test_basic(self):
        pass


if __name__ == '__main__':
    unittest.main()
