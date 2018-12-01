'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const fs = require('fs');
const logging_1 = require('./logging');
class ConfigProvider {
  constructor() {
    this._config = {};
    this.Has = configKey => {
      return (this.Fetch(configKey, false, x => x)) !== null;
    };
    this.GetNumber = configKey => {
      return this.Fetch(configKey, true, x => {
        if (typeof x === 'number') { return x; }
        if (typeof x === 'string') { return parseFloat(x); }
        return parseFloat(x.toString());
      });
    };
    this.GetBoolean = configKey => {
      return this.Fetch(configKey, true, x => x == true || x == 'true');
    };
    this.GetString = configKey => {
      return this.Fetch(configKey, true, x => x.toString());
    };
    this.Fetch = (configKey, throwIfMissing, cvt) => {
      let value = null;
      if (process.env.hasOwnProperty(configKey)) { value = process.env[configKey]; } else if (this._config.hasOwnProperty(configKey)) { value = this._config[configKey]; } else if (throwIfMissing) { throw Error('Config does not have property ' + configKey); }
      const fetched = cvt(value);
      ConfigProvider.Log.info('%s = %s', configKey, fetched);
      return fetched;
    };
    this.inBacktestMode = false;
    console.log('TRIBECA_BACKTEST_MODE:', process.env.TRIBECA_BACKTEST_MODE);
    this.inBacktestMode = (process.env.TRIBECA_BACKTEST_MODE || 'false') === 'true';
    const configFile = process.env.TRIBECA_CONFIG_FILE || 'tribeca.json';
    if (fs.existsSync(configFile)) {
      this._config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    }
  }
}
ConfigProvider.Log = logging_1.default('tribeca:config');
exports.ConfigProvider = ConfigProvider;
// # sourceMappingURL=config.js.map
