import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'
import { cofhejs, Encryptable } from 'cofhejs/node'

describe('PhoenixThrone', function () {
	async function deployFixture() {
		const [owner, player] = await hre.ethers.getSigners()

		const PhoenixThrone = await hre.ethers.getContractFactory('PhoenixThrone')
		const game = await PhoenixThrone.deploy()

		return { game, owner, player }
	}

	async function encryptPosition(pos: number) {
		const [encrypted] = await hre.cofhe.expectResultSuccess(
			cofhejs.encrypt([Encryptable.uint8(BigInt(pos))] as const)
		)
		return encrypted
	}

	async function createTestGame(game: any, player: any) {
		await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(player))

		// Player board: assassin=0, guard1=1, guard2=2, decoy1=3, decoy2=4
		// AI board: assassin=10, guard1=11, guard2=12, decoy1=13, decoy2=14
		const playerPositions = [0, 1, 2, 3, 4]
		const aiPositions = [10, 11, 12, 13, 14]

		const encrypted = []
		for (const pos of [...playerPositions, ...aiPositions]) {
			encrypted.push(await encryptPosition(pos))
		}

		const tx = await game.connect(player).createGame(
			encrypted[0], encrypted[1], encrypted[2], encrypted[3], encrypted[4],
			encrypted[5], encrypted[6], encrypted[7], encrypted[8], encrypted[9]
		)

		const receipt = await tx.wait()
		return { receipt, playerPositions, aiPositions }
	}

	describe('Functionality', function () {
		beforeEach(function () {
			if (!hre.cofhe.isPermittedEnvironment('MOCK')) this.skip()
		})

		it('Should create a game', async function () {
			const { game, player } = await loadFixture(deployFixture)
			const { receipt } = await createTestGame(game, player)

			// Check event was emitted
			const events = receipt.logs
			expect(events.length).to.be.greaterThan(0)

			// Verify game state
			const gameData = await game.games(0)
			expect(gameData.player).to.equal(player.address)
			expect(gameData.status).to.equal(0) // Active
			expect(gameData.turnNumber).to.equal(1)
		})

		it('Should execute a turn with a miss', async function () {
			const { game, player } = await loadFixture(deployFixture)
			await createTestGame(game, player)

			// Player strikes cell 20 (miss), AI strikes cell 20 (miss)
			const tx = await game.connect(player).executeTurn(
				0,
				[20],  // playerTargets
				[0],   // playerResults: Miss=0
				[20],  // aiTargets
				[0]    // aiResults: Miss=0
			)

			const receipt = await tx.wait()
			expect(receipt.status).to.equal(1)

			// Turn should increment
			const gameData = await game.games(0)
			expect(gameData.turnNumber).to.equal(2)
		})

		it('Should execute a turn with a guard hit', async function () {
			const { game, player } = await loadFixture(deployFixture)
			await createTestGame(game, player)

			// Player strikes cell 11 (AI guard1), result = HitGuard(1)
			const tx = await game.connect(player).executeTurn(
				0,
				[11],  // playerTargets: hit AI guard1
				[1],   // HitGuard
				[],    // no AI strikes
				[]     // no AI results
			)

			const receipt = await tx.wait()
			expect(receipt.status).to.equal(1)
		})

		it('Should handle HitAssassin and end game (player wins)', async function () {
			const { game, player } = await loadFixture(deployFixture)
			await createTestGame(game, player)

			// Player strikes cell 10 (AI assassin), result = HitAssassin(3)
			const tx = await game.connect(player).executeTurn(
				0,
				[10],  // playerTargets: hit AI assassin
				[3],   // HitAssassin
				[],
				[]
			)

			const receipt = await tx.wait()
			expect(receipt.status).to.equal(1)

			// Game should be over - PlayerWon
			const gameData = await game.games(0)
			expect(gameData.status).to.equal(1) // PlayerWon
		})

		it('Should handle HitAssassin and end game (AI wins)', async function () {
			const { game, player } = await loadFixture(deployFixture)
			await createTestGame(game, player)

			// AI strikes cell 0 (player assassin), result = HitAssassin(3)
			const tx = await game.connect(player).executeTurn(
				0,
				[20],  // player misses
				[0],
				[0],   // AI hits player assassin
				[3]    // HitAssassin
			)

			const receipt = await tx.wait()
			expect(receipt.status).to.equal(1)

			// Game should be over - AIWon
			const gameData = await game.games(0)
			expect(gameData.status).to.equal(2) // AIWon
		})

		it('Should relocate a unit', async function () {
			const { game, player } = await loadFixture(deployFixture)
			await createTestGame(game, player)

			const newPos = await encryptPosition(20)
			const tx = await game.connect(player).relocate(0, true, 1, newPos) // relocate guard1

			const receipt = await tx.wait()
			expect(receipt.status).to.equal(1)
		})

		it('Should reject non-player actions', async function () {
			const { game, player, owner } = await loadFixture(deployFixture)
			await createTestGame(game, player)

			// Owner (not player) tries to execute turn
			await expect(
				game.connect(owner).executeTurn(0, [20], [0], [], [])
			).to.be.revertedWith('Not the game player')
		})

		it('Should reject actions on finished games', async function () {
			const { game, player } = await loadFixture(deployFixture)
			await createTestGame(game, player)

			// End the game
			await game.connect(player).executeTurn(0, [10], [3], [], [])

			// Try to play another turn
			await expect(
				game.connect(player).executeTurn(0, [20], [0], [], [])
			).to.be.revertedWith('Game not active')
		})

		it('Should forfeit a game', async function () {
			const { game, player } = await loadFixture(deployFixture)
			await createTestGame(game, player)

			await game.connect(player).forfeit(0)

			const gameData = await game.games(0)
			expect(gameData.status).to.equal(3) // Forfeited
		})

		it('Should handle bonus strikes (HitDecoy grants extra)', async function () {
			const { game, player } = await loadFixture(deployFixture)
			await createTestGame(game, player)

			// Player: hit decoy1 (pos 13) then hit assassin (pos 10)
			// Both in same turn because HitDecoy grants bonus
			const tx = await game.connect(player).executeTurn(
				0,
				[13, 10],  // decoy then assassin
				[2, 3],    // HitDecoy, HitAssassin
				[],
				[]
			)

			const receipt = await tx.wait()
			expect(receipt.status).to.equal(1)

			const gameData = await game.games(0)
			expect(gameData.status).to.equal(1) // PlayerWon
		})
	})
})
