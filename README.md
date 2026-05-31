# GenLayer Naija Whot

A real-time, decentralized multiplayer version of the classic Nigerian card game, Naija Whot. Built for the **Bradbury Builders Hackathon**.

**Live Demo:** [https://genlayer-whot-server.vercel.app](https://genlayer-whot-server.vercel.app)  
**Smart Contract:** `0x552D701D85bAa62F3aa8d18229d7c00AB282e373` (Bradbury Testnet)

## What is this?
Most web-based card games rely entirely on a centralized backend to enforce the rules. So we moved the game logic on-chain. 

We used GenLayer's VM to validate game actions and enforce the rules. When a player makes a move, the backend sends the game state and action to the deployed GenLayer contract through the `genlayer-js` SDK. The contract validates the move and returns whether it's legal before the action is applied to the game state.

## The Stack
* **Frontend:** Next.js, Tailwind CSS, Framer Motion
* **Backend:** Node.js, Socket.io
* **Blockchain:** GenLayer SDK, Python (Smart Contract)

## Quick rules primer
If you're not familiar with Naija Whot:
* You have to match either the shape or the number of the active card on the table.
* **1 (Hold On):** Skips the next player.
* **2 (Pick Two):** Next player draws 2 cards and misses their turn.
* **14 (General Market):** Everyone else at the table draws 1 card.
* **Winning:** First person to 0 cards wins. The rest of the table is ranked by the mathematical sum of the cards left in their hand (lowest score places higher).

## Notes & Challenges
One challenge was handling multiple players acting at nearly the same time. We used Socket.io room locks (`isProcessingMove`) on the backend to prevent conflicting actions from being submitted while the contract validation was in progress. 

We also initially tried to hit the GenLayer RPC with raw `fetch` requests, but ran into `EOF decode tx CallData` errors because the VM expects strict binary calldata. We solved this by dropping raw HTTP requests and integrating the `genlayer-js` SDK to properly encode the transaction payloads.

## How to run it locally

You'll need two terminals open to run the client and the server separately.

**1. Start the backend**
```bash
cd server
npm install
node server.js