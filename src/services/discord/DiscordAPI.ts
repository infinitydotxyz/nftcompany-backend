import { error } from '@utils/logger';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { InviteResponse } from '@infinityxyz/types/services/discord';

export class DiscordAPI {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://discord.com/api/v9/'
    });
  }

  /**
   *
   * @param inviteUrl used to get the number of members in the discord
   * @returns the number of members and the presence (number of members online)
   */
  async getMembers(inviteUrl: string): Promise<{ members: number; presence: number } | undefined> {
    try {
      const inviteUrlParts = inviteUrl?.split('/').filter((item) => item);
      const inviteCode = inviteUrlParts[inviteUrlParts.length - 1];
      const response: AxiosResponse<InviteResponse> = await this.client.get(`/invites/${inviteCode}`, {
        params: {
          with_counts: true
        }
      });

      const members = response.data.approximate_member_count;
      const presence = response.data.approximate_presence_count;

      return {
        members,
        presence
      };
    } catch (err) {
      error('error occurred while getting discord members from invite');
      error(err);
    }
  }
}
