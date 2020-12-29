const DeviceBehavior = require('./be_master.js')
module.exports = class Behavior extends DeviceBehavior {
  init () {
    let self = this
    setInterval(() => {
      // setup some values
      self.emit('setValue', self.address + ':1', 'ACTUAL_TEMPERATURE', self.randomNum(-20, 30))
      self.emit('setValue', self.address + ':1', 'HUMIDITY', self.randomNum(10, 80))
      self.emit('setValue', self.address + ':1', 'ILLUMINATION', self.randomNum(0, 1200))
      self.emit('setValue', self.address + ':1', 'SUNSHINEDURATION', self.randomNum(0, 10))
      self.emit('setValue', self.address + ':1', 'WIND_SPEED', self.randomNum(0, 200))
    }, 2000)
  }

  randomNum (min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min
  }

  setValue (evAddress, dp, value) {

  }
}
