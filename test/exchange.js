import {assertThrows} from './helpers.js';

contract('Exchange', function(accounts) {
  async function createTradingAccounts() {
    const custodian = SimpleCustodian.deployed();
    const seller= accounts[1];
    const buyer= accounts[2];
    const exchange = Exchange.at(await custodian.exchange());
    await custodian.give(seller, 10);
    return {custodian, exchange, buyer, seller};
  }

  it("should not allow offers priced at zero", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    await assertThrows(async () => await exchange.postOffer(0, 0, 100));
  });

  it("should not allow offers for zero shares", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    await assertThrows(async () => await exchange.postOffer(0, 100, 0));
  });

  it("should not allow bids without enough value", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    await assertThrows(async () => await exchange.postOffer(0, 100, 1, {value: 50}));
  });

  it("should allow bids to an empty book", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    const initialBalance = web3.eth.getBalance(buyer);
    const initialExchangeBalance = web3.eth.getBalance(exchange.address);
    const initialBidCount = await exchange.getNumberOfOffers.call(0);
    const tx = await exchange.postOffer(0, 100, 1, {from: buyer, value: 100});
    const exchangeBalance = web3.eth.getBalance(exchange.address);
    const expectedExchangeBalance = initialExchangeBalance.add(100).toString();
    assert.equal(expectedExchangeBalance.toString(), exchangeBalance.toString())
    const transaction = web3.eth.getTransaction(tx);
    const receipt = web3.eth.getTransactionReceipt(tx);
    const balance = web3.eth.getBalance(buyer);
    const gasCost = transaction.gasPrice.mul(receipt.gasUsed);
    const expectedBiddingBalance = initialBalance.sub(100).sub(gasCost);
    assert.equal(expectedBiddingBalance.toString(), balance.toString())
    assert.equal(initialBidCount.add(1).toString(), (await exchange.getNumberOfOffers.call(0)).toNumber());
  });

  it("should allow bids to be cancelled, returning funds", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    const initialBidCount = await exchange.getNumberOfOffers.call(0);
    const initialExchangeBalance = await exchange.getBalance.call({from: buyer});
    await exchange.postOffer(0, 100, 1, {from: buyer, value: 100});
    await exchange.cancelOffer(0, 100, 1, {from: buyer});
    const newBidCount = await exchange.getNumberOfOffers.call(0);
    assert.equal(initialBidCount.toNumber(), newBidCount.toNumber());
    const newExchangeBalance = await exchange.getBalance.call({from: buyer});
    const returned = newExchangeBalance.sub(initialExchangeBalance).toNumber();
    assert.equal(100, returned);
  });

  it("should allow cancelled funds to be withdrawn", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    const initialExchangeBalance = await exchange.getBalance.call({from: buyer});
    const initialBalance = web3.eth.getBalance(buyer).add(initialExchangeBalance);
    const tx1 = await exchange.postOffer(0, 100, 1, {from: buyer, value: 100});
    const transaction1 = web3.eth.getTransaction(tx1);
    const receipt1 = web3.eth.getTransactionReceipt(tx1);
    let gasCost = transaction1.gasPrice.mul(receipt1.gasUsed);
    const tx2 = await exchange.cancelOffer(0, 100, 1, {from: buyer});
    const transaction2 = web3.eth.getTransaction(tx2);
    const receipt2 = web3.eth.getTransactionReceipt(tx2);
    gasCost = gasCost.add(transaction2.gasPrice.mul(receipt2.gasUsed));
    const tx3 = await exchange.withdrawal({from: buyer});
    const transaction3 = web3.eth.getTransaction(tx3);
    const receipt3 = web3.eth.getTransactionReceipt(tx3);
    gasCost = gasCost.add(transaction3.gasPrice.mul(receipt3.gasUsed));
    const balance = web3.eth.getBalance(buyer);
    const expected = initialBalance.sub(gasCost);
    assert.equal(expected.toString(), balance.toString());
  })

  it("should reserve offered shares with custodian", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    const startingAvailableBalance = await custodian.getAvailableBalance.call(seller);
    const startingReservedBalance = await custodian.getReservedBalance.call(seller);
    await exchange.postOffer(1, 101, 1, {from: seller});
    const newAvailableBalance = await custodian.getAvailableBalance.call(seller);
    const expectedAvailable = startingAvailableBalance.sub(1);
    assert.equal(expectedAvailable.toString(), newAvailableBalance.toString());
    const newReservedBalance = await custodian.getReservedBalance.call(seller);
    const expectedReserved = startingReservedBalance.add(1);
    assert.equal(expectedReserved.toString(), newReservedBalance.toString());
  });
})
