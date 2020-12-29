const path = require('path')
const HMInterface = require('hm-interface').HomematicInterface
const logger = require(path.join(__dirname, 'Logger.js')).logger('HMInterfaceManager')
module.exports = class HMInterfaceManager {
  constructor (dataFolder) {
    this.dataFolder = dataFolder
    this.interfaceList = {}
    this.devices = [] // this will take the behavoid classes
  }

  addInterface (options) {
    let self = this
    logger.info('Adding interface %s', options.name)
    return new Promise(async (resolve, reject) => {
      let hmInterface = new HMInterface(options)
      self.interfaceList[options.name] = {name: options.name, host: options.localIp, port: options.localPort, url: '/', object: hmInterface}
      await hmInterface.init()
      resolve()
    })
  }

  getInterfaceList () {
    return this.interfaceList
  }

  setDevices (testdata) {
    let self = this
    Object.keys(testdata).forEach((intfName) => {
      let ifObject = self.interfaceList[intfName]
      if (ifObject) {
        let hmInterface = ifObject.object
        let devList = testdata[intfName]
        if (devList !== undefined) {
          Object.keys(devList).forEach(deviceAdr => {
            let devObj = devList[deviceAdr]
            let devType = devObj.type
            let devBehv = devObj.behavoir
            logger.debug('searching for Device type %s', devType)
            let devData = require(path.join(self.dataFolder, devType + '.json'))
            let device = hmInterface.initDevice('Sim_' + intfName, deviceAdr, devType, devData)

            if (devBehv !== undefined) {
              logger.debug('adding behavoir %s to %s', devBehv, deviceAdr)
              let BClazz = require(path.join(self.dataFolder, devBehv + '.js'))
              let bObj = new BClazz(deviceAdr)
              // this is the event from the interface
              device.on('device_channel_value_change', (eventParameter) => {
                logger.debug('setValue Event from Interface %s %s %s', eventParameter.channel, eventParameter.name, eventParameter.newValue)
                bObj.setValue(eventParameter.channel, eventParameter.name, eventParameter.newValue)
              })
              // this is the event from the simulated device
              bObj.on('setValue', (adr, parameterName, newValue, force) => {
                let channel = device.getChannel(adr)
                if (channel) {
                // send the new value to the interface
                  channel.updateValue(parameterName, newValue, true, force || false, false)
                }
              })
              self.devices.push(bObj)
            } else {
              logger.debug('no  behavoir found for  %s', deviceAdr)
            }
          })
        }
      } else {
        logger.error('Interface %s not found', intfName)
        logger.warn('Interfaces available %s', JSON.stringify(Object.keys(self.interfaceList)))
      }
    })
  }

  runDeviceInit () {
    logger.info('running all inits')
    this.devices.forEach(bObj => {
      bObj.init()
    })
  }
}
