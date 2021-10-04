const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

///////////////////////////////////////////////////////////////////////CONSTANTS
const logs = false;
const emptyData = '0x000000000000000000000000000000000000dEaD';
const testUri = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

///////////////////////////////////////////////////////////////////////FUNCTIONS
const awaitTokenAddress = async tx => {
  const receipt = await tx.wait();
  const abi = new ethers.utils.Interface(['event Minted(address creator,string urlIpfs,address tokenAddress,uint nftId)']);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find(e => e.topics[0] === eventTopic);
  if (!event) return '';
  const decodedLog = abi.decodeEventLog(
    eventFragment,
    event.data,
    event.topics,
  );
  return decodedLog.tokenAddress;
};
const awaitERC721TokenAddress = async tx => {
  const receipt = await tx.wait();
  const abi = new ethers.utils.Interface(['event NewToken(address token)']);
  const eventFragment = abi.events[Object.keys(abi.events)[0]];
  const eventTopic = abi.getEventTopic(eventFragment);
  const event = receipt.logs.find(e => e.topics[0] === eventTopic);
  if (!event) return '';
  const decodedLog = abi.decodeEventLog(
    eventFragment,
    event.data,
    event.topics,
  );
  return decodedLog.token;
};

///////////////////////////////////////////////////////////////////////////TESTS
describe("Fraktal Factory", function () {
  let FraktalImplementationContract;
  let logicContract;
  let PaymentSplitterLogicContract;
  let psLogicContract;
  let IPaymentSplitter;

// start the factory with address(0) in implementations, test the set functions
  let emptyAddress = '0x0000000000000000000000000000000000000000';
  let factory;

  let Token;
  // i will use a FraktalNFT (Token) to import it as any other ERC1155
  let TokenERC1155;
  let TokenFromERC721;
  let TokenFromERC1155;
  let erc721Factory;
  let ERC721LogicContract;
  let ERC721FactoryContract;
  let TokenERC721;

  let PaymentSplitter1;
  let PaymentSplitter2;

  let owner;
  let alice;
  let bob;
  let carol;
  let deedee;

  before('Getting accounts', async () => {
    [owner, alice, bob, carol, deedee] = await ethers.getSigners();
    if(logs) console.log('Alice address: ',alice.address);
    if(logs) console.log('bob address: ',bob.address);
    if(logs) console.log('carol address: ',carol.address);
    // create the ERC721 to import in tests
    ERC721LogicContract = await ethers.getContractFactory("TestTokenUpgradeable");
    const erc721Contract = await ERC721LogicContract.deploy();
    await erc721Contract.deployed();
    const ERC721FactoryContract = await ethers.getContractFactory("TestTokenFactory");
    erc721Factory = await ERC721FactoryContract.deploy(erc721Contract.address);
    await erc721Factory.deployed();
    if(logs) console.log("ERC721 factory deployed to:", erc721Factory.address);
    if(logs) console.log('Alice mints an ERC721');
    let mintERC721Tx = await erc721Factory.connect(alice).createTestToken('alice NFT', 'ANFT');
    const nftAddress = await awaitERC721TokenAddress(mintERC721Tx);

    FraktalImplementationContract = await ethers.getContractFactory("FraktalNFT");
    logicContract = await FraktalImplementationContract.deploy();
    await logicContract.deployed();
    if(logs) console.log("FraktalNFT deployed to:", logicContract.address);
    PaymentSplitterLogicContract = await ethers.getContractFactory("PaymentSplitterUpgradeable");
    psLogicContract = await PaymentSplitterLogicContract.deploy();
    await psLogicContract.deployed();
    if(logs) console.log("Payment Splitter deployed to:", psLogicContract.address);

    TokenERC721 = ERC721LogicContract.attach(nftAddress);
    if(logs) console.log(
      `Deployed a new ERC721 contract at: ${TokenERC721.address}`,
    );
    await TokenERC721.connect(alice).mint();
    let aliceERC721Balance = await TokenERC721.balanceOf(alice.address);
    expect(aliceERC721Balance).to.equal(ethers.BigNumber.from('1'));
    let tokenERC721owner = await TokenERC721.ownerOf(1);
    if(logs) console.log('owner of ERC721 tokenId 1 ',tokenERC721owner);
    expect(tokenERC721owner).to.equal(alice.address);
  });


  describe("Deployment", async function () {
    it("Should deploy to the correct owner", async function(){
      const FactoryContract = await ethers.getContractFactory("FraktalFactory");
      factory = await FactoryContract.deploy(emptyAddress, emptyAddress);
      await factory.deployed();
      if(logs) console.log("Factory deployed to:", factory.address);
      if(logs) console.log("Factory owner:", await factory.owner());
      expect(await factory.owner()).to.equal(owner.address);
    });
    it('Set the Fraktal implementation', async function () {
      await expect(
        factory.connect(alice).setFraktalImplementation(logicContract.address)
      ).to.be.reverted;
      await factory.connect(owner).setFraktalImplementation(logicContract.address);
      expect(await factory.Fraktalimplementation()).to.be.equal(logicContract.address)
    });
    it('Set the Payment Splitter implementation', async function (){
      await expect(
        factory.connect(alice).setRevenueImplementation(psLogicContract.address)
      ).to.be.reverted;
      await factory.connect(owner).setRevenueImplementation(psLogicContract.address);
      expect(await factory.revenueChannelImplementation()).to.be.equal(psLogicContract.address)
    });
  });
  describe('Functions',async function () {
    it('Should mint a Fraktal to the minter', async function (){
      const mintTx = await factory.connect(alice).mint(testUri, 8000);
      const token1Address = await awaitTokenAddress(mintTx);
      Token = FraktalImplementationContract.attach(token1Address);
      if(logs) console.log(
        `Deployed a new ERC1155 FraktalNFT at: ${Token.address}`,
      );
      let balances = await Token.balanceOfBatch([alice.address,alice.address, factory.address,factory.address],[0,1,0,1]);
      expect(balances[0]).to.equal(ethers.BigNumber.from("1"));
      expect(balances[1]).to.equal(ethers.BigNumber.from("0"));
      expect(balances[2]).to.equal(ethers.BigNumber.from("0"));
      expect(balances[3]).to.equal(ethers.BigNumber.from("0"));
    });
    it('Should allow to lock ERC721 tokens to the FraktalFactory.', async function () {
      if(logs) console.log('Alice approves the factory');
      await TokenERC721.connect(alice).approve(factory.address, 1);
      if(logs) console.log('Alice imports its ERC721');
      let importERC721Tx = await factory.connect(alice).importERC721(TokenERC721.address, 1, 6000);
      const importTokenAddress = await awaitTokenAddress(importERC721Tx);
      TokenFromERC721 = FraktalImplementationContract.attach(importTokenAddress);
      if(logs) console.log(
        `Deployed a new ERC1155 FraktalNFT at: ${TokenFromERC721.address}`,
      );
      let tokenERC721owner = await TokenERC721.ownerOf(1);
      expect(tokenERC721owner).to.equal(factory.address);
      let aliceERC721Balance = await TokenERC721.balanceOf(alice.address);
      expect(aliceERC721Balance).to.equal(ethers.BigNumber.from('0'));
      if(logs) console.log('owner of ERC721 tokenId 1 ',tokenERC721owner);
      const importTokenUri = await TokenFromERC721.uri(0);
      const erc721uri = await TokenERC721.tokenURI(1);
      expect(importTokenUri).to.equal(erc721uri);
      let aliceImportBalance = await Token.balanceOfBatch([alice.address,alice.address], [0,1]);
      expect(aliceImportBalance[0]).to.equal(ethers.BigNumber.from("1"));
      expect(aliceImportBalance[1]).to.equal(ethers.BigNumber.from("0"));
      let collateralAddress = await factory.getERC721Collateral(TokenFromERC721.address);
      if(logs) console.log('collateralAddress ',collateralAddress);
      expect(collateralAddress).to.equal(TokenERC721.address);
    });
    it('Should not be claimable by anyone..',async function () {});
    it('Should allow to whitdraw the locked nft', async function () {
      if(logs) console.log('Alice allows the market');
      await TokenFromERC721.connect(alice).setApprovalForAll(factory.address, true);
      if(logs) console.log('Alice whitdraws its ERC721');
      let itemAbandoned = await factory.getFraktalAddress(0);
      if(logs) console.log('Fraktal new address ',itemAbandoned);
      let itemAbandonedCollateral = await factory.getERC721Collateral(TokenFromERC721.address);
      if(logs) console.log('Collateral address ',itemAbandonedCollateral);
      await factory.connect(alice).claimERC721(1);
      // why tokenId!! its confusing! should be tokenAddress
      // its tokenId to overwrite its position in fraktalNFTs.. think about it!
      let aliceERC721Balance = await TokenERC721.balanceOf(alice.address);
      let aliceBalance = await TokenFromERC721.balanceOfBatch([alice.address,alice.address], [0,1]);
      expect(aliceERC721Balance).to.equal(ethers.BigNumber.from('1'));
      expect(aliceBalance[1]).to.equal(ethers.BigNumber.from('0'));
      expect(aliceBalance[0]).to.equal(ethers.BigNumber.from('0'));
    });
    it('Should allow to lock ERC1155 tokens to the FraktalFactory.', async function () {
      if(logs) console.log('Alice approves the factory');
      await Token.connect(alice).setApprovalForAll(factory.address, 1);
      if(logs) console.log('Alice imports its ERC1155');
      let importERC1155Tx = await factory.connect(alice).importERC1155(Token.address, 0, 6000);
      const importTokenAddress = await awaitTokenAddress(importERC1155Tx);
      TokenFromERC1155 = FraktalImplementationContract.attach(importTokenAddress);
      if(logs) console.log(
        `Deployed a new ERC1155 FraktalNFT at: ${TokenFromERC1155.address}`,
      );
      let aliceTokenBalance = await Token.balanceOf(alice.address, 0);
      expect(aliceTokenBalance).to.equal(ethers.BigNumber.from('0'));
      const importedTokenUri = await TokenFromERC1155.uri(0);
      const newFraktaluri = await Token.uri(0);
      expect(importedTokenUri).to.equal(newFraktaluri);
      let aliceImportBalance = await TokenFromERC1155.balanceOfBatch([alice.address,alice.address], [0,1]);
      expect(aliceImportBalance[0]).to.equal(ethers.BigNumber.from("1"));
      expect(aliceImportBalance[1]).to.equal(ethers.BigNumber.from("0"));
      let collateralAddress = await factory.getERC1155Collateral(TokenFromERC1155.address);
      expect(collateralAddress).to.equal(Token.address);
    });
    it('Should allow to whitdraw the locked nft', async function () {
      if(logs) console.log('Alice allows the market');
      await TokenFromERC1155.connect(alice).setApprovalForAll(factory.address, true);
      if(logs) console.log('Alice whitdraws its ERC1155');
      let itemAbandonedCollateral = await factory.getERC721Collateral(TokenFromERC1155.address);
      if(logs) console.log('Collateral address ',itemAbandonedCollateral);
      await factory.connect(alice).claimERC1155(2);
      let aliceERC1155Balance = await Token.balanceOf(alice.address,0);
      let aliceBalance = await TokenFromERC1155.balanceOfBatch([alice.address,alice.address], [0,1]);
      expect(aliceERC1155Balance).to.equal(ethers.BigNumber.from('1'));
      expect(aliceBalance[1]).to.equal(ethers.BigNumber.from('0'));
      expect(aliceBalance[0]).to.equal(ethers.BigNumber.from('0'));
    });


    // add malicious actors and random stuff!
    // importing Fraktions as collateral of new Fraktals?
  });
})