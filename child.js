const { Machine } = require('xstate')
const { interpret } = require('xstate/lib/interpreter')

const delay = require('delay')

global.WebSocket = require('isomorphic-ws')

const SwarmDBImport = require('@swarm/db')
const { default: SwarmDB, InMemory: Storage, UUID, Verbose } = SwarmDBImport

const { mouseQuery, miceSubscription } = require('./graphql')

let swarm
let id
let mouse

const step = 10
const interval = 500
const maxXY = 300

const peerMachine = Machine({
  id: 'swarmJs',
  initial: 'new',
  states: {
    new: {
      onEntry: () => {
        swarm = new SwarmDB({
          storage: new Storage(),
          upstream: new Verbose('ws://10.0.1.19:31415'),
          db: {
            name: 'default',
            clockLen: 7,
          },
        })
      },
      on: {
        NEXT: 'starting'
      }
    },
    starting: {
      invoke: {
        id: 'startSwarm',
        src: () => swarm.ensure(),
        onDone: 'started',
        onError: 'failed'
      },
    },
    started: {
      on: {
        NEXT: 'create mouse'
      }
    },
    'create mouse': {
      invoke: {
        id: 'createMouse',
        src: async () => {
          mouse = new UUID('mouse', swarm.client.db.id, '$')
          await swarm.add('mice', mouse)

          // Hook up subscription
          await swarm.execute(
            {query: miceSubscription},
            update => {
              if (update.data) {
                const mice = update.data.result.list
                process.send({crdtValue: mice})
              }
            }
          )
        },
        onDone: 'mouse created',
        onError: 'failed'
      }
    },
    'mouse created': {
      on: {
        NEXT: 'move the mouse'
      }
    },
    'move the mouse': {
      invoke: {
        id: 'moveTheMouse',
        src: async () => {
          const symbol = process.env['PEER_LABEL'].slice(0, 1)
          const lowerLabel = process.env['PEER_LABEL'].slice(0, 1)
          const step = 10
          const interval = 500
          if (lowerLabel === 'a') {
            for (let x = 0, y = 0; x <= maxXY; x += step, y += step) {
              await swarm.set(mouse, {x, y, symbol})
              await delay(interval)
            }
          } else if (lowerLabel === 'b') {
            for (let x = 0, y = maxXY; x <= maxXY; x += step, y -= step) {
              await swarm.set(mouse, {x, y, symbol})
              await delay(interval)
            }
          }
        },
        onDone: 'done',
        onError: 'failed'
      }
    },
    done: {
      type: 'final'
    },
    failed: {
      type: 'final'
    }
  }
})

const service = interpret(peerMachine)
  .onTransition(nextState => {
    process.send({
      stateMachine: nextState.value
    })
  })
service.start()

process.on('message', message => service.send(message))
