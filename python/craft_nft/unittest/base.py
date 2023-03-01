# standard imports
import logging

# external imports
from chainlib.eth.unittest.ethtester import EthTesterCase
from chainlib.connection import RPCConnection
from chainlib.eth.nonce import RPCNonceOracle
from chainlib.eth.address import to_checksum_address
from chainlib.eth.tx import receipt

# local imports
from craft_nft import CraftNFT


logg = logging.getLogger(__name__)
       

class TestCraftNFT(EthTesterCase):

    def setUp(self):
        super(TestCraftNFT, self).setUp()
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash, o) = c.constructor(self.accounts[0], 'DevBadge', 'DEV')
        self.conn = RPCConnection.connect(self.chain_spec, 'default')
        r = self.conn.do(o)
        logg.debug('smart contract published with hash {}'.format(r))
        
        o = receipt(r)
        r = self.conn.do(o)
        self.address = to_checksum_address(r['contract_address'])


class TestCraftNFTEnumerated(EthTesterCase):

    def setUp(self):
        super(TestCraftNFT, self).setUp()
        nonce_oracle = RPCNonceOracle(self.accounts[0], self.rpc)
        c = CraftNFT(self.chain_spec, signer=self.signer, nonce_oracle=nonce_oracle)
        (tx_hash, o) = c.constructor(self.accounts[0], 'DevBadge', 'DEV', enumeration=True)
        self.conn = RPCConnection.connect(self.chain_spec, 'default')
        r = self.conn.do(o)
        logg.debug('smart contract published with hash {}'.format(r))
        
        o = receipt(r)
        r = self.conn.do(o)
        self.address = to_checksum_address(r['contract_address'])
