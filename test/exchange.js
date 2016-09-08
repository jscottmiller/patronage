contract('Exchange', function(accounts) {
  it("should not allow offers priced at zero", function() {
    var exchange = Exchange.deployed();
    var failed = false;

    return exchange.postOffer(0, 0, 100).catch(function(e) {
      failed = true;
    }).then(function() {
      assert.isTrue(failed);
    })
  });

  it("should not allow offers for zero shares", function() {
    var exchange = Exchange.deployed();
    var failed = false;

    return exchange.postOffer(0, 100, 0).catch(function(e) {
      failed = true;
    }).then(function() {
      assert.isTrue(failed);
    })
  });

  it("should not allow bids without enough value", function() {
    var exchange = Exchange.deployed();
    var failed = false;

    return exchange.postOffer(0, 100, 1, {value: 50}).catch(function(e) {
      failed = true;
    }).then(function() {
      assert.isTrue(failed);
    })
  });

  it("should allow bids to an empty book", function() {
    var exchange = Exchange.deployed();
    var biddingAccount = accounts[0];
    var initialBalance = web3.eth.getBalance(biddingAccount);
    var initialExchangeBalance = web3.eth.getBalance(exchange.address);
    var initialBidCount;

    return exchange.getNumberOfOffers.call(0).then(function(count) {
      initialBidCount = count.toNumber();
      return exchange.postOffer(0, 100, 1, {from: biddingAccount, value: 100});
    }).then(function(tx) {
      var exchangeBalance = web3.eth.getBalance(exchange.address);
      var expectedExchangeBalance = initialExchangeBalance.add(100).toString();
      assert.equal(expectedExchangeBalance.toString(), exchangeBalance.toString())

      var transaction = web3.eth.getTransaction(tx);
      var receipt = web3.eth.getTransactionReceipt(tx);
      var balance = web3.eth.getBalance(biddingAccount);
      var gasCost = transaction.gasPrice.mul(receipt.gasUsed);
      var expectedBiddingBalance = initialBalance.sub(100).sub(gasCost);
      assert.equal(expectedBiddingBalance.toString(), balance.toString())

      return exchange.getNumberOfOffers.call(0);
    }).then(function(count) {
      assert.equal(initialBidCount + 1, count.toNumber());
    });
  });

  it("should allow bids to be cancelled, returning funds", function() {
    var exchange = Exchange.deployed();
    var biddingAccount = accounts[0];
    var initialExchangeBalance;
    var initialBidCount;

    return exchange.getNumberOfOffers.call(0).then(function(count) {
      initialBidCount = count.toNumber();
      return exchange.getBalance.call()
    }).then(function(balance) {
      initialExchangeBalance = balance.toNumber();
      return exchange.postOffer(0, 100, 1, {from: biddingAccount, value: 100});
    }).then(function(tx) {
      return exchange.cancelOffer(0, 100, 1);
    }).then(function(tx) {
      return exchange.getNumberOfOffers.call(0);
    }).then(function(count) {
      assert.equal(initialBidCount, count.toNumber());
      return exchange.getBalance.call();
    }).then(function(balance) {
      var returned = balance.toNumber() - initialExchangeBalance;
      assert.equal(100, returned);
    });
  });

  it("should allow cancelled funds to be withdrawn", function() {
    var exchange = Exchange.deployed();
    var biddingAccount = accounts[0];
    var initialBalance = web3.eth.getBalance(biddingAccount);
    var gasCost;

    return exchange.getBalance.call().then(function(balance) {
      initialBalance = initialBalance.add(balance);
      return exchange.postOffer(0, 100, 1, {from: biddingAccount, value: 100})
    }).then(function(tx) {
      var transaction = web3.eth.getTransaction(tx);
      var receipt = web3.eth.getTransactionReceipt(tx);
      gasCost = transaction.gasPrice.mul(receipt.gasUsed);
      return exchange.cancelOffer(0, 100, 1);
    }).then(function(tx) {
      var transaction = web3.eth.getTransaction(tx);
      var receipt = web3.eth.getTransactionReceipt(tx);
      gasCost = gasCost.add(transaction.gasPrice.mul(receipt.gasUsed));
      return exchange.withdrawal();
    }).then(function(tx) {
      var transaction = web3.eth.getTransaction(tx);
      var receipt = web3.eth.getTransactionReceipt(tx);
      gasCost = gasCost.add(transaction.gasPrice.mul(receipt.gasUsed));

      var balance = web3.eth.getBalance(biddingAccount);
      var expected = initialBalance.sub(gasCost);
      assert.equal(expected.toString(), balance.toString());
    });
  })
})