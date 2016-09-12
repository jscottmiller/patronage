import {assertThrows} from './helpers.js';

contract('Exchange', function(accounts) {
  async function createTradingAccounts() {
    const custodian = SimpleCustodian.deployed();
    const seller= accounts[1];
    const buyer= accounts[2];
    const exchange = Exchange.at(await custodian.exchange());
    await custodian.give(seller, 10);
    for (let side = 0; side < 2; side++) {
      while ((await exchange.getNumberOfOffers.call(side)) > 0) {
        const [price, shares] = await exchange.getTopOffer.call(side);
        const sender = side == 0 ? buyer : seller;
        await exchange.cancelOffer(side, price, shares, {from: sender});
      }
    }
    return {custodian, exchange, buyer, seller};
  }

  function getGasCost(tx) {
    const transaction = web3.eth.getTransaction(tx);
    const receipt = web3.eth.getTransactionReceipt(tx);
    return transaction.gasPrice.mul(receipt.gasUsed);
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

  it("should reserve shares for accepted asks", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    const initialAskCount = await exchange.getNumberOfOffers.call(1);
    const initialReservedShares = await custodian.getReservedBalance.call(seller);
    const initialAvailableShares = await custodian.getAvailableBalance.call(seller);
    await exchange.postOffer(1, 100, 1, {from: seller});
    const newReservedShares = await custodian.getReservedBalance.call(seller);
    const newAvailableShares = await custodian.getAvailableBalance.call(seller);
    const availableDifference = newAvailableShares.sub(initialAvailableShares);
    const reservedDifference = newReservedShares.sub(initialReservedShares);
    assert.equal(-1, availableDifference.toNumber());
    assert.equal(1, reservedDifference.toNumber());
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
    const gasCost = getGasCost(tx);
    const balance = web3.eth.getBalance(buyer);
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

  it("should allow sells to be cancelled, returning funds", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    const initialAskCount = await exchange.getNumberOfOffers.call(1);
    const initialShares = await custodian.getAvailableBalance.call(seller);
    await exchange.postOffer(1, 100, 1, {from: seller});
    await exchange.cancelOffer(1, 100, 1, {from: seller});
    const newAskCount = await exchange.getNumberOfOffers.call(1);
    assert.equal(initialAskCount.toNumber(), newAskCount.toNumber());
    const newShares = await custodian.getAvailableBalance.call(seller);
    assert.equal(initialShares.toString(), newShares.toString());
  });

  it("should allow cancelled funds to be withdrawn", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    const initialExchangeBalance = await exchange.getBalance.call({from: buyer});
    const initialBalance = web3.eth.getBalance(buyer).add(initialExchangeBalance);
    const tx1 = await exchange.postOffer(0, 100, 1, {from: buyer, value: 100});
    let gasCost = getGasCost(tx1);
    const tx2 = await exchange.cancelOffer(0, 100, 1, {from: buyer});
    gasCost = gasCost.add(getGasCost(tx2));
    const tx3 = await exchange.withdrawal({from: buyer});
    gasCost = gasCost.add(getGasCost(tx3));
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

  it("should not match a low buyer with high seller", async function() {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    const sellTx = await exchange.postOffer(1, 101, 1, {from: seller});
    const buyTx = await exchange.postOffer(0, 100, 1, {from: buyer, value: 100});
    const newAskCount = await exchange.getNumberOfOffers.call(1);
    const newBidCount = await exchange.getNumberOfOffers.call(0);
    assert.equal(1, newAskCount.toNumber());
    assert.equal(1, newBidCount.toNumber());
  });

  async function checkTrade({
    offers,
    buyerSharesChange, 
    sellerSharesChange, 
    buyerBalanceChange, 
    sellerBalanceChange, 
    exchangeBalanceChange,
    remainingBids, 
    remainingAsks
  }) {
    const {custodian, exchange, buyer, seller} = await createTradingAccounts();
    const sellerStartingShares = await custodian.getAvailableBalance.call(seller);
    const buyerStartingShares = await custodian.getAvailableBalance.call(buyer);
    const sellerStartingBalance = await exchange.getBalance.call({from: seller});
    const buyerStartingBalance = await exchange.getBalance.call({from: buyer});
    const exchangeStartingBalance = web3.eth.getBalance(exchange.address);
    for (let [side, price, shares] of offers) {
      const meta = {
        from: side == 0 ? buyer : seller,
        value: side == 0 ? price * shares : 0
      };
      await exchange.postOffer(side, price, shares, meta);
    }
    const sellerEndingShares = await custodian.getAvailableBalance.call(seller);
    const buyerEndingShares = await custodian.getAvailableBalance.call(buyer);
    const sellerEndingBalance = await exchange.getBalance.call({from: seller});
    const buyerEndingBalance = await exchange.getBalance.call({from: buyer});
    const exchangeEndingBalance = web3.eth.getBalance(exchange.address);
    const newBidCount = await exchange.getNumberOfOffers.call(0);
    const newAskCount = await exchange.getNumberOfOffers.call(1);
    assert.equal(buyerSharesChange, buyerEndingShares.sub(buyerStartingShares).toNumber());
    assert.equal(sellerSharesChange, sellerEndingShares.sub(sellerStartingShares).toNumber());
    assert.equal(buyerBalanceChange, buyerEndingBalance.sub(buyerStartingBalance).toNumber());
    assert.equal(sellerBalanceChange, sellerEndingBalance.sub(sellerStartingBalance).toNumber());
    assert.equal(exchangeBalanceChange, exchangeEndingBalance.sub(exchangeStartingBalance).toNumber());
    if (remainingBids) {
      assert.equal(remainingBids.length, newBidCount.toNumber());
      let depth = 0
      for (let [price, shares] of remainingBids) {
        const [bookPrice, bookShares] = await exchange.getOffer.call(0, depth++);
        assert.equal(price, bookPrice.toNumber());
        assert.equal(shares, bookShares.toNumber());
      }
    } else {
      assert.equal(0, newBidCount.toNumber());
    }
    if (remainingAsks) {
      assert.equal(remainingAsks.length, newAskCount.toNumber());
      let depth = 0
      for (let [price, shares] of remainingAsks) {
        const [bookPrice, bookShares] = await exchange.getOffer.call(1, depth++);
        assert.equal(price, bookPrice.toNumber());
        assert.equal(shares, bookShares.toNumber());
      }
    } else {
      assert.equal(0, newAskCount.toNumber());
    }
  }

  it("should match buyer with seller for exact amounts, clearing exchange", async function() {
    await checkTrade({
      offers: [[0, 101, 1], [1, 101, 1]],
      buyerSharesChange: 1,
      sellerSharesChange: -1,
      buyerBalanceChange: 0,
      sellerBalanceChange: 101,
      exchangeBalanceChange: 101
    });
  });

  it("should match seller with buyer for exact amounts, clearing exchange", async function() {
    await checkTrade({
      offers: [[1, 101, 1], [0, 101, 1]],
      buyerSharesChange: 1,
      sellerSharesChange: -1,
      buyerBalanceChange: 0,
      sellerBalanceChange: 101,
      exchangeBalanceChange: 101
    });
  });

  it("should match large buyer with small seller, leaving excess on the exchange", async function() {
    await checkTrade({
      offers: [[1, 101, 1], [0, 101, 2]],
      buyerSharesChange: 1,
      sellerSharesChange: -1,
      buyerBalanceChange: 0,
      sellerBalanceChange: 101,
      exchangeBalanceChange: 202,
      remainingBids: [[101, 1]]
    });
  });

  it("should match large seller with small buyer, leaving excess on the exchange", async function() {
    await checkTrade({
      offers: [[0, 101, 1], [1, 101, 2]],
      buyerSharesChange: 1,
      sellerSharesChange: -2,
      buyerBalanceChange: 0,
      sellerBalanceChange: 101,
      exchangeBalanceChange: 101,
      remainingAsks: [[101, 1]]
    });
  });
})
