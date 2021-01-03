const path = require('path')
const Rega = require(path.join(__dirname, 'Rega.js'))
const HMInterfaceManager = require(path.join(__dirname, 'HMInterfaceManager'))
const logger = require(path.join(__dirname, 'Logger.js')).logger('Core')

module.exports = class Simulator {
  init (testFile) {
    let self = this
    logger.info('CCU Sim Core startup')
    logger.info('Debug is enabled %s', logger.isDebugEnabled())

    this.ifList = []
    let home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
    let testPath = path.join(home, '.ccusim', 'data')
    self.interfaceManager = new HMInterfaceManager(testPath)
    logger.info('starting rega simulation from %s config is %s', testPath, testFile)
    self.rega = new Rega(testPath, self.debug)
    let testContent = require(path.join(testPath, testFile))

    logger.info('processing simulated configuration %s', JSON.stringify(testContent))
    logger.info('starting RPC Interface simulation')
    Object.keys(testContent.interfaces).forEach(async (ifName) => {
      let ifc = testContent.interfaces[ifName]
      if (ifc.onlyrega === true) {
        logger.info('adding external Interface ', ifc.host, ifc.port)
        await self.rega.addInterface(undefined, ifName, ifc.host, ifc.port)
        logger.info('external interface added', ifName)
      } else {
        let options = {
          name: ifName,
          localIp: ifc.host,
          localPort: ifc.port,
          ccuIP: '127.0.0.1'
        }
        await self.interfaceManager.addInterface(options)
        self.ifList.push(options)
      }
    })
    self.interfaceManager.setDevices(testContent.devices)

    setTimeout(async () => {
      logger.info('Adding interfaces to rega')
      await self.addRegaInterfaces()
      logger.info('adding simulated rooms')
      Object.keys(testContent.rooms).map(roomName => {
        self.rega.addRoom(roomName, testContent.rooms[roomName])
      })
      self.rega.run()
      self.interfaceManager.runDeviceInit()
      logger.info('CCU Sim is running')
    }, 1000)
  }

  addRegaInterfaces () {
    let self = this

    return new Promise(async (resolve, reject) => {
      let actions = self.ifList.map(async oInterface => {
        logger.info('adding interface ', oInterface.localIp, oInterface.localPort)
        await self.rega.addInterface(undefined, oInterface.name, oInterface.localIp, oInterface.localPort)
        logger.info('interface added', oInterface.name)
      })
      await Promise.all(actions)

      resolve()
    })
  }
}
