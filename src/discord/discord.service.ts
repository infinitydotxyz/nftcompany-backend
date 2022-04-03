import { DiscordSnippet } from '@infinityxyz/lib/types/core';
import { InviteResponse } from '@infinityxyz/lib/types/services/discord';
import { firestoreConstants, getWeekNumber } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ParsedCollectionId } from 'collections/collection-id.pipe';
import { FirebaseService } from 'firebase/firebase.service';
import { DiscordAPI } from 'services/discord/DiscordAPI';
import { aggregateHistoricalData } from 'services/infinity/aggregateHistoricalData';
import { MIN_DISCORD_UPDATE_INTERVAL } from '../constants';
import { AggregatedDiscordData } from './discord.types';

@Injectable()
export class DiscordService {
  private readonly client: AxiosInstance;

  constructor(private firebaseService: FirebaseService) {
    this.client = axios.create({
      baseURL: 'https://discord.com/api/v9/'
    });
  }

  /**
   * Get the stats from a guild invite
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

  async getDiscordSnippet(collection: ParsedCollectionId, inviteLink: string, forceUpdate = false) {
    const discordRef = collection.ref
      .collection(firestoreConstants.DATA_SUB_COLL)
      .doc(firestoreConstants.COLLECTION_DISCORD_DOC);
    let discordSnippet: DiscordSnippet = (await discordRef.get())?.data()?.discordSnippet;

    discordSnippet = await this.updateDiscordSnippet(discordSnippet, collection, inviteLink, forceUpdate);

    return discordSnippet;
  }

  async updateDiscordSnippet(
    discordSnippet: DiscordSnippet,
    collection: ParsedCollectionId,
    inviteLink: string,
    force = false
  ) {
    const now = new Date().getTime();

    const updatedAt: number = typeof discordSnippet?.timestamp === 'number' ? discordSnippet?.timestamp : 0;
    const shouldUpdate = now - updatedAt > MIN_DISCORD_UPDATE_INTERVAL;

    if (shouldUpdate || force) {
      const discord = new DiscordAPI();
      const res = await discord.getMembers(inviteLink);
      if (res) {
        const updatedSnippet: DiscordSnippet = {
          membersCount: res.members,
          presenceCount: res.presence,
          timestamp: new Date().getTime()
        };

        const batch = this.firebaseService.firestore.batch();

        const discordRef = collection.ref
          .collection(firestoreConstants.DATA_SUB_COLL)
          .doc(firestoreConstants.COLLECTION_DISCORD_DOC);

        /**
         * Update collection info tweet snippet
         */
        batch.set(
          discordRef,
          {
            discordSnippet: updatedSnippet
          },
          { merge: true }
        );

        const date = new Date(now);
        const [year, week] = getWeekNumber(date);
        const docId = `${year}-${week}`;

        const hourOfTheWeek = `${date.getUTCDay() * 24 + date.getUTCHours()}`;

        const weekDocRef = discordRef.collection(firestoreConstants.HISTORICAL_COLL).doc(docId);

        /**
         * Update historical data
         */
        batch.set(
          weekDocRef,
          {
            aggregated: { timestamp: now },
            [hourOfTheWeek]: updatedSnippet
          },
          { merge: true }
        );

        // Commit this batch so the updated data is available to aggregate the historical data
        await batch.commit();

        const batch2 = this.firebaseService.firestore.batch();

        const historicalRef = discordRef.collection(firestoreConstants.HISTORICAL_COLL);

        const aggregated = await aggregateHistoricalData<DiscordSnippet, AggregatedDiscordData>(
          historicalRef,
          10,
          batch2
        );

        /**
         *  Update snippet with aggregated data
         */
        batch2.set(
          discordRef,
          {
            discordSnippet: {
              ...updatedSnippet,
              aggregated
            }
          },
          { merge: true }
        );

        await batch2.commit();

        return {
          ...updatedSnippet
        };
      }
    }

    return discordSnippet;
  }
}
