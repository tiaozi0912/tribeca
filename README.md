# tribeca

[![Join the chat at https://gitter.im/michaelgrosner/tribeca](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/michaelgrosner/tribeca?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

`tribeca` is a very low latency cryptocurrency [market making](https://github.com/michaelgrosner/tribeca/wiki#what-is-market-making) trading bot with a full featured [web client](https://github.com/michaelgrosner/tribeca#web-ui), [backtester](https://github.com/michaelgrosner/tribeca/wiki#how-can-i-test-new-trading-strategies), and supports direct connectivity to [several cryptocoin exchanges](https://github.com/michaelgrosner/tribeca#configuration). On modern hardware, it can react to market data by placing and canceling orders in under a millisecond.

![Web UI Preview](https://raw.githubusercontent.com/michaelgrosner/tribeca/master/docs/web_ui_preview.png)

Runs on the latest node.js (v7.8 or greater). Persistence is acheived using mongodb. Installation is recommended via Docker, but manual installation is also supported.

### Docker compose installation

1. Install [docker compose](https://docs.docker.com/compose/install/).

2. Change the environment variables of `env` file to match your desired [configuration](https://github.com/michaelgrosner/tribeca#configuration). Input your exchange connectivity information, account information, and mongoDB credentials.

3. Run `docker-compose up -d --build`. If you run `docker-compose ps`, you should see the containers running.

### Docker Installation

1. Please install [docker](https://www.docker.com/) for your system before preceeding. Requires at least Docker 1.7.1. Mac/Windows only: Ensure boot2docker or docker-machine is set up, depending on Docker version. See [the docs](https://docs.docker.com/installation/mac/) for more help.

2. Set up mongodb. If you do not have a mongodb instance already running: `docker run -p 27017:27017 --name tribeca-mongo -d mongo`.

2. Change the environment variables of `env` file to match your desired [configuration](https://github.com/michaelgrosner/tribeca#configuration). Input your exchange connectivity information, account information, and mongoDB credentials.

4. Save the Dockerfile, preferably in a secure location and in an empty directory. Build the image from the Dockerfile `docker build -t tribeca .`

5. Run the container `docker run -p 3000:3000 --link tribeca-mongo:mongo --env-file ./env --name tribeca -d tribeca`. If you run `docker ps`, you should see tribeca and mongo containers running.

### Manual Installation

1. Ensure your target machine has node v7.8 (or greater) and mongoDB v3 or greater. Also, ensure Typescript 2.2, grunt, and, optionally, forever are installed (`npm install -g grunt-cli typescript forever`).

2. Clone the repository.

3. In the cloned repository directory, run `npm install` to pull in all dependencies.

4. Compile typescript to javascript via `grunt compile`.

5. cd to the outputted JS files, in `tribeca/service`.

6. Create a `tribeca.json` file based off the provided `sample-dev-tribeca.json` or `sample-prod-tribeca.json` files and save it in the current directory. Modify the config keys (see [configuration](https://github.com/michaelgrosner/tribeca#configuration) section) and point the instance towards the running mongoDB instance.

7. Set environmental variable TRIBECA_CONFIG_FILE to full path of tribeca.json

8. Run `forever start main.js` to start the app.

### Configuration

  * EXCHANGE

    1. `coinbase` - uses the WebSocket API. Ensure the Coinbase-specific properties have been set with your correct account information if you are using the sandbox or live-trading environment.

    2. `hitbtc` - WebSocket + socket.io API. Ensure the HitBtc-specific properties have been set with your correct account information if you are using the dev or prod environment.

    3. `okcoin` - Websocket.Ensure the OKCoin-specific properties have been set with your correct account information. Production environment only.

    4. `bitfinex` REST API only. Ensure the Bitfinex-specific properties have been filled out. REST API is not suitable to millisecond latency trading. Production environment only.

    5. `null` - Test in-memory exchange. No exchange-specific config needed.

  * TRIBECA_MODE

    1. `prod`

    2. `dev`

  * MongoDbUrl - If you are on OS X, change "tribeca-mongo" in the URL to the output of `boot2docker ip` on your host machine. If you are running an existing mongoDB instance, replace the URL with the existing instance's URL. If you are running from a Linux machine and set up mongo in step 1, you should not have to modify anything.

  * ShowAllOrders - Show all orders sent from the application in the Orders List in the UI. This is useful for debugging/testing, but can really negatively impact performance during real trading.

  * TradedPair - Any combination of the following currencies are supported, if the target EXCHANGE supports trading the currency pair:

    - USD
    - BTC
    - LTC
    - EUR
    - GBP
    - CNY
    - ETH
    - BFX
    - RRT
    - ZEC
    - BCN
    - DASH
    - DOGE
    - DSH
    - EMC
    - FCN
    - LSK
    - NXT
    - QCN
    - SDB
    - SCB
    - STEEM
    - XDN
    - XEM
    - XMR
    - ARDR
    - WAVES
    - BTU
    - MAID
    - AMP

  * WebClientUsername and WebClientPassword - Username and password for [web UI](https://github.com/michaelgrosner/tribeca#web-ui) access. If kept as `NULL`, no the web client will not require authentication (Not recommended at all!!)

Input your exchange connectivity information, account information, and API keys in the config properties for the exchange you intend on trading on.

### Develop

`npm install -g eslint eslint-config-egg`

### Application Usage

1. Open your web browser to connect to port 3000 of the machine running tribeca. If you're running tribeca locally on Mac/Windows on Docker, replace "localhost" with the address returned by `boot2docker ip`.

2. Read up on how to use tribeca and market making in the [wiki](https://github.com/michaelgrosner/tribeca/wiki).

3. Set up trading parameters to your liking in the web UI. Click the "BTC/USD" button so it is green to start making markets.

### Web UI

Once `tribeca` is up and running, visit port `3000` of the machine on which it is running to view the admin view. There are inputs for quoting parameters, grids to display market orders, market trades, your trades, your order history, your positions, and a big button with the currency pair you are trading. When you're ready, click that button green to begin sending out quotes. The UI uses a healthy mixture of socket.io and angularjs.

### REST API

Tribeca also exposes a REST API of all it's data. It's all the same data you would get via the Web UI, just a bit easier to connect up to via other applications. Visit `http://localhost:3000/data/md` for the current market data, for instance.

### TODO

TODO:

- Too many `fv`, `md`, `osr` (especially) saved in db

- 把策略和trade联系起来，记载数据库中，便于同时跑多个策略时候可以分析

1. Add new exchanges

2. Add new, smarter trading strategies (as always!)

3. Support for currency pairs which do not trade in $0.01 increments (LTC, DOGE)

4. More documentation

5. More performant UI

### How it works

主函数是`main.js`里的`harness()`

#### Live模式

调用`runTradingSystem()`, 主要看里面的`quoter`, `orderBroker`, `quotingEngine`, `quoteSender`。

在`new QuotingEngine()`中:

* 每1s调用`quotingEngine.recalcWithoutInputTime()`一次，计算quote。先获得一个`fair value`，和marketData, 再调用`quotingEngine.computeQuote(filteredMkt, fv)`。用当前缓存的quote和刚计算出来的新quote进行比较，只当新quote“更优”情况下更新缓存的quote。

* `quotingEngine.computeQuote(filteredMkt, fv)`: 根据设置的`mode`从`_registry`中选择一个`quoteStyle`，由`quoteStyle.GenerateQuote(input)`来生成一个unrounded的quote。这里可以灵活地添加不同的策略，放到`QuoteStyle`中，对应不同的`mode`。unrounded quote生成以后：

  - 检测是否需要做`ewmaProtection`处理。

  - 再根据`target base position`和设置中的`positionDivergence`参数， 检测当前的position是否偏离过大。如果已经偏离过大，就会把可能造成更大偏离的quote设成null。如果设置中的`aggressivePositionRebalancing`是`true`，触发rebalance, 调整仓位。

  - 进行safety check。safety的相关数据是从成交的trades获得。如果`safety.sell`或`safety.buy`已经大于设置中的`tradesPerMinute`参数, 把相应方向的quote设成null。对于`PingPong`模式，需要检测quote的price，不要让ask的price过低或者bid的price过高。

  - 根据报价和单子size的精度，对quote进行round down。

* 在`latestQuote`的setter中，触发`quotingEngine.QuoteChanged`事件。

在`new QuoteSender()`中:

* 监听`quotingEngine.QuoteChanged`事件，回调`quoteSender.sendQuote()`。

* `quoteSender.sendQuote()`：

  - 检测是否有足够对应的position

  - 检测是否是crossed quote

  - 如果都通过了以上检测，状态从Held改到Live。调用`quoter.updateQuote()`, 继而调用 `exchangeQuoter.updateQuote`。在`exchangeQuoter.updateQuote`中，根据`exchangeQuoter._activeQuote`调用exchangeQuoter.modify(q)或start(q)。start会把quote通过 `exchangeQuoter._broker<IOrderBroker>.sendOrder`发给交易所。而modify会取消之前quote对应的在交易所上的挂单，再重新调用start

  - 如果未通过以上检测，则取消之前quote对应的在交易所的挂单。

在`new Quoter()`中：

* 初始化bid和ask的两个ExchangeQuoter instances

* exchangeQuoter中监听`orderBroker.OrderUpdate`事件，回调`exchangeQuoter.handleOrderUpdate`。 把`exchangeQuoter._activeQuote`设为null，并在quotesSent的数组里面删掉对应的quote。
