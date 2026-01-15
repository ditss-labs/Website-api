import cron from 'node-cron'
import { User } from '../database/models/User.js'
import chalk from 'chalk'

export function startSchedulers() {
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log(chalk.yellow('🔄 Resetting daily API usage...'))
      const result = await User.updateMany(
        { 'apikeys.usageToday': { $gt: 0 } },
        { $set: { 'apikeys.$[].usageToday': 0 } }
      )
      console.log(chalk.green(`✅ Reset ${result.modifiedCount} users' daily usage`))
    } catch (error) {
      console.error(chalk.red('❌ Error resetting daily usage:'), error)
    }
  })
  
  cron.schedule('0 0 * * 0', async () => {
    try {
      console.log(chalk.yellow('📊 Calculating weekly stats...'))
      const users = await User.find({})
      for (const user of users) {
        const totalUsage = user.apikeys.reduce((sum, key) => sum + key.totalUsage, 0)
        user.totalApiCalls = totalUsage
        await user.save()
      }
      console.log(chalk.green('✅ Weekly stats updated'))
    } catch (error) {
      console.error(chalk.red('❌ Error updating weekly stats:'), error)
    }
  })
  
  cron.schedule('0 */6 * * *', async () => {
    try {
      console.log(chalk.yellow('🔍 Checking for expired API keys...'))
      const now = new Date()
      const result = await User.updateMany(
        { 'apikeys.expiresAt': { $lt: now, $ne: null } },
        { $set: { 'apikeys.$[elem].status': 'revoked' } },
        { arrayFilters: [{ 'elem.expiresAt': { $lt: now } }] }
      )
      if (result.modifiedCount > 0) {
        console.log(chalk.green(`✅ Revoked ${result.modifiedCount} expired API keys`))
      }
    } catch (error) {
      console.error(chalk.red('❌ Error checking expired API keys:'), error)
    }
  })
  
  console.log(chalk.blue('✅ Schedulers started'))
}
