import { NetworkId, setupWalletSelector } from '@near-wallet-selector/core'
import { EventEmitter as NEventEmitter } from 'events'
import { DappletOverlay, Engine } from 'mutable-web-engine'
import { useInitNear } from 'near-social-vm'
import React, { FC, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import browser from 'webextension-polyfill'
import { networkConfig } from '../common/networks'
import { ExtensionStorage } from './extension-storage'
import { MultitablePanel } from './multitable-panel/multitable-panel'
import { getCurrentMutationId, setCurrentMutationId } from './storage'
import { setupWallet } from './wallet'

const eventEmitter = new NEventEmitter()
let startEnginePromise: Promise<Engine> | null = null

// The wallet selector looks like an unnecessary abstraction layer over the background wallet
// but we have to use it because near-social-vm uses not only a wallet object, but also a selector state
// object and its Observable for event subscription
const selectorPromise = setupWalletSelector({
  network: networkConfig.networkId as NetworkId,
  // The storage is faked because it's not necessary. The selected wallet ID is hardcoded below
  storage: new ExtensionStorage(),
  modules: [setupWallet({ eventEmitter })],
}).then((selector) => {
  // Use background wallet by default
  const wallet = selector.wallet
  selector.wallet = () => wallet('background')
  return selector
})

const App: FC = () => {
  const { initNear } = useInitNear()

  useEffect(() => {
    if (initNear) {
      initNear({
        networkId: networkConfig.networkId,
        selector: selectorPromise,
        features: {
          skipTxConfirmationPopup: true,
        },
        customElements: { DappletOverlay },
      })
    }
  }, [initNear])

  return null
}

browser.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) return
  if (message.type === 'SWITCH_MUTATION') {
    console.log(`Switching to the "${message.mutationId}" mutation`)
    setCurrentMutationId(message.mutationId)

    if (startEnginePromise) {
      startEnginePromise.then((engine) => engine.switchMutation(message.mutationId))
    }
  }
})

async function startEngine() {
  // Execute useInitNear hook before start the engine
  // It's necessary for widgets from near-social-vm
  createRoot(document.createElement('div')).render(<App />)

  const selector = await selectorPromise

  const engine = new Engine({
    networkId: networkConfig.networkId,
    selector,
  })

  const mutationId = getCurrentMutationId()

  console.log('Mutable Web Engine is initializing...')

  if (mutationId) {
    await engine.start(mutationId)
  } else {
    await engine.start()
  }

  await selector.wallet()

  browser.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return
    if (message.type === 'PING') {
      // Used for background. When user clicks on the extension icon, content script may be not injected.
      // It's a way to check liveness of the content script
      return Promise.resolve('PONG')
    } else if (message.type === 'COPY') {
      navigator.clipboard.writeText(message.address)
    } else if (message.type === 'SIGNED_IN') {
      eventEmitter.emit('signedIn', message.params)
    } else if (message.type === 'SIGNED_OUT') {
      eventEmitter.emit('signedOut')
    }
  })

  const container = document.createElement('div')
  container.style.display = 'flex'
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(<MultitablePanel engine={engine} />)

  return engine
}

startEnginePromise = startEngine()
