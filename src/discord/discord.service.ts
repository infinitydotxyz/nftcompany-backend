import { InviteResponse } from '@infinityxyz/lib/types/services/discord';
import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

@Injectable()
export class DiscordService {
  client: AxiosInstance;
  constructor() {
    this.client = axios.create({
      baseURL: 'https://discord.com/api/v9/'
    });
  }

  /**
   * get the stats from a guild invite
   */
  async getGuildStats(
    inviteUrl: string
  ): Promise<{ discordFollowers: number; discordPresence: number; guildId: string; link: string } | undefined> {
    const inviteUrlParts = inviteUrl?.split('/').filter((item) => item);
    const inviteCode = inviteUrlParts[inviteUrlParts.length - 1];
    const response: AxiosResponse<InviteResponse> = await this.client.get(`/invites/${inviteCode}`, {
      params: {
        with_counts: true
      }
    });

    const members = response.data.approximate_member_count;
    const presence = response.data.approximate_presence_count;
    const guildId = response.data.guild.id;

    return {
      discordFollowers: members,
      discordPresence: presence,
      guildId: guildId,
      link: inviteUrl
    };
  }
}
