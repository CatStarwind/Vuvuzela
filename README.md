# Vuvuzela
Discord World Cup Win Probability Bot


## Commands

All commands are prefixed with `v!`

### games
`v!games`

Displays games for the day and their `gameID`
```ini
Todays Matches Are:
[1] Team A vs Team B
[2] Uruguay vs Russia
```


### odds
`v!odds`

Start, stop and check for probablities of a given match of the day. Probablity is sent every 5 minutes.

Command | Description
--- | ---
`v!odds start [gameID]` | Starts probability messages for `gameID`
`v!odds stop [gameID]` | Stops probability messages for `gameID`
`v!odds check [gameID]` | Send probability for `gameID`

### ping
`v!ping`
pong!
