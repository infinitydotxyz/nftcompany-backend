import CollectionsController from '@services/infinity/collections/CollectionsController';

const collectionsController = new CollectionsController();
export const getHistoricalDiscordData = collectionsController.getHistoricalData.bind(collectionsController)('discord');
