const http = require('http')
const url = require('url')
const vm = require('vm')
const path = require('path')
const RegaObjects = require(path.join(__dirname, 'RegaObjects.js'))
const logger = require(path.join(__dirname, 'Logger.js')).logger('RegaSim')
const xmlrpc = require('homematic-xmlrpc')

module.exports = class Rega {
  constructor (storagePath) {
    let self = this
    this.storagePath = storagePath
    logger.info('RegaHss Simulator is starting')
    this.ifClients = {}
    logger.info('Creating new RegaDOM')
    this.dom = new RegaObjects.RegaDOM(storagePath)
    function serverHandler (request, response) {
      if (request.url === '/tclrega.exe' && request.method.toLowerCase() === 'post') {
        var body = ''
        request.on('data', (data) => {
          body += data
          if (body.length > 1e6) {
            request.connection.destroy()
          }
        })

        request.on('end', () => {
          self.processApiCall(body, response)
        })
      } else {
        response.end('401')
      }
    }

    this.createEventServer()
    this.serviceDPs = []
    this.server = http.createServer(serverHandler)
    this.server.listen(8181, () => {})
  }

  processApiCall (body, response) {
    let self = this

    body = body.replace(/\\'/g, '\'')
    body = body.replace(/\\"/g, '"')
    body = body.replace(/object /g, 'var ')
    body = body.replace(/string /g, 'var ')
    body = body.replace(/boolean /g, 'var ')
    body = body.replace(/ # /g, ' + ')

    if (body.indexOf('!interfaces') === 0) {
      // return interfaceList
      let result = []
      this.dom._interfaceList().forEach(ifElement => {
        result.push({id: ifElement.ID(), name: ifElement.Name(), type: ifElement.Type(), typename: ifElement.TypeName(), info: ifElement.InterfaceInfo, url: ifElement.InterfaceUrl()})
      })
      self.sendResponse(response, JSON.stringify({interfaces: result}))
      return
    }

    //! subsections

    //! rooms
    if (body.indexOf('!rooms') === 0) {
      // return RoomList
      let result = []
      this.dom._roomList().forEach(rmElement => {
        let chnR = []
        let chn = rmElement.Channels().EnumIDs().split('\t')
        chn.forEach(channelNumber => {
          chnR.push(parseInt(channelNumber))
        })
        result.push({id: rmElement.ID(), name: rmElement.Name(), channels: chnR})
      })
      self.sendResponse(response, JSON.stringify({rooms: result}))
      return
    }

    //! programs
    if (body.indexOf('!programs') === 0) {
      let result = []
      this.dom._programList().forEach(prgElement => {
        result.push({id: prgElement.ID(), name: prgElement.Name(), dpInfo: prgElement.PrgInfo()})
      })
      self.sendResponse(response, JSON.stringify({devices: result}))
      return
    }
    //! variables
    if (body.indexOf('!variables') === 0) {
      let result = []
      this.dom._variableList().forEach(varElement => {
        result.push({id: varElement.ID(),
          name: varElement.Name(),
          dpInfo: varElement.DPInfo(),
          unerasable: varElement.Unerasable(),
          valuetype: varElement.ValueType(),
          subtype: varElement.ValueSubType(),
          minvalue: varElement.ValueMin(),
          maxvalue: varElement.ValueMax(),
          unit: varElement.ValueUnit()})
      })
      self.sendResponse(response, JSON.stringify({devices: result}))
      return
    }
    //! devices
    if (body.indexOf('!devices') === 0) {
      let result = []
      this.dom._deviceList().forEach(dvElement => {
        let d = {id: dvElement.ID(), name: dvElement.Name(), address: dvElement.Address(), type: dvElement.HssType(), channels: []}
        dvElement._children.forEach(cid => {
          let c = self.dom._channelWithId(cid)
          if (c) {
            let cData = {id: cid, name: c.Name(), intf: dvElement.Interface(), address: c.Address(), type: c.HssType(), access: c.UserAccessRights(7)}
            d.channels.push(cData)
          }
        })
        result.push(d)
      })
      self.sendResponse(response, JSON.stringify({devices: result}))
      return
    }

    try {
      let script = new vm.Script(body)
      this.runScript(script, response)
    } catch (e) {
      logger.error(e.stack)
    }
  }

  stringify (object) {
    if (object) {
      switch (object.constructor.name) {
        case 'RegaList':
          return object.toString()

        default:
          return object.name
      }
    }
  }

  sendResponse (response, message, variables) {
    let msg = message
    let result = [
      ['exec', '/tclrega.exe'],
      ['sessionId', ''],
      ['httpUserAgent', 'User-Agent: RegaSim a CCU Simulator (https://github.com/thkl/)']
    ]
    if (variables) {
      Object.keys(variables).forEach(variable => {
        result.push([variable, variables[variable]])
      })
    }
    msg += '<xml>'

    result.forEach(keyValue => {
      const [key, value] = keyValue
      msg += `<${key}>${value}</${key}>`
    })

    msg += '</xml>'
    response.end(msg)
  }

  runScript (script, response) {
    let self = this
    let outBuffer = ''

    var Sandbox = {
      dom: self.dom,
      root: self.dom._root,
      ID_SYSTEM_VARIABLES: 27,

      Write: function SandboxWrite (msg) {
        if (typeof msg === 'object') {
          outBuffer = outBuffer + self.stringify(msg)
        } else {
          outBuffer = outBuffer + msg
        }
      },

      WriteLine: function (msg) {
        Sandbox.Write(msg)
        outBuffer = outBuffer + '\n'
      },

      foreach: function (cntO, arts, callback) {
        arts.split('\t').forEach((part) => callback(part))
      }
    }

    let context = vm.createContext(Sandbox)
    try {
      let objs = Object.keys(Sandbox)
      script.runInContext(context)
      let outputVars = {}
      Object.keys(context).forEach((item) => {
        if (objs.indexOf(item) === -1) {
          let rslt = context[item].toString()
          outputVars[item] = rslt
        }
      })
      self.sendResponse(response, outBuffer, outputVars)
    } catch (e) {
      self.sendResponse(response, 'Error while running the script' + e)
    }
  }

  addInterface (regaid, name, host, port) {
    let self = this
    return new Promise(async (resolve, reject) => {
      logger.info('Adding Interface %s', name)
      let intf = self.dom.CreateObject('INTERFACE', regaid)
      intf.Name(name)
      intf.InterfaceUrl('xmlrpc://' + host + ':' + port)
      intf.InterfaceInfo(name)
      self.dom.Save()

      await self.connectInterface(intf)
      logger.info('addInterfaceCompleted')
      resolve()
    })
  }

  createEventServer () {
    let self = this
    let eventServer = xmlrpc.createServer({host: '127.0.0.1', port: 2000})
    eventServer.on('event', (err, params, callback) => {
      if (err) {
        logger.error('on event', err)
      } else {
        self.handleEvent('event', params)
      }
      callback(null)
    })

    eventServer.on('system.multicall', (err, params, callback) => {
      if (err) {
        logger.error('on event', err)
      } else {
        params.map((events) => {
          try {
            events.map((event) => {
              self.handleEvent(event.methodName, event.params)
            })
          } catch (err) { }
        })
      }
      callback(null)
    })
  }

  handleEvent (method, params) {
    if ((method === 'event') && (params !== undefined)) {
      let ifid = params[0]
      let channel = params[1]
      let datapoint = params[2]
      let value = params[3]

      let rgx = /([a-zA-Z0-9-]{1,}).([a-zA-Z0-9-]{1,}):([0-9]{1,}).([a-zA-Z0-9-_]{1,})/g
      let parts = rgx.exec(ifid + '.' + channel + '.' + datapoint)
      if ((parts) && (parts.length > 4)) {
        let address = parts[2]
        let chidx = parts[3]
        let evadr = ifid + '.' + address + ':' + chidx + '.' + datapoint
        logger.debug('rpc event for %s with value %s', evadr, value)
        let dp = this.dom.GetObject(evadr)
        if (dp) {
          logger.debug('set Value of %s to %s', dp.Name(), value)
          dp.Value(value, true) // set the event inhibit flag to prevent loops
        }
      }
    }
  }

  addRoom (name, channels) {
    let self = this
    let room = this.dom.CreateObject('ROOM')
    room.Name(name)
    channels.forEach(chName => {
      let chObject = self.dom.GetObject(chName)
      if (chObject) {
        room.Channels().Add(chObject.ID())
      } else {
        logger.warn('object with name %s not found in dom', chName)
      }
    })
    this.dom.Save()
  }

  loadDevices (intf, list) {
    let self = this
    return new Promise(async (resolve, reject) => {
      if (list) {
        let ifID = intf.ID()
        let ifName = intf.Name()
        logger.debug('loading %s objects from %s', list.length, intf.Name())
        let addDeviceActions = list.map(async (object) => {
        // query the dom
          if (object.ADDRESS.indexOf(':') === -1) {
            let rdev = self.dom.getDeviceWithAddress(object.ADDRESS)
            if (rdev === null) {
              logger.info('add new Device Object')
              rdev = self.dom.CreateObject('DEVICE')
              rdev.Address(object.ADDRESS)
              rdev.HssType(object.TYPE)
              rdev.Name(rdev.HssType() + ' ' + object.ADDRESS)
              rdev.Interface(ifID)
              self.dom.Add(rdev.ID())
            }
          } else {
          // its a channel
            let rchan = self.dom.getChannelWithAddress(object.ADDRESS)
            let parId = object.ADDRESS.split(':')[0]
            if (rchan === null) {
              rchan = self.dom.CreateObject('CHANNEL')

              rchan.Address(object.ADDRESS)
              rchan.HssType(object.TYPE)
              rchan.UserAccessRights(7, 255)
              self.dom.Add(rchan.ID())
              let values = await self.callInterfaceMethod(ifName, 'getParamsetDescription', [object.ADDRESS, 'VALUES'])
              if (values) {
                Object.keys(values).forEach(dpName => {
                  let rDP = self.dom.CreateObject('DP')
                  let dpFullName = intf.Name() + '.' + object.ADDRESS + '.' + dpName
                  rDP.HssDP(dpName)
                  rDP.Name(dpFullName)
                  self.dom.Add(rDP.ID())
                  rchan._addDataPoint(rDP)
                })
              }
              self.dom.Save()
            }
            // fetch the device and add the cannel
            let rdev = self.dom.getDeviceWithAddress(parId)
            if (rdev) {
              rchan.Name(rdev.HssType() + ' ' + rchan.Address())
              if (rdev.Channels().EnumIDs().split('\t').indexOf(rchan.ID()) === -1) {
                rdev.Channels().Add(rchan.ID())
              }
            }
          }
        })

        await Promise.all(addDeviceActions)
        resolve()
      }
    })
  }

  connectInterface (intf) {
    let self = this
    return new Promise((resolve, reject) => {
      logger.info('Connecting to interface %s on URL', intf.InterfaceInfo(), intf.InterfaceUrl())
      let ifUrl = intf.InterfaceUrl()
      ifUrl = ifUrl.replace('xmlrpc://', 'http://').replace('xmlrpc_bin://', 'http://')
      let oUrl = url.parse(ifUrl)
      let client = xmlrpc.createClient({host: oUrl.hostname, port: oUrl.port, path: oUrl.pathname, cookies: false})
      self.ifClients[intf.Name()] = client
      logger.debug('Init Call')
      client.methodCall('init', ['xmlrpc://127.0.0.1:2000', intf.Name()], (error, value) => {
        if (!error) {
        // load devices
          logger.info('asking %s for devices', intf.Name())
          client.methodCall('listDevices', [intf.Name()], async (error, value) => {
            if (!error) {
              await self.loadDevices(intf, value)
              logger.info('interface %s connected', intf.Name())
              resolve()
            } else {
              self.logger.error(error)
              reject(error)
            }
          })
        } else {
          self.logger.error(error)
          reject(error)
        }
      })
    })
  }

  callInterfaceMethod (ifID, method, params) {
    return new Promise((resolve, reject) => {
      let client = this.ifClients[ifID]
      if (client) {
        logger.debug('methodCall ', ifID, method, JSON.stringify(params))
        client.methodCall(method, params, (err, result) => {
          if (err) {
            reject(err)
          } else {
            resolve(result)
          }
        })
      } else {
        logger.error('No Client found %s', ifID)
        console.log(this.ifClients)
        reject(new Error('no client found'))
      }
    })
  }

  run () {
    let self = this
    this.dom.on('setValue', (dpName, newValue) => {
      logger.debug('RegaSetValue Event ', dpName, newValue)
      // Split the datapoint
      let parts = dpName.split('.')
      if (parts.length > 2) {
        let idfId = parts[0]
        let chnadr = parts[1]
        let dp = parts[2]
        // get the interface
        self.callInterfaceMethod(idfId, 'setValue', [chnadr, dp, newValue])
        // Check unreach
        if (dp === 'UNREACH') {
          let dp = this.dom.GetObject(dpName)
          if (dp) {
            if (newValue === true) {
              this.dom._addServiceMessage(dpName, 'UNREACH')
            }
          }
        }
      }
    })
  }
}
