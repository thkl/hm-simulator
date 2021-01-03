const path = require('path')
const fs = require('fs')
const commander = require('commander')
const HMInterface = require('hm-interface')
const Simulator = require(path.join(__dirname, 'lib', 'Simulator.js'))
const logger = require(path.join(__dirname, 'lib', 'Logger.js')).logger('Main')

let configurationFile = process.env.CFG

commander.option('-D, --debug', 'turn on debug level logging', () => {
  logger.setDebugEnabled(true)
  HMInterface.logger.setDebugEnabled(true)
})

commander.option('-C, --configuration [file]', 'set configuration file (also configurable with ENV CFG', (configuration) => {
  configurationFile = configuration
})

commander.parse(process.argv)

process.on('uncaughtException', (err) => {
  // Write a crashlog
  let crashFile = path.join('/', 'var', 'log', Date.now() + '.crash')
  var msg = 'Error log : ' + new Date() + '\n\n'
  msg = msg + err.stack
  console.error(msg)
  fs.access(crashFile, fs.constants.W_OK, (err) => {
    if (!err) {
      fs.writeFileSync(crashFile, msg)
    }
  })
  process.exit(1) // mandatory (as per the Node docs)
})

process.on('unhandledRejection', (reason, p) => {
  console.log(p)
  console.log(reason.stack)
})

console.log('Running as console')

let logFile = path.join('/', 'var', 'log', 'ccusim.log')

fs.access(logFile, fs.constants.W_OK, (err) => {
  if (!err) {
    logger.setLogFile(logFile)
  }
})

let sim = new Simulator()
logger.info(configurationFile)
sim.init(configurationFile)
