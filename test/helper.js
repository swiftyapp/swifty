var path = require('path');

module.exports = {
  appPath: function() {
    switch (process.platform) {
      case 'darwin':
        return path.join(__dirname, '..', '.tmp', 'mac', 'Swifty.app', 'Contents', 'MacOS', 'Swifty');
      case 'linux':
        return path.join(__dirname, '..', '.tmp', 'linux', 'Swifty');
      default:
        throw 'Unsupported platform';
    }
  }
};
