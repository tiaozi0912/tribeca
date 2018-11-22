'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const moment = require('moment');
class Timestamped {
  constructor(data, time) {
    this.data = data;
    this.time = time;
  }
  toString() {
    return 'time=' + toUtcFormattedTime(this.time) + ';data=' + this.data;
  }
}
exports.Timestamped = Timestamped;
class MarketSide {
  constructor(price, size) {
    this.price = price;
    this.size = size;
  }
  toString() {
    return 'px=' + this.price + ';size=' + this.size;
  }
}
exports.MarketSide = MarketSide;
class GatewayMarketTrade {
  constructor(price, size, time, onStartup, make_side) {
    this.price = price;
    this.size = size;
    this.time = time;
    this.onStartup = onStartup;
    this.make_side = make_side;
  }
}
exports.GatewayMarketTrade = GatewayMarketTrade;
function marketSideEquals(t, other, tol) {
  tol = tol || 1e-4;
  if (other == null) { return false; }
  return Math.abs(t.price - other.price) > tol && Math.abs(t.size - other.size) > tol;
}
exports.marketSideEquals = marketSideEquals;
class Market {
  constructor(bids, asks, time) {
    this.bids = bids;
    this.asks = asks;
    this.time = time;
  }
  toString() {
    return 'asks: [' + this.asks.join(';') + '] bids: [' + this.bids.join(';') + ']';
  }
}
exports.Market = Market;
class MarketTrade {
  constructor(exchange, pair, price, size, time, quote, bid, ask, make_side) {
    this.exchange = exchange;
    this.pair = pair;
    this.price = price;
    this.size = size;
    this.time = time;
    this.quote = quote;
    this.bid = bid;
    this.ask = ask;
    this.make_side = make_side;
  }
}
exports.MarketTrade = MarketTrade;
let Currency;
(function(Currency) {
  Currency[Currency.USD = 0] = 'USD';
  Currency[Currency.BTC = 1] = 'BTC';
  Currency[Currency.LTC = 2] = 'LTC';
  Currency[Currency.EUR = 3] = 'EUR';
  Currency[Currency.GBP = 4] = 'GBP';
  Currency[Currency.CNY = 5] = 'CNY';
  Currency[Currency.ETH = 6] = 'ETH';
  Currency[Currency.BFX = 7] = 'BFX';
  Currency[Currency.RRT = 8] = 'RRT';
  Currency[Currency.ZEC = 9] = 'ZEC';
  Currency[Currency.BCN = 10] = 'BCN';
  Currency[Currency.DASH = 11] = 'DASH';
  Currency[Currency.DOGE = 12] = 'DOGE';
  Currency[Currency.DSH = 13] = 'DSH';
  Currency[Currency.EMC = 14] = 'EMC';
  Currency[Currency.FCN = 15] = 'FCN';
  Currency[Currency.LSK = 16] = 'LSK';
  Currency[Currency.NXT = 17] = 'NXT';
  Currency[Currency.QCN = 18] = 'QCN';
  Currency[Currency.SDB = 19] = 'SDB';
  Currency[Currency.SCB = 20] = 'SCB';
  Currency[Currency.STEEM = 21] = 'STEEM';
  Currency[Currency.XDN = 22] = 'XDN';
  Currency[Currency.XEM = 23] = 'XEM';
  Currency[Currency.XMR = 24] = 'XMR';
  Currency[Currency.ARDR = 25] = 'ARDR';
  Currency[Currency.WAVES = 26] = 'WAVES';
  Currency[Currency.BTU = 27] = 'BTU';
  Currency[Currency.MAID = 28] = 'MAID';
  Currency[Currency.AMP = 29] = 'AMP';
})(Currency = exports.Currency || (exports.Currency = {}));
function toCurrency(c) {
  return Currency[c.toUpperCase()];
}
exports.toCurrency = toCurrency;
function fromCurrency(c) {
  const t = Currency[c];
  if (t) { return t.toUpperCase(); }
  return undefined;
}
exports.fromCurrency = fromCurrency;
let GatewayType;
(function(GatewayType) {
  GatewayType[GatewayType.MarketData = 0] = 'MarketData';
  GatewayType[GatewayType.OrderEntry = 1] = 'OrderEntry';
  GatewayType[GatewayType.Position = 2] = 'Position';
})(GatewayType = exports.GatewayType || (exports.GatewayType = {}));
let ConnectivityStatus;
(function(ConnectivityStatus) {
  ConnectivityStatus[ConnectivityStatus.Connected = 0] = 'Connected';
  ConnectivityStatus[ConnectivityStatus.Disconnected = 1] = 'Disconnected';
})(ConnectivityStatus = exports.ConnectivityStatus || (exports.ConnectivityStatus = {}));
let Exchange;
(function(Exchange) {
  Exchange[Exchange.Null = 0] = 'Null';
  Exchange[Exchange.HitBtc = 1] = 'HitBtc';
  Exchange[Exchange.OkCoin = 2] = 'OkCoin';
  Exchange[Exchange.AtlasAts = 3] = 'AtlasAts';
  Exchange[Exchange.BtcChina = 4] = 'BtcChina';
  Exchange[Exchange.Coinbase = 5] = 'Coinbase';
  Exchange[Exchange.Bitfinex = 6] = 'Bitfinex';
})(Exchange = exports.Exchange || (exports.Exchange = {}));
let Side;
(function(Side) {
  Side[Side.Bid = 0] = 'Bid';
  Side[Side.Ask = 1] = 'Ask';
  Side[Side.Unknown = 2] = 'Unknown';
})(Side = exports.Side || (exports.Side = {}));
let OrderType;
(function(OrderType) {
  OrderType[OrderType.Limit = 0] = 'Limit';
  OrderType[OrderType.Market = 1] = 'Market';
})(OrderType = exports.OrderType || (exports.OrderType = {}));
let TimeInForce;
(function(TimeInForce) {
  TimeInForce[TimeInForce.IOC = 0] = 'IOC';
  TimeInForce[TimeInForce.FOK = 1] = 'FOK';
  TimeInForce[TimeInForce.GTC = 2] = 'GTC';
})(TimeInForce = exports.TimeInForce || (exports.TimeInForce = {}));
let OrderStatus;
(function(OrderStatus) {
  OrderStatus[OrderStatus.New = 0] = 'New';
  OrderStatus[OrderStatus.Working = 1] = 'Working';
  OrderStatus[OrderStatus.Complete = 2] = 'Complete';
  OrderStatus[OrderStatus.Cancelled = 3] = 'Cancelled';
  OrderStatus[OrderStatus.Rejected = 4] = 'Rejected';
  OrderStatus[OrderStatus.Other = 5] = 'Other';
})(OrderStatus = exports.OrderStatus || (exports.OrderStatus = {}));
let Liquidity;
(function(Liquidity) {
  Liquidity[Liquidity.Make = 0] = 'Make';
  Liquidity[Liquidity.Take = 1] = 'Take';
})(Liquidity = exports.Liquidity || (exports.Liquidity = {}));
exports.orderIsDone = status => {
  switch (status) {
    case OrderStatus.Complete:
    case OrderStatus.Cancelled:
    case OrderStatus.Rejected:
      return true;
    default:
      return false;
  }
};
let MarketDataFlag;
(function(MarketDataFlag) {
  MarketDataFlag[MarketDataFlag.Unknown = 0] = 'Unknown';
  MarketDataFlag[MarketDataFlag.NoChange = 1] = 'NoChange';
  MarketDataFlag[MarketDataFlag.First = 2] = 'First';
  MarketDataFlag[MarketDataFlag.PriceChanged = 4] = 'PriceChanged';
  MarketDataFlag[MarketDataFlag.SizeChanged = 8] = 'SizeChanged';
  MarketDataFlag[MarketDataFlag.PriceAndSizeChanged = 16] = 'PriceAndSizeChanged';
})(MarketDataFlag = exports.MarketDataFlag || (exports.MarketDataFlag = {}));
let OrderSource;
(function(OrderSource) {
  OrderSource[OrderSource.Unknown = 0] = 'Unknown';
  OrderSource[OrderSource.Quote = 1] = 'Quote';
  OrderSource[OrderSource.OrderTicket = 2] = 'OrderTicket';
})(OrderSource = exports.OrderSource || (exports.OrderSource = {}));
class SubmitNewOrder {
  constructor(side, quantity, type, price, timeInForce, exchange, generatedTime, preferPostOnly, source, msg) {
    this.side = side;
    this.quantity = quantity;
    this.type = type;
    this.price = price;
    this.timeInForce = timeInForce;
    this.exchange = exchange;
    this.generatedTime = generatedTime;
    this.preferPostOnly = preferPostOnly;
    this.source = source;
    this.msg = msg;
    this.msg = msg || null;
  }
}
exports.SubmitNewOrder = SubmitNewOrder;
class CancelReplaceOrder {
  constructor(origOrderId, quantity, price, exchange, generatedTime) {
    this.origOrderId = origOrderId;
    this.quantity = quantity;
    this.price = price;
    this.exchange = exchange;
    this.generatedTime = generatedTime;
  }
}
exports.CancelReplaceOrder = CancelReplaceOrder;
class OrderCancel {
  constructor(origOrderId, exchange, generatedTime) {
    this.origOrderId = origOrderId;
    this.exchange = exchange;
    this.generatedTime = generatedTime;
  }
}
exports.OrderCancel = OrderCancel;
class SentOrder {
  constructor(sentOrderClientId) {
    this.sentOrderClientId = sentOrderClientId;
  }
}
exports.SentOrder = SentOrder;
class Trade {
  constructor(tradeId, time, exchange, pair, price, quantity, side, value, liquidity, feeCharged) {
    this.tradeId = tradeId;
    this.time = time;
    this.exchange = exchange;
    this.pair = pair;
    this.price = price;
    this.quantity = quantity;
    this.side = side;
    this.value = value;
    this.liquidity = liquidity;
    this.feeCharged = feeCharged;
  }
}
exports.Trade = Trade;
class CurrencyPosition {
  constructor(amount, heldAmount, currency) {
    this.amount = amount;
    this.heldAmount = heldAmount;
    this.currency = currency;
  }
  toString() {
    return 'currency=' + Currency[this.currency] + ';amount=' + this.amount;
  }
}
exports.CurrencyPosition = CurrencyPosition;
class PositionReport {
  constructor(baseAmount, quoteAmount, baseHeldAmount, quoteHeldAmount, value, quoteValue, pair, exchange, time) {
    this.baseAmount = baseAmount;
    this.quoteAmount = quoteAmount;
    this.baseHeldAmount = baseHeldAmount;
    this.quoteHeldAmount = quoteHeldAmount;
    this.value = value;
    this.quoteValue = quoteValue;
    this.pair = pair;
    this.exchange = exchange;
    this.time = time;
  }
}
exports.PositionReport = PositionReport;
class OrderRequestFromUI {
  constructor(side, price, quantity, timeInForce, orderType) {
    this.side = side;
    this.price = price;
    this.quantity = quantity;
    this.timeInForce = timeInForce;
    this.orderType = orderType;
  }
}
exports.OrderRequestFromUI = OrderRequestFromUI;
class FairValue {
  constructor(price, time) {
    this.price = price;
    this.time = time;
  }
}
exports.FairValue = FairValue;
let QuoteAction;
(function(QuoteAction) {
  QuoteAction[QuoteAction.New = 0] = 'New';
  QuoteAction[QuoteAction.Cancel = 1] = 'Cancel';
})(QuoteAction = exports.QuoteAction || (exports.QuoteAction = {}));
let QuoteSent;
(function(QuoteSent) {
  QuoteSent[QuoteSent.First = 0] = 'First';
  QuoteSent[QuoteSent.Modify = 1] = 'Modify';
  QuoteSent[QuoteSent.UnsentDuplicate = 2] = 'UnsentDuplicate';
  QuoteSent[QuoteSent.Delete = 3] = 'Delete';
  QuoteSent[QuoteSent.UnsentDelete = 4] = 'UnsentDelete';
  QuoteSent[QuoteSent.UnableToSend = 5] = 'UnableToSend';
})(QuoteSent = exports.QuoteSent || (exports.QuoteSent = {}));
class Quote {
  constructor(price, size) {
    this.price = price;
    this.size = size;
  }
}
exports.Quote = Quote;
class TwoSidedQuote {
  constructor(bid, ask, time) {
    this.bid = bid;
    this.ask = ask;
    this.time = time;
  }
}
exports.TwoSidedQuote = TwoSidedQuote;
let QuoteStatus;
(function(QuoteStatus) {
  QuoteStatus[QuoteStatus.Live = 0] = 'Live';
  QuoteStatus[QuoteStatus.Held = 1] = 'Held';
})(QuoteStatus = exports.QuoteStatus || (exports.QuoteStatus = {}));
class SerializedQuotesActive {
  constructor(active, time) {
    this.active = active;
    this.time = time;
  }
}
exports.SerializedQuotesActive = SerializedQuotesActive;
class TwoSidedQuoteStatus {
  constructor(bidStatus, askStatus) {
    this.bidStatus = bidStatus;
    this.askStatus = askStatus;
  }
}
exports.TwoSidedQuoteStatus = TwoSidedQuoteStatus;
class CurrencyPair {
  constructor(base, quote) {
    this.base = base;
    this.quote = quote;
  }
  toString() {
    return Currency[this.base] + '/' + Currency[this.quote];
  }
}
exports.CurrencyPair = CurrencyPair;
function currencyPairEqual(a, b) {
  return a.base === b.base && a.quote === b.quote;
}
exports.currencyPairEqual = currencyPairEqual;
let QuotingMode;
(function(QuotingMode) {
  QuotingMode[QuotingMode.Top = 0] = 'Top';
  QuotingMode[QuotingMode.Mid = 1] = 'Mid';
  QuotingMode[QuotingMode.Join = 2] = 'Join';
  QuotingMode[QuotingMode.InverseJoin = 3] = 'InverseJoin';
  QuotingMode[QuotingMode.InverseTop = 4] = 'InverseTop';
  QuotingMode[QuotingMode.PingPong = 5] = 'PingPong';
  QuotingMode[QuotingMode.Depth = 6] = 'Depth';
})(QuotingMode = exports.QuotingMode || (exports.QuotingMode = {}));
let FairValueModel;
(function(FairValueModel) {
  FairValueModel[FairValueModel.BBO = 0] = 'BBO';
  FairValueModel[FairValueModel.wBBO = 1] = 'wBBO';
})(FairValueModel = exports.FairValueModel || (exports.FairValueModel = {}));
let AutoPositionMode;
(function(AutoPositionMode) {
  AutoPositionMode[AutoPositionMode.Off = 0] = 'Off';
  AutoPositionMode[AutoPositionMode.EwmaBasic = 1] = 'EwmaBasic';
})(AutoPositionMode = exports.AutoPositionMode || (exports.AutoPositionMode = {}));
class QuotingParameters {
  constructor(width, size, mode, fvModel, targetBasePosition, positionDivergence, ewmaProtection, autoPositionMode, aggressivePositionRebalancing, tradesPerMinute, tradeRateSeconds, longEwma, shortEwma, quotingEwma, aprMultiplier, stepOverSize) {
    this.width = width;
    this.size = size;
    this.mode = mode;
    this.fvModel = fvModel;
    this.targetBasePosition = targetBasePosition;
    this.positionDivergence = positionDivergence;
    this.ewmaProtection = ewmaProtection;
    this.autoPositionMode = autoPositionMode;
    this.aggressivePositionRebalancing = aggressivePositionRebalancing;
    this.tradesPerMinute = tradesPerMinute;
    this.tradeRateSeconds = tradeRateSeconds;
    this.longEwma = longEwma;
    this.shortEwma = shortEwma;
    this.quotingEwma = quotingEwma;
    this.aprMultiplier = aprMultiplier;
    this.stepOverSize = stepOverSize;
  }
}
exports.QuotingParameters = QuotingParameters;
function toUtcFormattedTime(t) {
  return (moment.isMoment(t) ? t : moment(t)).format('M/D/YY HH:mm:ss,SSS');
}
exports.toUtcFormattedTime = toUtcFormattedTime;
function veryShortDate(t) {
  return (moment.isMoment(t) ? t : moment(t)).format('M/D');
}
exports.veryShortDate = veryShortDate;
function toShortTimeString(t) {
  return (moment.isMoment(t) ? t : moment(t)).format('HH:mm:ss,SSS');
}
exports.toShortTimeString = toShortTimeString;
class ExchangePairMessage {
  constructor(exchange, pair, data) {
    this.exchange = exchange;
    this.pair = pair;
    this.data = data;
  }
}
exports.ExchangePairMessage = ExchangePairMessage;
class ProductAdvertisement {
  constructor(exchange, pair, environment, minTick) {
    this.exchange = exchange;
    this.pair = pair;
    this.environment = environment;
    this.minTick = minTick;
  }
}
exports.ProductAdvertisement = ProductAdvertisement;
class Message {
  constructor(text, time) {
    this.text = text;
    this.time = time;
  }
}
exports.Message = Message;
class RegularFairValue {
  constructor(time, value) {
    this.time = time;
    this.value = value;
  }
}
exports.RegularFairValue = RegularFairValue;
class TradeSafety {
  constructor(buy, sell, combined, buyPing, sellPong, time) {
    this.buy = buy;
    this.sell = sell;
    this.combined = combined;
    this.buyPing = buyPing;
    this.sellPong = sellPong;
    this.time = time;
  }
}
exports.TradeSafety = TradeSafety;
class TargetBasePositionValue {
  constructor(data, time) {
    this.data = data;
    this.time = time;
  }
}
exports.TargetBasePositionValue = TargetBasePositionValue;
class CancelAllOrdersRequest {
  constructor() { }
}
exports.CancelAllOrdersRequest = CancelAllOrdersRequest;
// # sourceMappingURL=models.js.map
