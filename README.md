# peer-sketch-swarmjs-mice

Trying out [Swarm.js](https://github.com/gritzko/swarm).

This is based on the "Mice" demo - [demo](https://olebedev.github.io/mice/),
[source code](https://github.com/olebedev/mice).

# Install

```
npm install
```

You'll also need to run the Swarm server implementation, which is
available as a docker image:

```
docker run -d --name swarmdb -p 31415:31415 -v `pwd`:/var/lib/swarm olebedev/swarmdb
```

# Usage

```
npm start
```

(Use space to step through the simulation)

# Demo

![Demo](https://gateway.ipfs.io/ipfs/QmcCwixXpa8oT2XsiGMYykHJyGZbT4Gx9eUHZYvGjXHm4o/sketch-swarmjs-mice.gif)

[mp4 version](https://gateway.ipfs.io/ipfs/QmNhg2LKbBN3NMaPS7CHhidWyMT2Wd88XcEE6XS7HpAnCq/sketch-swarmjs-mice.mp4)

The mini-screencast above shows a simulation with the following steps:

1. starts 2 subprocesses in parallel, which create/join the same SwarmDB database
2. "Peer A" creates a record for a "mouse" with the symbol "a"
3. "Peer B" creates a record for a "mouse" with the symbol "b"
4. the "mice" are animated, generating a serious of position updates to simulate movement

The simulation runs standalone in a terminal window, but it can share data with
the web demo (linked above).

# License

MIT
