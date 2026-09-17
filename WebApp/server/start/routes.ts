/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { webCapabilities } from '../app/capabilities.js'

router.get('/', async () => ({
  service: 'mosaico-web-api',
  phase: 'T0',
  uiContract: 'mosaico-ui-t0-v1',
}))

router.get('/health', async () => ({ status: 'ok' }))

router.get('/api/v1/capabilities', async () => webCapabilities())
