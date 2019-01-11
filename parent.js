require('events').EventEmitter.prototype._maxListeners = 100

const { fork, spawn } = require('child_process')
const diffy = require('diffy')
const trim = require('diffy/trim')
const diffyInput = require('diffy/input')

const { Machine, actions } = require('xstate')
const { interpret } = require('xstate/lib/interpreter')
const { assign } = actions

const getPort = require('get-port')

const rendezvousPorts = []
const numPeers = 2
const peers = []

const peerStates = {}

const aCharCode = 'a'.charCodeAt(0) // 97
for (let i = 0; i < numPeers; i++) {
  const peerLabel = String.fromCharCode(aCharCode + i)
  const peerLabelUpper = peerLabel.toUpperCase()
  const prevPeerLabel = String.fromCharCode(aCharCode + i - 1)
  const prevPeerLabelUpper = prevPeerLabel.toUpperCase()
  const lastPeerLabel = String.fromCharCode(aCharCode + numPeers - 1)
  const lastPeerLabelUpper = lastPeerLabel.toUpperCase()
  peerStates[`peer${peerLabelUpper}`] = {
    initial: 'not started',
    states: {
      'not started': {
        on: {
          NEXT: 'starting'
        }  
      },
      starting: {
        onEntry: () => { peers[peerLabel] = startPeer(peerLabel) },
        on: {
          NEXT: { actions: () => { peers[peerLabel].send('NEXT') } },
          [`PEER ${peerLabelUpper}:COLLABORATION CREATED`]: 'paused'
        }
      },
      paused: {
        on: {
          NEXT: {
            target: 'editing',
            cond: ctx => !i || ctx[`edited${prevPeerLabelUpper}`]
          }
        }
      },
      editing: {
        onEntry: () => { peers[peerLabel].send('NEXT') },
        on: {
          [`PEER ${peerLabelUpper}:DONE`]: 'done'
        }
      },
      done: {
        onEntry: assign({[`edited${peerLabelUpper}`]: true}),
        type: 'final'
      }
    }
  }
}

const machine = Machine({
  id: 'top',
  initial: 'initial',
  context: {},
  states: {
    initial: {
      on: {
        NEXT: 'peers'
      }
    },
    'peers': {
      id: 'peers',
      type: 'parallel',
      states: peerStates
    },
    done: {
      type: 'final'
    },
    failed: {
      type: 'final'
    }
  }
})

let state = ''
const log = []
const uiPeerStates = {}
for (let i = 0; i < numPeers; i++) {
  const peerLabel = String.fromCharCode(aCharCode + i)
  uiPeerStates[peerLabel] = { step: '', crdtValue: '' }
}

const d = diffy({fullscreen: true})

d.render(
  () => {
    let text = `State: ${state.slice(0, d.width - 8)}\n\n`

    let lines = 2
    for (let i = 0; i < numPeers; i++) {
      const peerLabel = String.fromCharCode(aCharCode + i)
      const peerLabelUpper = peerLabel.toUpperCase()
      text += `  ${peerLabelUpper}: ` +
        `Step: ${uiPeerStates[peerLabel].step}\n`
      const value = uiPeerStates[peerLabel].crdtValue
      if (typeof value === 'object') {
        value.forEach(mouse => {
          text += `    ${mouse.id}:${mouse.symbol} X:${mouse.x} Y:${mouse.y}\n`
        })
        lines += value.length
      }
      text += '\n'
      lines += 2
    }

    text += `Logs:\n` + log.slice(-(d.height - lines - 4)).join('\n')
    return text
  }
)

const input = diffyInput({showCursor: false})

const service = interpret(machine)
  .onTransition(nextState => {
    state = JSON.stringify(nextState.value)
    d.render()
  })
service.start()

input.on('keypress', (ch, key) => {
  switch (key.sequence) {
    case ' ':
      service.send('NEXT')
      break
    case 'q':
      process.exit(0)
      break
  }
})

function startPeer (peerLabel) {
  const peerLabelUpper = peerLabel.toUpperCase()
  const child = fork(`${__dirname}/child.js`, {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env,
      PEER_LABEL: peerLabel
    }
  })

  child.on('message', message => {
    if (message.stateMachine) {
      uiPeerStates[peerLabel].step = message.stateMachine
      service.send(
        `PEER ${peerLabelUpper}:` +
        `${message.stateMachine.toUpperCase()}`
      )
    }
    if (message.crdtValue) {
      uiPeerStates[peerLabel].crdtValue = message.crdtValue
    }
    d.render()
  })

  function appendToLog (chunk) {
    chunkToWidth(chunk.toString().replace(/\s+$/, '')).forEach(line => {
      log.push(`${peerLabelUpper}: ${line}`)
    })
    d.render()
  }
  child.stdout.on('data', appendToLog)
  child.stderr.on('data', appendToLog)

  process.on('exit', () => child.kill())
  return child
}

function appendToLog (msg) {
  chunkToWidth(msg).forEach(line => log.push(line))
  d.render()
}

function chunkToWidth (chunk) {
  return chunkString(chunk, d.width - 5)
}

function chunkString(str, length) {
  return str.match(new RegExp('.{1,' + length + '}', 'g'));
}
