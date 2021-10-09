const { expect, describe, before, it } = require('chai');
const { ethers } = require('hardhat');
// const { awaitTokenAddress } = require('./utils/txHelpers');
const { log } = require('./utils/testUtils');
const {
  getDeployedContract,
  marketContract,
  implementationContract,
  splitterFactoryContract,
  factoryContract,
  mintFraktal,
} = require('./utils/factoryHelpers');

describe('Fraktal Market - Deploy', function () {
  let FraktalImplementationContract;
  let logicContract;
  let PaymentSplitterLogicContract;
  let psLogicContract;

  let factory;
  let Token;
  let market;

  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;

  before('Getting accounts - deploying contracts', async () => {
    [owner, alice, bob, carol, deedee] = await ethers.getSigners();
    log(`Alice address: ${alice.address}`);
    log(`Bob address: ${bob.address}`);
    log(`Carol address: ${carol.address}`);
    FraktalImplementationContract = await implementationContract();
    logicContract = await getDeployedContract(
      'Fraktal NFT',
      FraktalImplementationContract,
    );
    PaymentSplitterLogicContract = await splitterFactoryContract();
    psLogicContract = await getDeployedContract(
      'Payment Splitter',
      PaymentSplitterLogicContract,
    );
    factory = await getDeployedContract(
      'Fraktal Factory',
      await factoryContract(),
      [logicContract.address, psLogicContract.address],
    );
    log(`Factory owner: ${await factory.owner()}`);
    Token = await mintFraktal(factory, logicContract, alice);
    // await Token.connect(alice).fraktionalize(alice.address, 1);
  });

  it('Should deploy to the correct owner', async function () {
    let defaultFee = 100;
    market = await getDeployedContract('Market Contract', marketContract());
    log(`Market owner: ${await market.owner()}`);
    expect(await market.owner()).to.equal(owner.address);
    expect(await market.fee()).to.equal(defaultFee);
  });
  it('Should allow only the owner to set market fee', async function () {
    // fee is uint16 (max 10000) so try to break it!! (>10k would be a fee of >100%)
    let newFee = 1000;
    await expect(market.connect(alice).setFee(newFee)).to.be.reverted;
    await market.connect(owner).setFee(newFee);
    expect(await market.fee()).to.be.equal(newFee);
  });
});
