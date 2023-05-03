import 'dotenv/config'
import statistics from '#lib/statistics.js'
import banners from '#lib/banners.js'
import campaigns from '#lib/campaigns.js'
import clients from '#lib/clients.js'
import users from '#lib/users.js'

async function updateResources(){
    // await users.runUpdate()
    await clients.runUpdate()
    // await campaigns.runUpdate()
    // await banners.runUpdate()
}
async function updateStatistics(){
    // await statistics.runUpdate()
}
await updateResources()
await updateStatistics()