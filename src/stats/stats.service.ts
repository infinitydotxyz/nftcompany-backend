import { SocialsStats } from './socials.stats.interface';

// export class StatsService {
//   constructor(private discordStatsService: DiscordStatsService, private twitterStatsService: TwitterStatsService) {}

//   async getStats(): Promise<SocialsStats> {
//     const [discordStats, twitterStats] = await Promise.all([
//       this.discordStatsService.getStats(),
//       this.twitterStatsService.getStats()
//     ]);

//     const stats: SocialsStats = {
//       discordFollowers: discordStats.discordFollowers,
//       discordPresence: discordStats.discordPresence,
//       guildId: discordStats.guildId,
//       link: discordStats.link,
//       twitterFollowers: twitterStats.twitterFollowers,
//       twitterFollowing: twitterStats.twitterFollowing,
//       twitterHandle: twitterStats.twitterHandle,
//       twitterId: twitterStats.twitterId,
//       twitterLink: twitterStats.twitterLink,
//       updatedAt: Date.now()
//       // timestamp: Date.now(),
//       // period: 'daily'
//     };
//   }
// }
